/**
 * scripts/enrich-cards.ts  (Phase 1.2)
 *
 * Batch-enriches raw German words into structured `VocabCard` records using the
 * OpenAI Chat Completions API in JSON mode. Designed as a safe, offline-first
 * data pipeline: every result is runtime-validated against the VocabCard schema
 * and only valid entries are emitted to public/data/enriched-vocab.json.
 *
 * Usage:
 *   npm run enrich                              # uses public/data/raw-words.json
 *   npm run enrich -- Tisch Apfel Entschuldigung  # ad-hoc words (CLI args)
 *   ENRICH_BATCH_SIZE=5 npm run enrich          # tune batch size
 *
 * Env (never hardcoded):
 *   OPENAI_API_KEY   (required)  German words -> Nepali-localized cards
 *   OPENAI_MODEL     (optional, default "gpt-4o")
 *
 * NOTE on Devanagari phonetics: the system prompt explicitly trains the model to
 * transcribe German sounds using NEPALI pronunciation habits (not Hindi/Sanskrit
 * conventions), e.g. German /r/ as a flapped र, /ʃ/ as श, /ʒ/ as ज, /y/ as ु/ू.
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import type { VocabCard } from '../src/types';

// ---------------------------------------------------------------------------
// Paths & config
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const INPUT_FILE = path.join(PROJECT_ROOT, 'public', 'data', 'raw-words.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'public', 'data', 'enriched-vocab.json');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const BATCH_SIZE = Math.max(1, Number(process.env.ENRICH_BATCH_SIZE || 10));

const DEFAULT_WORDS = ['Tisch', 'Apfel', 'Entschuldigung', 'Hund', 'schön'];

// ---------------------------------------------------------------------------
// OpenAI client (lazy — so a missing key yields our friendly error, not an SDK
// throw at import time)
// ---------------------------------------------------------------------------
const apiKey = process.env.OPENAI_API_KEY;
let _openai: OpenAI | null = null;
function getOpenai(): OpenAI {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return (_openai ??= new OpenAI({ apiKey }));
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a localization engineer building a German vocabulary
learning app (MeroDeutsch) for Nepali speakers. Your job is to turn raw German
words into fully localized VocabCard objects.

CRITICAL OUTPUT RULES:
- Return ONLY a JSON object with the exact shape: {"cards": [ <VocabCard>, ... ]}
- One card per input word, in the SAME ORDER as the input list.
- Every card MUST match the VocabCard schema exactly (see field list below).
- If a word cannot be enriched, still return a card object with empty strings
  rather than omitting it, so array positions stay aligned.
- Devanagari phonetics (phonetics.devanagari) MUST follow NATURAL NEPALI
  pronunciation habits for German sounds — NOT Hindi/Sanskrit conventions.
  Apply these substitutions:
  * German /r/ (uvular trill/tap) -> Nepali flapped र
  * German /ʁ/ and /χ/ (Bach ch) -> ख (as Nepali speakers hear it)
  * German /ʃ/ (ich-Laut ch/sh) -> श
  * German /ʒ/ -> ज
  * German /y/ and /ʏ/ -> use ु /ू  (Nepali speakers map ü here)
  * German /ø/ and /ɔʏ/ -> use े + उ चिन्ह or ो approximant as is natural
  * German /aɪ̯/ diphthong -> ऐ
  * German /ɔʏ̯/ diphthong -> औ
  * German /aʊ̯/ diphthong -> औ
  * Silent /h/ in "ch" blends (nicht) -> keep as written in Devanagari but mark
  * Do NOT over-Sanskritize: avoid retroflex ट/ठ/ड/ढ where Nepali speakers would
    use dental/tap consonants.

VocabCard schema:
{
  "id": "short-kebab id, e.g. 'noun-tisch'",
  "lemma": "base German word (string)",
  "article": "der" | "die" | "das" | null,
  "plural": "plural form" | null,
  "partOfSpeech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "phrase" | string,
  "cefrLevel": "A1" | "A2" | "B1",
  "translation": { "en": "English", "np": "Nepali" },
  "phonetics": { "ipa": "IPA", "devanagari": "Nepali-devanagari-transliteration" },
  "tags": ["category", "A1"],
  "examples": [ { "de": "German sentence", "en": "English", "np": "Nepali" } ]
}
`;

function userPrompt(words: string[]): string {
  return `Enrich these ${words.length} German word(s) into VocabCard objects.
Return ONLY {"cards": [...]} with one card per word, in this exact order:
${JSON.stringify(words)}`;
}

// ---------------------------------------------------------------------------
// Runtime validator (keeps the pipeline strict & self-healing)
// ---------------------------------------------------------------------------
function isVocabCard(obj: unknown): obj is VocabCard {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;

  if (typeof c.lemma !== 'string' || c.lemma.length === 0) return false;

  const article = c.article;
  if (article !== null && article !== 'der' && article !== 'die' && article !== 'das')
    return false;

  if (c.plural !== null && typeof c.plural !== 'string') return false;

  if (typeof c.partOfSpeech !== 'string') return false;
  if (c.cefrLevel !== 'A1' && c.cefrLevel !== 'A2' && c.cefrLevel !== 'B1') return false;

  const tr = c.translation;
  if (!tr || typeof tr !== 'object') return false;
  if (typeof (tr as Record<string, unknown>).en !== 'string') return false;
  if (typeof (tr as Record<string, unknown>).np !== 'string') return false;

  const ph = c.phonetics;
  if (!ph || typeof ph !== 'object') return false;
  if (typeof (ph as Record<string, unknown>).ipa !== 'string') return false;
  if (typeof (ph as Record<string, unknown>).devanagari !== 'string') return false;

  if (!Array.isArray(c.tags)) return false;
  if (!Array.isArray(c.examples)) return false;

  for (const ex of c.examples as unknown[]) {
    if (!ex || typeof ex !== 'object') return false;
    const e = ex as Record<string, unknown>;
    if (
      typeof e.de !== 'string' ||
      typeof e.en !== 'string' ||
      typeof e.np !== 'string'
    )
      return false;
  }
  return true;
}

/** Synthesize a stable, short kebab-case id from a lemma (used if model omits id). */
function slug(lemma: string, pos: string): string {
  const norm = lemma
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${pos.slice(0, 4)}-${norm}`.replace(/--/g, '-');
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
async function readWords(): Promise<string[]> {
  const cli = process.argv.slice(2);
  if (cli.length > 0) return cli;

  try {
    const raw = await fs.readFile(INPUT_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return parsed.filter(
        (w): w is string => typeof w === 'string' && w.trim().length > 0,
      );
  } catch {
    // input file missing -> fall back to default sample
  }
  console.warn(
    `⚠ No CLI words and no ${path.relative(PROJECT_ROOT, INPUT_FILE)} found — using default sample list.`,
  );
  return DEFAULT_WORDS;
}

// ---------------------------------------------------------------------------
// Core: one LLM call for a chunk of words
// ---------------------------------------------------------------------------
interface ChunkResult {
  cards: VocabCard[];
  failed: string[];
}

async function enrichChunk(words: string[]): Promise<ChunkResult> {
  const openai = getOpenai();

  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.6,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(words) },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Empty completion from model');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Model returned non-JSON: ${text.slice(0, 200)}`);
  }

  const arr =
    parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).cards)
      ? ((parsed as Record<string, unknown>).cards as unknown[])
      : [];

  const cards: VocabCard[] = [];
  const failed: string[] = [];

  words.forEach((word, i) => {
    const raw = arr[i];
    if (isVocabCard(raw)) {
      const base = raw as VocabCard;
      cards.push({
        ...base,
        id: base.id && base.id.length > 0 ? base.id : slug(base.lemma, base.partOfSpeech),
      });
    } else {
      failed.push(word);
    }
  });

  // If model returned FEWER cards than words, the trailing words are failed.
  for (let i = arr.length; i < words.length; i += 1) failed.push(words[i]);

  return { cards, failed };
}

