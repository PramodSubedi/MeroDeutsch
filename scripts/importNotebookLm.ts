/**
 * scripts/importNotebookLm.ts — NotebookLM dictionary → MeroDeutsch pipeline
 *
 * Imports the NotebookLM-generated "german_learning_dictionary" (staged in
 * scripts/data/notebooklm/) into the two curriculum data surfaces:
 *
 *   Target A — public.vocabulary
 *     Live source for the Glossary, Vocab Trainer and Articles quiz
 *     (RPC get_random_vocabulary, migrations 004/010/013/014/015).
 *     Rows are appended with the dictionary's CEFR level (A1–B2), topic
 *     category, example sentence and noun gender/plural (new plural_form
 *     column, migration 016).
 *
 *   Target B — public.content_items ('vocab-item' pool, migration 011)
 *     Recommended by the NotebookLM codebase review: grammar metadata that
 *     has no relational column (plural, verb separable/auxiliary/3sg/past
 *     participle) is nested in the JSONB payload under stable ids
 *     'nlm-vocab-<dictionary id>'.
 *
 * Conventions (mirrors scripts/seedVocab.ts):
 *   - dotenv from .env then .env.local (override)
 *   - SUPABASE_SERVICE_ROLE_KEY required for writes (vocabulary is
 *     RLS-restricted to public reads)
 *   - Append-only: rows whose (word, part_of_speech) already exist are
 *     SKIPPED so the import can never clobber live translations. Set
 *     SEED_FORCE=1 to overwrite deliberately.
 *   - Nepali translations: the source dataset has none. Rows are inserted
 *     with translation_np='' and --backfill-nepali translates them via the
 *     existing Groq/OpenAI batch pattern (translation_ne_roman is derived
 *     locally with devanagariToRoman — never requested from an API).
 *
 * Source field notes:
 *   - part_of_speech is Title-case ('Noun') → mapped to the DB CHECK values;
 *     'Interjection' → 'expression' (migration 016 adds 'adverb').
 *   - noun_metadata.gender 'pl.' (plural-only nouns) maps to article NULL so
 *     the migration-014 article-quiz guard keeps them out of gender drills.
 *   - is_active_only is true for every entry — informational, not imported.
 *
 * Usage:
 *   npm run import-notebooklm                          # dry-run report
 *   npm run import-notebooklm -- --apply               # perform upserts
 *   npm run import-notebooklm -- --apply --backfill-nepali
 *   SEED_FORCE=1 npm run import-notebooklm -- --apply  # overwrite mode
 */
import dotenv from 'dotenv';
// Load .env first, then .env.local (override) — same resolution as seedVocab.ts.
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { devanagariToRoman } from './devanagari';
import type { VocabularyEntity } from '../src/types/content';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICTIONARY_FILE = path.resolve(__dirname, 'data/notebooklm/german_learning_dictionary.json');
const METADATA_SQL_FILE = path.resolve(__dirname, 'data/notebooklm/german_learning_dictionary.sql');

// ---------------------------------------------------------------------------
// Source types (shape of the staged NotebookLM export)
// ---------------------------------------------------------------------------

interface NlmExample {
  german_sentence: string;
  english_translation: string;
}

interface NlmEntry {
  id: number;
  german_word: string;
  part_of_speech: string;
  english_translation: string;
  cefr_level: string;
  is_active_only: boolean;
  topics: string[];
  examples: NlmExample[];
}

/** noun_metadata row (joined by vocabulary_id from the .sql dump). */
interface NounMeta {
  gender: string; // 'der' | 'die' | 'das' | 'pl.'
  plural: string | null;
}

/** verb_metadata row (joined by vocabulary_id from the .sql dump). */
interface VerbMeta {
  separable: boolean;
  auxiliary: string;
  present3sg: string | null;
  pastParticiple: string | null;
}

// ---------------------------------------------------------------------------
// Import row shapes
// ---------------------------------------------------------------------------

