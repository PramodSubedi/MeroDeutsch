/**
 * scripts/extract-vocab.ts  (Phase 0.5 — PDF extraction pipeline)
 *
 * Extracts German vocabulary from the PDF files in `extract_vocab/` and converts
 * them into the legacy batch JSON shape used by `src/data/vocab/*.json`, which in
 * turn feeds `scripts/seedVocab.ts`.
 *
 * The script also appends the raw German lemmas to `scripts/data/raw-words.json`
 * (pipeline intermediate — NOT app data) so the existing
 * `scripts/enrich-cards.ts` pipeline can enrich them with full VocabCard
 * records (phonetics, examples, Nepali translations …).
 *
 * Per-PDF strategy:
 *  • `68532-vocabulary-list-by-topic.pdf`  — GCSE OCR two-column layout.
 *    German words appear in the left column, English translations in the right.
 *    We use positional matching (German count == English count per section).
 *  • All other PDFs — simple "German → English" word lists. We detect pairs
 *    with regex matching a German token optionally followed by its English gloss.
 *
 * Usage:
 *   npm run extract-vocab            # process every PDF in extract_vocab/
 *   npm run extract-vocab -- 68532   # filter by filename keyword
 *
 * Env:
 *   EXTRACT_OUTPUT_DIR  (optional, default: src/data/vocab)
 *   EXTRACT_SKIP_RAW    (optional, default: false) — skip raw-words.json update
 *
 * Requires: `pdf-parse` (already a dependency).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';

// ─────────────────────────────────────────────────────────────────────────────
// Paths & config
// ─────────────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTRACT_DIR = path.resolve(PROJECT_ROOT, 'extract_vocab');
const OUTPUT_DIR = path.resolve(
  PROJECT_ROOT,
  process.env.EXTRACT_OUTPUT_DIR || 'src/data/vocab',
);
// Pipeline intermediate (NOT app data) — lives under scripts/, never public/.
const RAW_WORDS_FILE = path.resolve(PROJECT_ROOT, 'scripts', 'data', 'raw-words.json');

// CEFR level map — inferred from the filename.
const LEVEL_MAP: Record<string, string> = {
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
};

// Topic tags map — inferred from the filename.
const TOPIC_MAP: Record<string, string> = {
  greetings: 'greetings',
  basics: 'greetings',
  food: 'food',
  travel: 'travel',
  restaurant: 'restaurants',
  cafe: 'restaurants',
  bars: 'restaurants',
  bar: 'restaurants',
  vocabulary: 'general',
  wortliste: 'general',
};

/** Infer CEFR level and topic from a PDF filename. */
function inferMeta(filename: string): { level: string; topic: string } {
  const lower = filename.toLowerCase();
  let level = 'A1';
  for (const [key, val] of Object.entries(LEVEL_MAP)) {
    if (lower.includes(key.toLowerCase())) {
      level = val;
      break;
    }
  }
  let topic = 'general';
  for (const [key, val] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(key)) {
      topic = val;
      break;
    }
  }
  return { level, topic };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy batch row shape (matches existing src/data/vocab/*.json)
// ─────────────────────────────────────────────────────────────────────────────
interface LegacyVocabRow {
  id: string;
  de: string;
  en: string;
  ne: string;
  tags: string[];
  level: string;
  exampleDe?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/** Generate a stable kebab-case id from a German lemma + category. */
function makeId(de: string, category: string): string {
  const norm = de
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${category.slice(0, 6)}-${norm}`.replace(/--/g, '-');
}

/** Clean up a word by removing surrounding punctuation. */
function normalizeWord(w: string): string {
  return w
    .replace(/^[()[\]{}"'`]+|[()[\]{}"'`]+$/g, '')
    .replace(/^(-|_|\/|\|)+|(-|_|\/|\|)+$/g, '')
    .trim();
}

// Words that are structural/page markers, not vocabulary.
const MARKERS = new Set([
  'german', 'vocabulary', 'list', 'general', 'ocr', 'copyright',
  'page', 'of', 'contents',
  'topic', 'area', 'home', 'local', 'life', 'friends', 'relationships',
  'facilities', 'getting', 'around', 'health', 'sport', 'outdoor',
  'pursuits', 'healthy', 'lifestyle', 'food', 'drink', 'aspects',
  'culture', 'leisure', 'entertainment', 'includes', 'online',
  'socialising', 'occasions', 'festivals', 'travel', 'wider', 'world',
  'holidays', 'exchanges', 'environmental', 'cultural', 'social',
  'issues', 'education', 'work', 'school', 'uk', 'target', 'language',
  'country', 'community', 'experience', 'future', 'study', 'jobs',
  'working', 'abroad',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Parser 1: GCSE two-column layout (68532-vocabulary-list-by-topic.pdf)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The 68532 PDF uses a two-column layout: left = German, right = English.
 * pdf-parse flattens both columns, so German words appear first, then English
 * translations in corresponding order.
 *
 * Strategy:
 *  1. Split text by "Page N of M" markers.
 *  2. Within each page, find "Foundation" or "Higher" sections.
 *  3. German words follow each section header.
 *  4. English translations follow the German words (we detect the boundary by
 *     language heuristics — English words are predominantly lowercase ASCII).
 *  5. Match German and English entries by position.
 */

// Topic areas mapping for the 68532 PDF.
const TOPIC_AREA_MAP: Record<string, string> = {
  '1': 'home',
  '2': 'health',
  '3': 'leisure',
  '4': 'travel',
  '5': 'education',
};

/** True if a segment looks like a German word. */
function looksGerman(seg: string): boolean {
  if (seg.length === 0) return false;
  // Umlauts or ß are strong German indicators
  if (/[äöüßÄÖÜ]/.test(seg)) return true;
  // Capitalised word (nouns are capitalised in German)
  if (/^[A-Z][a-zA-ZäöüßÄÖÜ]+/.test(seg)) return true;
  // Common German function words
  if (/^(und|oder|zu|nicht|noch|wenn|als|ein|mit|in|aus|vor|nach|bei|seit|wegen|ohne|ist|hat|war|haben|sein|können|wird|wurde|machen|gehen|essen|kommen|sagen|finden|geben|über|unter|von|zu|bei)$/i.test(seg)) {
    return true;
  }
  // Words with hyphens or slashes that contain German
  if (seg.includes('/') || seg.includes('-')) return true;
  return false;
}

/** True if a segment looks like an English word. */
function looksEnglish(seg: string): boolean {
  if (seg.length === 0) return false;
  // Pure ASCII (no umlauts) + starts with lowercase → likely English
  if (!/[äöüßÄÖÜ]/.test(seg) && /^[a-z]/i.test(seg) && seg.length > 1) {
    // Exclude known German function words
    if (/^(und|oder|zu|mit|in|aus|vor|nach|bei|seit|wegen|ohne|ist|hat|war|haben|sein|können|wird|machen|gehen|essen|kommen|sagen|finden|geben)$/i.test(seg)) return false;
    return true;
  }
  return false;
}

/** Extract vocabulary pairs from the 68532-style two-column PDF text. */
function parse68532(text: string): LegacyVocabRow[] {
  const rows: LegacyVocabRow[] = [];
  const segments = text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let currentLevel = 'A1';
  let currentTopic = 'general';
  let germanWords: string[] = [];
  let englishWords: string[] = [];
  let inGermanSection = false;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const lower = seg.toLowerCase();

    // Detect page headers (these delimit sections).
    if (seg === 'Page' && segments[i + 1] && /^\d+$/.test(segments[i + 1])) {
      // Flush current section when we hit a page break.
      if (germanWords.length > 0 && englishWords.length > 0) {
        flushSection(germanWords, englishWords, currentLevel, currentTopic, rows);
      }
      germanWords = [];
      englishWords = [];
      inGermanSection = false;
      i++; // skip the page number
      continue;
    }

    // Detect topic area headers.
    if (seg === 'Topic' && segments[i + 1] === 'Area') {
      const areaNum = segments[i + 2];
      currentTopic = TOPIC_AREA_MAP[areaNum] || 'general';
      i += 2; // skip "Area" and number
      continue;
    }

    // Detect Foundation / Higher tier headers.
    if (lower === 'foundation') {
      currentLevel = 'A1';
      inGermanSection = true;
      continue;
    }
    if (lower === 'higher') {
      currentLevel = 'B1';
      inGermanSection = true;
      continue;
    }

    // Skip structural/marketing words.
    if (MARKERS.has(lower)) continue;

    // Skip standalone punctuation and short tokens.
    if (/^[.,;:!?()[\]{}"'`/|-]+$/.test(seg) || seg.length <= 1) continue;

    // Skip page-number-related tokens.
    if (/^\d+$/.test(seg) && segments[i - 1] === 'of') continue;
    if (lower === 'of' && segments[i - 1] && /^\d+$/.test(segments[i - 1])) continue;

    // Collect German words when in a German section.
    if (inGermanSection && looksGerman(seg)) {
      germanWords.push(seg);
      continue;
    }

    // Detect transition to English section: when we see English-looking words
    // and we've collected German words, switch to English collection mode.
    if (germanWords.length > 0 && looksEnglish(seg)) {
      inGermanSection = false;
      englishWords.push(seg);
      continue;
    }

    // If already in English mode, keep collecting English words.
    if (englishWords.length > 0 && !inGermanSection) {
      // Continue collecting English words until we hit a page break or new section
      if (looksEnglish(seg) || seg.startsWith('(') || seg === 'and' || seg === 'the' || seg === 'of' || seg === 'to' || seg === 'in' || seg === 'a' || seg === 'or' || seg === 'for') {
        englishWords.push(seg);
        continue;
      }
    }
  }

  // Flush any remaining words.
  if (germanWords.length > 0 && englishWords.length > 0) {
    flushSection(germanWords, englishWords, currentLevel, currentTopic, rows);
  }

  return rows;

  function flushSection(
    gWords: string[],
    eWords: string[],
    level: string,
    topic: string,
    out: LegacyVocabRow[],
  ) {
    // Pair up German and English words by position.
    const count = Math.min(gWords.length, eWords.length);
    for (let j = 0; j < count; j++) {
      const de = normalizeWord(gWords[j]);
      const en = normalizeWord(eWords[j]);
      if (de && en && de.length > 0) {
        out.push({
          id: makeId(de, topic),
          de,
          en,
          ne: '',
          tags: [topic, level],
          level,
        });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser 2: Simple "German → English" word lists
// ─────────────────────────────────────────────────────────────────────────────
/**
 * For PDFs that are simple word lists (e.g. "Greetings & Basics",
 * "German Food Vocabulary", etc.), we look for patterns like:
 *
 *   Hallo  —  hello
 *   Danke  —  thank you
 *
 * or tab-separated / newline-separated German→English pairs.
 */
function parseSimpleList(text: string, level: string, topic: string): LegacyVocabRow[] {
  const rows: LegacyVocabRow[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Skip headers and page numbers.
    if (
      /^(Page|©|OCR|GCSE|German|Vocabulary|List|General|Foundation|Higher|Topic|Area|Contents|Spoken|Language|Specification|taught|from)/i.test(
        trimmed,
      )
    )
      continue;
    if (/^\d+$/.test(trimmed)) continue;

    // Try to split on common separators: —, =, :, →, ⟶, tab
    const parts = trimmed.split(/\s*[—=:\u2192\u2193\t]\s*/);
    if (parts.length < 2) continue;

    // First part should be German, second part English.
    const dePart = parts[0].trim();
    const enPart = parts.slice(1).join(' — ').trim();

    if (!dePart || !enPart) continue;

    // Validate that the German part looks like German.
    if (!looksGerman(dePart.split(/\s+/)[0])) continue;

    const de = normalizeWord(dePart.split(/\s+/)[0]);
    const en = normalizeWord(enPart.split(/\s+/)[0]);

    if (de && en && de.length > 1) {
      rows.push({
        id: makeId(de, topic),
        de,
        en,
        ne: '',
        tags: [topic, level],
        level,
      });
    }
  }

  // Deduplicate by German word.
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.de)) return false;
    seen.add(row.de);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const filter = process.argv[2]; // optional filename keyword

  // Ensure output directory exists.
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(RAW_WORDS_FILE), { recursive: true });

  const files = (await fs.readdir(EXTRACT_DIR)).filter((f) => f.endsWith('.pdf'));
  const toProcess = filter
    ? files.filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
    : files;

  if (toProcess.length === 0) {
    console.warn('No PDF files found to process.');
    return;
  }

  console.log(`📄 Found ${toProcess.length} PDF(s) to process:`);
  for (const f of toProcess) console.log(`   • ${f}`);

  const allRows: LegacyVocabRow[] = [];
  const rawWords = new Set<string>();

  for (const filename of toProcess) {
    const filePath = path.join(EXTRACT_DIR, filename);
    const { level, topic } = inferMeta(filename);
    console.log(`\n🔍 Processing: ${filename}  (level=${level}, topic=${topic})`);

    const data = await fs.readFile(filePath);
    const parser = new PDFParse({ data: Buffer.from(data) });
    const res = await parser.getText();
    await parser.destroy();

    if (res.total < 1) {
      console.warn(`   ⚠ No pages found in ${filename}`);
      continue;
    }

    console.log(`   📄 ${res.total} page(s), ${res.text.length} chars of text`);

    let rows: LegacyVocabRow[] = [];
    if (filename.toLowerCase().includes('68532') || filename.toLowerCase().includes('german vocabulary')) {
      // Use the two-column GCSE parser for the 68532 PDF.
      rows = parse68532(res.text);
    } else {
      rows = parseSimpleList(res.text, level, topic);
    }

    // If the primary parser didn't yield results, fall back to simple parser.
    if (rows.length === 0) {
      console.log(`   🔄 Falling back to simple-list parser…`);
      rows = parseSimpleList(res.text, level, topic);
    }

    // Deduplicate within this file.
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      const key = `${r.de}|${r.en}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`   ✅ Extracted ${rows.length} vocabulary entries`);

    allRows.push(...rows);
    for (const r of rows) rawWords.add(r.de);
  }

  // ── Write per-topic JSON files ────────────────────────────────────────────
  // Group by topic for organised output files.
  const byTopic = new Map<string, LegacyVocabRow[]>();
  for (const row of allRows) {
    const tag = row.tags[0] || 'general';
    if (!byTopic.has(tag)) byTopic.set(tag, []);
    byTopic.get(tag)!.push(row);
  }

  for (const [tag, rows] of byTopic) {
    const outPath = path.join(OUTPUT_DIR, `${tag}.json`);
    await fs.writeFile(outPath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(
      `\n💾 Wrote ${rows.length} entries to ${path.relative(PROJECT_ROOT, outPath)}`,
    );
  }

  // ── Update raw-words.json for the enrichment pipeline ─────────────────────
  if (process.env.EXTRACT_SKIP_RAW !== 'true') {
    let existing: string[] = [];
    try {
      existing = JSON.parse(await fs.readFile(RAW_WORDS_FILE, 'utf-8')) as string[];
    } catch {
      // File may not exist yet — that's fine.
    }

    const merged = [...new Set([...existing, ...rawWords])];
    await fs.writeFile(RAW_WORDS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    console.log(
      `\n📝 Updated ${path.relative(PROJECT_ROOT, RAW_WORDS_FILE)}` +
        ` with ${rawWords.size} new unique German word(s) (${merged.length} total).`,
    );
  }

  console.log('\n✅ Extraction complete!');
  console.log(`   Total vocabulary entries: ${allRows.length}`);
  console.log(`   Unique German words: ${rawWords.size}`);
  console.log('\nNext steps:');
  console.log('  1. Run `npm run enrich` to enrich raw words with Nepali translations, phonetics, etc.');
  console.log('  2. Run `npm run seed-vocab` to seed everything into Supabase.');
}

void main().catch((err) => {
  console.error('❌ Extraction failed:', err);
  process.exit(1);
});