/** Chunk -> enrich, with graceful per-word retry on failure. */
async function enrichWithRetry(words: string[]): Promise<ChunkResult> {
  try {
    return await enrichChunk(words);
  } catch (err) {
    console.warn(
      `⚠ Batch of ${words.length} failed (${(err as Error).message}); falling back to per-word.`,
    );
  }

  // Fallback: one word at a time so one bad apple doesn't sink the whole batch.
  const cards: VocabCard[] = [];
  const failed: string[] = [];
  for (const word of words) {
    try {
      const res = await enrichChunk([word]);
      cards.push(...res.cards);
      if (res.failed.length) failed.push(...res.failed);
    } catch (err) {
      console.error(`❌ Skipping "${word}": ${(err as Error).message}`);
      failed.push(word);
    }
  }
  return { cards, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is required. Set it in .env (see .env.example) or export it:');
    console.error('   npm run enrich');
    process.exit(1);
  }

  const inputWords = await readWords();
  const unique = [...new Set(inputWords.map((w) => w.trim()).filter(Boolean))];
  console.log(
    `🚀 Enriching ${unique.length} word(s) with ${MODEL} (batch=${BATCH_SIZE})...`,
  );

  const allCards: VocabCard[] = [];
  const allFailed: string[] = [];

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(unique.length / BATCH_SIZE);
    console.log(`   • batch ${batchNum}/${totalBatches}: ${chunk.join(', ')}`);
    const { cards, failed } = await enrichWithRetry(chunk);
    allCards.push(...cards);
    allFailed.push(...failed);
  }

  // De-duplicate by id (last write wins, matches a re-enrich workflow).
  const byId = new Map<string, VocabCard>();
  for (const c of allCards) byId.set(c.id, c);
  const final = Array.from(byId.values());

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(final, null, 2), 'utf-8');

  console.log(
    `✅ Wrote ${final.length} enriched card(s) to ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`,
  );
  if (allFailed.length) {
    console.log(`   Failed/skipped (${allFailed.length}): ${allFailed.join(', ')}`);
  } else {
    console.log('   All words enriched successfully.');
  }
}

void main();
