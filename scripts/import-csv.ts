/**
 * scripts/import-csv.ts
 * Reads german_vocabulary.csv -> src/data/vocab/german_vocabulary.json
 * as VocabularyEntity[] for scripts/seedVocab.ts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CSV = path.join(
  process.env.USERPROFILE || 'C:/Users/pramo',
  'Downloads',
  'german_vocabulary.csv',
);
const OUTPUT_FILE = path.resolve(PROJECT_ROOT, 'src/data/vocab/german_vocabulary.json');

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim().length > 0)) rows.push(row);
  return rows;
}

async function main(): Promise<void> {
  const csvPath = process.argv[2] || DEFAULT_CSV;
  console.log('Reading CSV: ' + csvPath);

  const rows = parseCsv(await fs.readFile(csvPath, 'utf-8'));
  if (rows.length < 2) {
    console.error('CSV has no data rows.');
    process.exit(1);
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    word: col('word'),
    article: col('article'),
    plural: col('plural'),
    pos: col('part_of_speech'),
    en: col('translation_en'),
    np: col('translation_np'),
    level: col('level'),
    category: col('category'),
    exampleDe: col('example_de'),
    exampleEn: col('example_en'),
    exampleNp: col('example_np'),
  };

  const missing = Object.entries(idx)
    .filter(([, v]) => v === -1)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error('Missing columns: ' + missing.join(', '));
    process.exit(1);
  }

  const allowedPos = new Set(['noun', 'verb', 'adjective', 'phrase', 'expression']);
  const allowedArticles = new Set(['der', 'die', 'das']);
  const entities: Record<string, unknown>[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (id: number) => (id >= 0 ? (r[id] ?? '').trim() : '');
    const word = get(idx.word);
    const article = get(idx.article).toLowerCase();
    const plural = get(idx.plural);
    const pos = get(idx.pos).toLowerCase();
    const en = get(idx.en);
    const np = get(idx.np);
    const level = (get(idx.level) || 'A1').toUpperCase();
    const category = get(idx.category) || 'general';

    if (!word || !en || !np) {
      skipped++;
      continue;
    }

    const entity: Record<string, unknown> = {
      word,
      part_of_speech: allowedPos.has(pos) ? pos : 'noun',
      translation_en: en,
      translation_np: np,
      category,
      level: ['A1', 'A2', 'B1', 'B2'].includes(level) ? level : 'A1',
    };
    if (allowedArticles.has(article)) entity.article = article;
    if (plural) entity.plural = plural;
    if (get(idx.exampleDe)) entity.example_de = get(idx.exampleDe);
    if (get(idx.exampleEn)) entity.example_en = get(idx.exampleEn);
    if (get(idx.exampleNp)) entity.example_np = get(idx.exampleNp);
    entities.push(entity);
  }

  if (entities.length === 0) {
    console.error('No valid rows found.');
    process.exit(1);
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(entities, null, 2), 'utf-8');

  console.log('Imported ' + entities.length + ' entries (' + skipped + ' skipped).');
  console.log('Output: ' + path.relative(PROJECT_ROOT, OUTPUT_FILE));

  const byLevel = new Map<string, number>();
  for (const e of entities) {
    const lv = String(e.level);
    byLevel.set(lv, (byLevel.get(lv) ?? 0) + 1);
  }
  console.log('By level:');
  for (const [lv, count] of [...byLevel.entries()].sort()) {
    console.log('  ' + lv + ': ' + count);
  }

  console.log('Next: npm run seed-vocab');
}

void main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});