/** VocabularyEntity plus the columns the writer adds (tags/plural). */
interface VocabInsert extends VocabularyEntity {
  tags?: string[];
  plural_form?: string | null;
}

interface ContentInsert {
  id: string;
  content_type: 'vocab-item';
  payload: Record<string, unknown>;
  sort: number;
}

// ---------------------------------------------------------------------------
// SQL parsing — join noun_metadata / verb_metadata by dictionary id
// (no native dependency: the staged .sql is plain single-line INSERTs)
// ---------------------------------------------------------------------------

/** Split a SQL VALUES(...) body on top-level commas, honouring '' escapes. */
function splitTuple(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inString) {
      if (ch === "'") {
        if (body[i + 1] === "'") {
          current += "''"; // escaped quote — keep both, unescaped later
          i += 1;
        } else {
          inString = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === "'") {
      inString = true;
    } else if (ch === ',') {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
}

function unescapeSql(value: string): string {
  return value.replace(/''/g, "'");
}

/** SQL value → string | null ('' and NULL literals become null). */
function sqlText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return null;
  return unescapeSql(trimmed);
}

async function parseMetadata(): Promise<{ nouns: Map<number, NounMeta>; verbs: Map<number, VerbMeta> }> {
  const sql = await fs.readFile(METADATA_SQL_FILE, 'utf8');
  const nouns = new Map<number, NounMeta>();
  const verbs = new Map<number, VerbMeta>();

  const nounRe = /INSERT\s+INTO\s+"noun_metadata"\s+VALUES\s*\(([^)]*)\)\s*;/g;
  for (const match of sql.matchAll(nounRe)) {
    const [id, gender, plural] = splitTuple(match[1]);
    nouns.set(Number(id), { gender: unescapeSql(gender ?? ''), plural: sqlText(plural) });
  }

  // verb_metadata(id, is_separable, auxiliary_verb, present_3sg, past_participle)
  const verbRe = /INSERT\s+INTO\s+"verb_metadata"\s+VALUES\s*\(([^)]*)\)\s*;/g;
  for (const match of sql.matchAll(verbRe)) {
    const [id, separable, auxiliary, present3sg, pastParticiple] = splitTuple(match[1]);
    verbs.set(Number(id), {
      separable: separable === '1' || separable?.toLowerCase() === 'true',
      auxiliary: unescapeSql(auxiliary ?? 'haben'),
      present3sg: sqlText(present3sg),
      pastParticiple: sqlText(pastParticiple),
    });
  }

  return { nouns, verbs };
}

// ---------------------------------------------------------------------------
// Normalization — NotebookLM values → MeroDeutsch schema
// ---------------------------------------------------------------------------

/** NLM part_of_speech (Title-case) → public.vocabulary CHECK value. */
const POS_MAP: Record<string, VocabularyEntity['part_of_speech']> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adjective',
  phrase: 'phrase',
  interjection: 'expression',
  adverb: 'adverb', // CHECK extended in migration 016
};

/**
 * NLM topic → existing public.vocabulary category slug (values verified
 * against the live table so trainer/glossary category filters cluster the
 * new rows with related A1 words instead of fragmenting the filter list).
 */
const TOPIC_CATEGORY_MAP: Record<string, string> = {
  'Greetings & Basics': 'greetings',
  'Food & Drink': 'food-drink',
  'Restaurant, Cafe & Bar': 'restaurants',
  'Travel & Tourism': 'travel',
  'Education & Work': 'education-work',
  'Home & Daily Life': 'home-daily-life',
  'Family & Relationships': 'family',
  'Time & Calendar': 'time',
  'Health & Sport': 'health',
  'Abstract & Sophisticated Concepts': 'abstract-concepts',
};

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2']);

function categoryForTopics(topics: string[]): string {
  const first = topics[0]?.trim() ?? '';
  if (TOPIC_CATEGORY_MAP[first]) return TOPIC_CATEGORY_MAP[first];
  return (
    first
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'general'
  );
}

