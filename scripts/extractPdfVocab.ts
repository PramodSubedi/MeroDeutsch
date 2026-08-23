/**
 * scripts/extractPdfVocab.ts  (PDF harvest — A1 pool expansion from source PDFs)
 *
 * Extracts German vocabulary entries from the source PDFs in
 * D:\\Project\\extract_vocab\\, localizes them via Groq (EN + Nepali
 * Devanagari), and stages them as entity-shaped JSON files in
 * `src/data/vocab/pdf-<source>.json`. NOTHING is written to the database —
 * apply later with `npm run seed-vocab` (append-only).
 *
 * Pipeline per PDF:
 *   1. pdf-parse extracts raw text.
 *   2. Candidate lines are filtered (page headers, numbers, fragments dropped).
 *   3. Groq acts as CURATOR: for each candidate line it either normalizes it
 *      into {word, article, part_of_speech, translation_en, translation_np}
 *      or returns null for non-entries. The model never invents words — it
 *      only cleans + translates the extracted lines.
 *   4. Strict validation (article CHECK, Devanagari, length caps) + dedupe
 *      against the live DB, all staged JSON, and within-batch.
 *   5. Romanized Nepali derived locally via scripts/devanagari.ts.
 *
 * Env:
 *   GROQ_API_KEY                    (required)
 *   GEN_MODEL                       (optional; default openai/gpt-oss-120b)
 *   VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (optional — DB dedupe)
 *   PDF_DIR                         (optional; default D:\\Project\\extract_vocab)
 *   MAX_PER_PDF                     (optional; default 400 candidates per PDF)
 *
 * Usage:
 *   npm run extract-pdf                 # all PDFs
 *   npm run extract-pdf -- goethe-a1    # single source slug
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { devanagariToRoman } from './devanagari';
import type { VocabularyEntity } from '../src/types/content';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../src/data/vocab');
const PDF_DIR = process.env.PDF_DIR || 'D:\\Project\\extract_vocab';
const MAX_PER_PDF = Number(process.env.MAX_PER_PDF || 1400);
const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Source registry: PDF filename → { slug, category, level }
// ---------------------------------------------------------------------------
interface PdfSource {
  file: string;
  slug: string;
  category: string;
  level: string;
}

const SOURCES: PdfSource[] = [
  { file: 'A1_SD1_Wortliste_02.pdf', slug: 'goethe-a1', category: 'goethe-a1', level: 'A1' },
  { file: 'A1 German Vocabulary - Beginner German Words.pdf', slug: 'a1-general', category: 'a1-general', level: 'A1' },
  { file: 'Greetings & Basics - German Vocabulary.pdf', slug: 'greetings-basics', category: 'greetings-basics', level: 'A1' },
  { file: 'German Food Vocabulary - Learn Food Words in German.pdf', slug: 'food-pdf', category: 'food-pdf', level: 'A1' },
  { file: 'German Travel Vocabulary - Learn Travel Words in German.pdf', slug: 'travel-pdf', category: 'travel-pdf', level: 'A1' },
  { file: 'Restaurants, Cafes, Bars - German Vocabulary.pdf', slug: 'restaurants-pdf', category: 'restaurants-pdf', level: 'A1' },
  { file: '68532-vocabulary-list-by-topic.pdf', slug: 'topics-pdf', category: 'topics-pdf', level: 'A1' },
  { file: 'A2 German Vocabulary - Elementary German Words.pdf', slug: 'a2-general', category: 'a2-general', level: 'A2' },
  { file: 'B1 German Vocabulary - Intermediate German Words.pdf', slug: 'b1-general', category: 'b1-general', level: 'B1' },
  { file: 'B2 German Vocabulary - Upper Intermediate German Words.pdf', slug: 'b2-general', category: 'b2-general', level: 'B2' },
];

// ---------------------------------------------------------------------------
// Groq client (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------
const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) {
  console.error('❌ GROQ_API_KEY is required.');
  process.exit(1);
}
// gpt-oss-20b: ~4x higher free-tier TPM than 120b, and TPD budgets are
// tracked per model — switching models effectively doubles usable quota.
const MODEL = process.env.GEN_MODEL || 'openai/gpt-oss-20b';
const client = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function createWithRetry(
  messages: { role: 'system' | 'user'; content: string }[],
  maxAttempts = 5,
): Promise<string> {
  let lastError: Error = new Error('unreachable');
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // gpt-oss models are reasoners: they burn tokens on hidden reasoning
      // before emitting content, so the ceiling must be generous or
      // `content` comes back empty. NOTE: max_tokens counts toward the TPM
      // check — input + max_tokens must stay under 8000 on the free tier.
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 4500,
        messages,
      });
      const msg = completion.choices[0]?.message;
      const text = msg?.content && msg.content.trim().length > 0 ? msg.content : undefined;
      if (!text) throw new Error('Empty completion from model');
      return text;
    } catch (err) {
      lastError = err as Error;
      const errMsg = lastError.message;
      const isRetryable =
        errMsg.includes('429') || /rate limit/i.test(errMsg) || /empty completion/i.test(errMsg);
      if (!isRetryable || attempt === maxAttempts) throw lastError;
      const match = errMsg.match(/try again in ([\d.]+)s/i);
      const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : attempt * 8000;
      console.warn(`   ⏳ rate limited — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Candidate extraction from raw PDF text
// ---------------------------------------------------------------------------
const PAGE_HEADER_RE = /^(VS_\d+|INVeNTAre|INHALT|wortschatz|wortgruppenliste|Seite\s*\d+|\d+\s*$)/i;

/** Heuristic: does this line look like a German vocabulary entry? */
function isCandidate(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (PAGE_HEADER_RE.test(t)) return false;
  if (/^--\s*\d+\s*of\s*\d+\s*--$/i.test(t)) return false; // pdf-parse page markers
  if (/^Seite\s*\d+/i.test(t)) return false;
  if (/^\d+([.,]\d+)*\s*(=|$)/.test(t)) return false; // pure numbers / measures
  if (!/[a-zA-ZäöüßÄÖÜ]/.test(t)) return false;
  // Must contain at least one German-ish word (letters, umlauts, ß)
  if (!/[a-zäöüß]{2,}/i.test(t)) return false;
  // Vocab entries are short — drop sentence-like prose locally (saves tokens)
  if (t.split(/\s+/).length > 6) return false;
  return true;
}

