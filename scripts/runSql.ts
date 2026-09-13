/**
 * scripts/runSql.ts
 *
 * Execute arbitrary SQL against the LIVE Supabase project via the Management
 * API — the same endpoint the Dashboard SQL Editor calls under the hood.
 * Use this instead of the CLI when the remote DB has no CLI migration-history
 * table, so we can apply migration files verbatim without replaying 001–017.
 *
 * Usage:
 *   npm run run-sql -- supabase/migrations/018_category_tags.sql   # run a .sql file
 *   npm run run-sql -- --sql "SELECT count(*) FROM public.vocabulary;"
 *   npm run run-sql -- --token=<pat> --sql "..."                   # inline token override
 *
 * Credentials (in .env.local, git-ignored — see .env.example):
 *   SUPABASE_ACCESS_TOKEN=<Personal Access Token>  // supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF=uiwlioriubixerspdamx      // optional; defaults to this project
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { argv } from 'node:process';

// Load .env.local FIRST (git-ignored; holds secrets), then fall back to .env.
config({ path: '.env.local' });
config();

const API_BASE = 'https://api.supabase.com/v1';
const DEFAULT_REF = 'uiwlioriubixerspdamx';

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

// --token=<pat> inline override beats the env-var path for one-off runs.
const inlineTokenArg = argv.find((a) => a.startsWith('--token='));
const token = inlineTokenArg ? inlineTokenArg.slice('--token='.length) : process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  fail(
    [
      'SUPABASE_ACCESS_TOKEN is not set.',
      '',
      'Create a Personal Access Token at:',
      '  https://supabase.com/dashboard/account/tokens',
      'then add it to .env.local as:',
      '  SUPABASE_ACCESS_TOKEN=your-token-here',
      '(or pass --token=<pat> inline for a single run).',
    ].join('\n'),
  );
}

const flagIndex = argv.findIndex((a) => a === '--sql');
let query: string;
if (flagIndex >= 0) {
  query = argv[flagIndex + 1] ?? '';
} else {
  const path = argv[2];
  if (!path) fail('Usage: npm run run-sql -- <file.sql>  |  --sql "<sql>"');
  if (!path.endsWith('.sql')) fail(`Expected a .sql file, got: ${path}`);
  query = readFileSync(path, 'utf8');
}
if (!query.trim()) fail('Empty SQL — nothing to run.');

const ref = process.env.SUPABASE_PROJECT_REF ?? DEFAULT_REF;
console.log(`\n🔌 Executing SQL against project ref \`${ref}\` (${query.length.toLocaleString()} chars)\n`);

const res = await fetch(`${API_BASE}/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
});

const raw = await res.text();
let body: unknown;
try {
  body = raw ? JSON.parse(raw) : null;
} catch {
  body = raw;
}

if (!res.ok) {
  const detail =
    typeof body === 'object' && body !== null
      ? JSON.stringify(body, null, 2)
      : String(body ?? res.statusText);
  fail(`HTTP ${res.status} from Management API:\n${detail}`);
}

console.log('✅ Query executed successfully.');
if (body === null || body === undefined) {
  console.log('(no response body)');
} else {
  console.log(JSON.stringify(body, null, 2));
}