interface BuiltRows {
  vocabRows: VocabInsert[];
  contentRows: ContentInsert[];
  rejected: string[];
  /** vocabulary_id of rows inserted into vocabulary (for Nepali backfill). */
  insertedKeys: { word: string; part_of_speech: string }[];
}

function buildRows(
  entries: NlmEntry[],
  meta: { nouns: Map<number, NounMeta>; verbs: Map<number, VerbMeta> },
  existingVocab: Map<string, ExistingVocabRow>,
  existingContentWords: Set<string>,
  force: boolean,
): BuiltRows {
  const vocabRows: VocabInsert[] = [];
  const contentRows: ContentInsert[] = [];
  const rejected: string[] = [];
  const insertedKeys: { word: string; part_of_speech: string }[] = [];
  const batchKeys = new Set<string>();

  for (const entry of entries) {
    const word = entry.german_word.trim();
    const en = entry.english_translation.trim();
    const pos = POS_MAP[entry.part_of_speech.toLowerCase().trim()];
    const level = entry.cefr_level.trim().toUpperCase();

    if (!word || word.length > 100) {
      rejected.push(`#${entry.id} ${word || '(empty)'}: invalid word`);
      continue;
    }
    if (!en || en.length > 255) {
      rejected.push(`#${entry.id} ${word}: invalid english_translation`);
      continue;
    }
    if (!pos) {
      rejected.push(`#${entry.id} ${word}: unmapped part_of_speech '${entry.part_of_speech}'`);
      continue;
    }
    if (!VALID_LEVELS.has(level)) {
      rejected.push(`#${entry.id} ${word}: unmapped cefr_level '${entry.cefr_level}'`);
      continue;
    }

    const key = `${word}|${pos}`;
    if (batchKeys.has(key)) {
      rejected.push(`#${entry.id} ${word}: duplicate within dataset`);
      continue;
    }
    batchKeys.add(key);

    // --- grammar metadata (joined from the .sql dump) ---
    const noun = meta.nouns.get(entry.id);
    const verb = meta.verbs.get(entry.id);
    const article =
      pos === 'noun' && noun && (noun.gender === 'der' || noun.gender === 'die' || noun.gender === 'das')
        ? (noun.gender as 'der' | 'die' | 'das')
        : undefined;
    // gender 'pl.' (plural-only nouns) → no article: the migration-014
    // article-quiz guard then keeps these rows out of gender drills.
    const plural = pos === 'noun' ? (noun?.plural ?? null) : null;

    const category = categoryForTopics(entry.topics);
    const example = entry.examples[0];
    const exampleDe = example?.german_sentence.trim() || undefined;
    const exampleEn = example?.english_translation.trim() || undefined;

    const existingRow = existingVocab.get(key);
    const isUpdate = existingRow !== undefined;
    if (isUpdate && !force) {
      continue; // append-only: never clobber live translations
    }

    vocabRows.push({
      word,
      article,
      part_of_speech: pos,
      // Nepali filled by --backfill-nepali (translation_np is NOT NULL).
      // FORCE mode preserves an existing translation instead of blanking it.
      translation_np: existingRow?.translation_np?.trim() ? existingRow.translation_np : '',
      translation_en: en,
      example_de: exampleDe,
      example_en: exampleEn,
      category,
      level,
      tags: [category, 'notebooklm'],
      plural_form: plural,
    });
    if (!isUpdate) insertedKeys.push({ word, part_of_speech: pos });

    // --- content_items payload (NotebookLM review recommendation) ---
    if (existingContentWords.has(word.toLowerCase())) {
      continue; // keep the small vocab-item pool duplicate-free by word
    }
    existingContentWords.add(word.toLowerCase());
    const payload: Record<string, unknown> = {
      id: `nlm-vocab-${entry.id}`,
      de: word,
      en,
      ne: '',
      pos,
      tags: [category, 'notebooklm'],
      level,
      source: 'notebooklm',
    };
    if (exampleDe) payload.exampleDe = exampleDe;
    if (exampleEn) payload.exampleEn = exampleEn;
    if (article) payload.article = article;
    if (plural) payload.plural = plural;
    if (verb) {
      payload.verb = {
        separable: verb.separable,
        auxiliary: verb.auxiliary,
        ...(verb.present3sg ? { present3sg: verb.present3sg } : {}),
        ...(verb.pastParticiple ? { pastParticiple: verb.pastParticiple } : {}),
      };
    }
    contentRows.push({ id: `nlm-vocab-${entry.id}`, content_type: 'vocab-item', payload, sort: 0 });
  }

  return { vocabRows, contentRows, rejected, insertedKeys };
}