function extractCandidates(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawLine of text.split(String.fromCharCode(10))) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!isCandidate(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= MAX_PER_PDF) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Curator prompt — clean + translate extracted lines, never invent
// ---------------------------------------------------------------------------
// Compact prompt — every token counts against the free-tier daily budget.
const SYSTEM_PROMPT = `German vocab curator for a DE→EN→NE learning app.
Input: JSON array of raw lines from a vocabulary PDF. For EACH line return one
slot (same order) in {"entries":[...]}:
- Vocabulary entry → {"word":"<base word, no article/plural endings>","article":"der"|"die"|"das"|null,"part_of_speech":"noun"|"verb"|"adjective"|"phrase","translation_en":"<English>","translation_np":"<Nepali, Devanagari>"}
  - Strip leading articles into "article"; strip ", -e" plural endings.
  - Multi-word entries ("am Wochenende"): article null, pos "phrase".
  - Nepali must be natural spoken Nepali in Devanagari (NOT Hindi conventions).
- Not an entry (page header, section label, number, English text, fragment) → null.
Never invent words not present in the input line.`;

function userPrompt(lines: string[]): string {
  return `Curate these ${lines.length} raw line(s). Return ONLY {"entries": [...]} with one slot per line, in this exact order:
${JSON.stringify(lines)}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const DEVANAGARI_RE = /[\u0900-\u097F]/;

interface RawEntry {
  word?: unknown;
  article?: unknown;
  part_of_speech?: unknown;
  translation_en?: unknown;
  translation_np?: unknown;
}

const ALLOWED_POS = new Set(['noun', 'verb', 'adjective', 'phrase', 'expression']);

function validateEntry(raw: RawEntry): string | null {
  const word = raw.word;
  const en = raw.translation_en;
  const np = raw.translation_np;
  const article = raw.article;
  const pos = raw.part_of_speech;

  if (typeof word !== 'string' || word.trim().length < 2 || word.trim().length > 40) {
    return 'invalid word';
  }
  if (typeof pos !== 'string' || !ALLOWED_POS.has(pos)) {
    return 'invalid part_of_speech';
  }
  if (typeof en !== 'string' || en.trim().length === 0 || en.length > 60) {
    return 'invalid translation_en';
  }
  if (typeof np !== 'string' || np.trim().length === 0 || np.length > 60) {
    return 'invalid translation_np';
  }
  if (!DEVANAGARI_RE.test(np)) {
    return 'translation_np is not Devanagari';
  }
  if (pos === 'noun' && article !== 'der' && article !== 'die' && article !== 'das') {
    return `noun missing valid article (got ${String(article)})`;
  }
  if (pos !== 'noun' && article !== null && article !== undefined) {
    return 'non-noun must have null article';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dedupe sets: live DB + all staged JSON files
// ---------------------------------------------------------------------------
async function loadExistingKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const supabase = createClient(url, serviceKey);
    const { data, error } = await supabase.from('vocabulary').select('word, part_of_speech');
    if (!error) {
      for (const r of data ?? []) keys.add(`${r.word}|${r.part_of_speech}`);
    } else {
      console.warn(`⚠ DB dedupe unavailable: ${error.message}`);
    }
  }
  try {
    for (const f of await fs.readdir(OUT_DIR)) {
      if (!f.endsWith('.json')) continue;
      const rows = JSON.parse(await fs.readFile(path.join(OUT_DIR, f), 'utf8')) as VocabularyEntity[];
      for (const r of rows) keys.add(`${r.word}|${r.part_of_speech}`);
    }
  } catch {
    // no staged files yet
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Process one PDF
// ---------------------------------------------------------------------------
async function processPdf(
  source: PdfSource,
  existingKeys: Set<string>,
): Promise<{ written: number; skipped: number; candidates: number; rejected: string[] }> {
  const filePath = path.join(PDF_DIR, source.file);
  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    console.log(`   • ${source.slug}: FILE NOT FOUND, skipped`);
    return { written: 0, skipped: 0, candidates: 0, rejected: [] };
  }

  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    const candidates = extractCandidates(result.text);
    console.log(`   • ${source.slug}: ${candidates.length} candidate line(s)`);

  const rejected: string[] = [];
  const entries: VocabularyEntity[] = [];
  const batchKeys = new Set<string>();

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const text = await createWithRetry([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(chunk) },
    ]);

    let arr: (RawEntry | null)[] = [];
    try {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      const parsedJson = JSON.parse(cleaned.slice(start, end + 1)) as { entries?: (RawEntry | null)[] };
      arr = parsedJson.entries ?? [];
    } catch (err) {
      rejected.push(`batch ${i}: parse error — ${(err as Error).message}`);
      continue;
    }

    chunk.forEach((line, idx) => {
      const raw = arr[idx];
      if (!raw || typeof raw !== 'object') return; // curator said null — silently drop
      const problem = validateEntry(raw);
      if (problem) {
        rejected.push(`${line} → ${problem}`);
        return;
      }
      const word = (raw.word as string).trim();
      const pos = raw.part_of_speech as VocabularyEntity['part_of_speech'];
      const key = `${word}|${pos}`;
      if (existingKeys.has(key) || batchKeys.has(key)) {
        return; // dedupe silently
      }
      batchKeys.add(key);
      const np = (raw.translation_np as string).trim();
      entries.push({
        word,
        article: pos === 'noun' ? (raw.article as 'der' | 'die' | 'das') : undefined,
        part_of_speech: pos,
        translation_en: (raw.translation_en as string).trim(),
        translation_np: np,
        translation_ne_roman: devanagariToRoman(np),
        category: source.category,
        level: source.level,
      });
    });
  }

  if (entries.length > 0) {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const outFile = path.join(OUT_DIR, `pdf-${source.slug}.json`);
    let merged: VocabularyEntity[] = entries;
    try {
      const prev = JSON.parse(await fs.readFile(outFile, 'utf8')) as VocabularyEntity[];
      const seen = new Set(prev.map((e) => `${e.word}|${e.part_of_speech}`));
      merged = [...prev, ...entries.filter((e) => !seen.has(`${e.word}|${e.part_of_speech}`))];
    } catch {
      // no previous file
    }
    await fs.writeFile(outFile, JSON.stringify(merged, null, 2), 'utf-8');
  }

  return { written: entries.length, skipped: candidates.length - entries.length, candidates: candidates.length, rejected };
  } finally {
    await parser.destroy();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`Provider: groq | Model: ${MODEL} | PDF dir: ${PDF_DIR}`);

  const filter = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const sources = filter.length > 0 ? SOURCES.filter((s) => filter.includes(s.slug)) : SOURCES;
  if (sources.length === 0) {
    console.error(`No sources match: ${filter.join(', ')}`);
    console.error(`Available: ${SOURCES.map((s) => s.slug).join(', ')}`);
    process.exit(1);
  }

  const existingKeys = await loadExistingKeys();
  console.log(`📚 Harvesting PDFs (dedupe set: ${existingKeys.size} keys)...
`);

  let totalWritten = 0;
  const allRejected: string[] = [];

  for (const source of sources) {
    try {
      const { written, candidates, rejected } = await processPdf(source, existingKeys);
      totalWritten += written;
      allRejected.push(...rejected.map((r) => `[${source.slug}] ${r}`));
      console.log(`     → ${written} new entries staged (from ${candidates} candidates)
`);
    } catch (err) {
      console.log(`     → FAILED: ${(err as Error).message}
`);
      allRejected.push(`[${source.slug}] batch error: ${(err as Error).message}`);
    }
  }

  console.log(`✅ Harvest complete. ${totalWritten} new entries staged in src/data/vocab/pdf-*.json`);
  if (allRejected.length > 0) {
    console.log(`⚠ Rejected (${allRejected.length}):`);
    for (const r of allRejected.slice(0, 30)) console.log(`   - ${r}`);
    if (allRejected.length > 30) console.log(`   ... and ${allRejected.length - 30} more`);
  }
  console.log('Next step: review the pdf-*.json files, then run `npm run seed-vocab` to upsert.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});