// ---------------------------------------------------------------------------
// Nepali backfill — existing Groq/OpenAI batch pattern (localization only,
// never vocabulary invention; romanized Nepali derived locally)
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;
const DEVANAGARI_RE = /[\u0900-\u097F]/;

const groqKey = process.env.GROQ_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const PREFERRED_PROVIDER: 'groq' | 'openai' = groqKey ? 'groq' : 'openai';
/** Active provider — falls back to OpenAI if the Groq key is rejected (401). */
let activeProvider: 'groq' | 'openai' = PREFERRED_PROVIDER;
let MODEL = modelFor(activeProvider);

function modelFor(provider: 'groq' | 'openai'): string {
  return process.env.GEN_MODEL || (provider === 'groq' ? 'openai/gpt-oss-120b' : process.env.OPENAI_MODEL || 'gpt-4o');
}

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  if (activeProvider === 'groq') {
    _client = new OpenAI({ apiKey: groqKey!, baseURL: 'https://api.groq.com/openai/v1' });
  } else {
    if (!openaiKey) throw new Error('Set GROQ_API_KEY or OPENAI_API_KEY');
    _client = new OpenAI({ apiKey: openaiKey });
  }
  return _client;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Call the model with retry on 429 rate limits (same policy as generateA1VocabClusters). */
async function createWithRetry(
  messages: { role: 'system' | 'user'; content: string }[],
  maxAttempts = 5,
): Promise<string> {
  const client = getClient();
  let lastError: Error = new Error('unreachable');
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 2000,
        messages,
      });
      const text = completion.choices[0]?.message?.content;
      if (!text) throw new Error('Empty completion from model');
      return text;
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message;
      // Invalid/revoked key → fall back to the other provider once.
      const isAuthError = msg.includes('401') || /invalid api key|unauthorized/i.test(msg);
      if (isAuthError && activeProvider === 'groq' && openaiKey) {
        console.warn('   ⚠ Groq key rejected (401) — falling back to OpenAI.');
        activeProvider = 'openai';
        MODEL = modelFor(activeProvider);
        _client = null;
        continue;
      }
      const isRateLimit = msg.includes('429') || /rate limit/i.test(msg);
      if (!isRateLimit || attempt === maxAttempts) throw lastError;
      const match = msg.match(/try again in ([\d.]+)s/i);
      const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : attempt * 8000;
      console.warn(`   ⏳ rate limited — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

/** Robust JSON extraction (handles code fences / reasoning preamble). */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error(`Model returned non-JSON: ${text.slice(0, 200)}`);
  }
}

const TRANSLATE_SYSTEM_PROMPT = `You are a localization engineer for MeroDeutsch, a German
learning app for Nepali speakers. You receive German words/phrases together with
their English translations. For EACH item return its Nepali translation.

Return ONLY a JSON object: {"entries": [ ... ]} with one entry per input item,
in the SAME ORDER: {"word": "<the German word/phrase, copied verbatim>", "np": "<Nepali>"}

RULES:
- NEVER invent new German words — copy "word" verbatim from the input.
- "np" MUST be natural spoken NEPALI in Devanagari script — NOT Hindi/Sanskrit
  conventions (e.g. use होइन not नहीं, use Nepali verb forms).
- Keep translations short and learner-appropriate.
- If a word has no sensible Nepali translation, still return the entry with
  your best natural Nepali equivalent.`;

interface NpTarget {
  word: string;
  part_of_speech: string;
}

/** Translate a batch of German words to Nepali; returns word → np. */
async function translateBatch(items: NpTarget[]): Promise<Map<string, string>> {
  const user = `Localize these ${items.length} German item(s) to Nepali. Return ONLY {"entries": [...]} in this exact order:\n${JSON.stringify(
    items.map((i) => ({ word: i.word, en_hint: '' })),
  )}`;
  const text = await createWithRetry([
    { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ]);
  const parsed = extractJson(text) as { entries?: { word?: unknown; np?: unknown }[] };
  const arr = parsed.entries ?? [];
  const out = new Map<string, string>();
  items.forEach((item, idx) => {
    const raw = arr[idx];
    const np = typeof raw?.np === 'string' ? raw.np.trim() : '';
    if (np && np.length <= 255 && DEVANAGARI_RE.test(np)) {
      out.set(`${item.word}|${item.part_of_speech}`, np);
    } else {
      console.warn(`   ⚠ no valid Nepali returned for '${item.word}'`);
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Fetchers (paginated — the live table exceeds the default 1000-row cap)
// ---------------------------------------------------------------------------

interface ExistingVocabRow {
  word: string;
  part_of_speech: string;
  translation_np?: string | null;
}

async function fetchExistingVocab(client: SupabaseClient): Promise<Map<string, ExistingVocabRow>> {
  const map = new Map<string, ExistingVocabRow>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('vocabulary')
      .select('word, part_of_speech, translation_np')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not fetch existing vocabulary: ${error.message}`);
    const rows = (data ?? []) as ExistingVocabRow[];
    for (const row of rows) {
      map.set(`${row.word}|${row.part_of_speech}`, row);
    }
    if (rows.length < PAGE) break;
  }
  return map;
}

async function fetchExistingContentWords(client: SupabaseClient): Promise<Set<string>> {
  const words = new Set<string>();
  const { data, error } = await client
    .from('content_items')
    .select('payload')
    .eq('content_type', 'vocab-item');
  if (error) throw new Error(`Could not fetch existing vocab-item pool: ${error.message}`);
  for (const row of (data ?? []) as { payload: { de?: unknown } | null }[]) {
    const de = row.payload?.de;
    if (typeof de === 'string') words.add(de.toLowerCase());
  }
  return words;
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

function printDistribution(label: string, values: string[]): void {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}: ${n}`)
    .join(', ');
  console.log(`   ${label}: ${summary}`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const backfill = args.has('--backfill-nepali');
  const force = process.env.SEED_FORCE === '1';

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) {
    console.error(
      'Missing Supabase credentials. Set VITE_SUPABASE_URL plus ' +
        'SUPABASE_SERVICE_ROLE_KEY (required for writes) in .env / .env.local',
    );
    process.exit(1);
  }
  if (!serviceKey && apply) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required for --apply (vocabulary is RLS-restricted).');
    process.exit(1);
  }

  const entries = JSON.parse(await fs.readFile(DICTIONARY_FILE, 'utf8')) as NlmEntry[];
  const meta = await parseMetadata();
  console.log(
    `Loaded ${entries.length} dictionary entries, ${meta.nouns.size} noun_metadata rows, ${meta.verbs.size} verb_metadata rows.`,
  );

  const client = createClient(url, serviceKey ?? anonKey!);
  const existingVocab = await fetchExistingVocab(client);
  const existingContentWords = await fetchExistingContentWords(client);
  console.log(
    `Live DB: ${existingVocab.size} vocabulary rows, ${existingContentWords.size} existing vocab-item words.`,
  );

  const { vocabRows, contentRows, rejected } = buildRows(
    entries,
    meta,
    existingVocab,
    existingContentWords,
    force,
  );

  // --- report ---
  console.log('\n──────── Import report ────────');
  printDistribution('source POS', entries.map((e) => e.part_of_speech));
  printDistribution('source CEFR', entries.map((e) => e.cefr_level));
  printDistribution('target category', vocabRows.map((r) => r.category ?? 'general'));
  printDistribution('target level', vocabRows.map((r) => r.level ?? 'A1'));

  const exactDuplicates = entries.length - rejected.length - vocabRows.length;
  console.log(
    `\nvocabulary: ${vocabRows.length} row(s) to write` +
      `${force ? ' [FORCE]' : ''} · ${exactDuplicates} skipped (already in DB) · ${rejected.length} rejected`,
  );
  const conflictWords = new Set(
    vocabRows
      .filter((r) => {
        const wordKey = r.word.toLowerCase();
        return [...existingVocab.values()].some(
          (row) => row.word.toLowerCase() === wordKey && row.part_of_speech !== r.part_of_speech,
        );
      })
      .map((r) => `${r.word}(${r.part_of_speech})`),
  );
  if (conflictWords.size > 0) {
    console.log(`   new-POS variants of existing words: ${[...conflictWords].join(', ')}`);
  }
  console.log(`content_items: ${contentRows.length} 'vocab-item' payload(s) to upsert (ids nlm-vocab-*)`);
  if (rejected.length > 0) {
    console.log('Rejected entries:');
    for (const r of rejected) console.log(`   - ${r}`);
  }

  if (!apply) {
    console.log('\nDRY RUN — no writes performed. Re-run with --apply to import.');
    return;
  }

  // --- Target A: vocabulary ---
  for (const batch of chunk(vocabRows, 200)) {
    const { error } = await client.from('vocabulary').upsert(batch, {
      onConflict: 'word,part_of_speech',
    });
    if (error) {
      console.error(`vocabulary upsert failed: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`\n✓ vocabulary: wrote ${vocabRows.length} row(s).`);

  // --- Target B: content_items ---
  for (const batch of chunk(contentRows, 100)) {
    const { error } = await client.from('content_items').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`content_items upsert failed: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ content_items: upserted ${contentRows.length} 'vocab-item' payload(s).`);

  // --- Nepali backfill ---
  if (!backfill) {
    console.log('\nNepali translations left as "" — re-run with --backfill-nepali to fill them.');
    return;
  }
  if (!groqKey && !openaiKey) {
    console.error('--backfill-nepali needs GROQ_API_KEY or OPENAI_API_KEY in .env.');
    process.exit(1);
  }
  console.log(`\nNepali backfill via ${activeProvider} (${MODEL})…`);
  // Targets: every notebooklm-tagged row with an empty translation (covers
  // fresh inserts AND gaps left by earlier runs — idempotent).
  const { data: nlmRows, error: nlmErr } = await client
    .from('vocabulary')
    .select('word, part_of_speech, translation_np')
    .contains('tags', ['notebooklm'])
    .limit(1000);
  if (nlmErr) {
    console.error(`Could not list notebooklm rows: ${nlmErr.message}`);
    process.exit(1);
  }
  const targets = ((nlmRows ?? []) as { word: string; part_of_speech: string; translation_np?: string | null }[])
    .filter((r) => !r.translation_np || r.translation_np.trim() === '')
    .map((r) => ({ word: r.word, part_of_speech: r.part_of_speech }));
  console.log(`   ${targets.length} row(s) need a Nepali translation.`);

  let translated = 0;
  for (const batch of chunk(targets, BATCH_SIZE)) {
    const translations = await translateBatch(batch);
    for (const [key, np] of translations) {
      const [word, pos] = key.split('|');
      const { error } = await client
        .from('vocabulary')
        .update({ translation_np: np, translation_ne_roman: devanagariToRoman(np) })
        .eq('word', word)
        .eq('part_of_speech', pos);
      if (error) {
        console.error(`   update failed for '${word}' (${pos}): ${error.message}`);
        continue;
      }
      translated += 1;
    }
  }
  console.log(`✓ Nepali backfill: ${translated}/${targets.length} row(s) translated.`);
  console.log('\nImport complete.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});






