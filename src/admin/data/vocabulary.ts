/**
 * src/admin/data/vocabulary.ts
 *
 * Read model for the Vocabulary section.
 *
 * ── TWO TABLES, NOT ONE ────────────────────────────────────────────────────
 * The app draws vocabulary from BOTH `vocabulary` (1,062 rows: the main
 * dictionary) and `content_items` (601 rows across 15 types, 49 of which are
 * `vocab-item`). A vocabulary screen showing only the first would hide a third
 * of the material the app can serve, so both are loaded and labelled by source.
 *
 * ── READ-ONLY, AND WHY ─────────────────────────────────────────────────────
 * `vocabulary` writes are revoked from `anon` AND `authenticated` (migration
 * 20260928000000_security_lockdown.sql — the table is public-READ by design,
 * because the Glossary reads it before sign-in). An import or an edit therefore
 * needs a service-role function. This module provides the verified read model
 * that such a function would build on, plus CSV/JSON export which needs no
 * write at all.
 */
import { supabase } from '../../lib/supabase';

export type VocabSource = 'vocabulary' | 'content_items';

export interface VocabRow {
  /** Stable key: `${source}:${id}` — ids are NOT unique across the two tables. */
  key: string;
  id: string;
  source: VocabSource;
  word: string;
  article: string | null;
  partOfSpeech: string | null;
  level: string | null;
  tags: string[];
  translationEn: string | null;
  translationNp: string | null;
  exampleDe: string | null;
}

interface RawVocab {
  id: string;
  word: string | null;
  article: string | null;
  part_of_speech: string | null;
  level: string | null;
  tags: string[] | null;
  translation_en: string | null;
  translation_np: string | null;
  example_de: string | null;
}

interface RawContentItem {
  id: string;
  content_type: string;
  payload: unknown;
}

export interface VocabResult {
  rows: VocabRow[];
  errors: string[];
  /** Distinct filter values, derived from the loaded rows so none is a dead end. */
  facets: {
    levels: string[];
    partsOfSpeech: string[];
    tags: string[];
  };
}

const MAX_ROWS = 5000;

/**
 * Pull a display word out of a `content_items` payload.
 *
 * The payload shape varies by `content_type` (a `vocab-item` has `word`, a
 * `number-item` has `label`), so this probes a short list of known keys rather
 * than assuming one schema. A row with no recognisable word is still returned —
 * with its id as the label — so a schema drift shows up as a visibly odd row
 * instead of a silently shorter table.
 */
function wordFromPayload(payload: unknown, fallback: string): {
  word: string;
  article: string | null;
  pos: string | null;
} {
  if (typeof payload !== 'object' || payload === null) {
    return { word: fallback, article: null, pos: null };
  }
  const p = payload as Record<string, unknown>;
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = p[k];
      if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return null;
  };
  return {
    word: pick('word', 'label', 'text', 'german', 'term') ?? fallback,
    article: pick('article'),
    pos: pick('partOfSpeech', 'part_of_speech', 'pos'),
  };
}

export async function fetchVocabulary(): Promise<VocabResult> {
  const errors: string[] = [];

  const [vocab, content] = await Promise.all([
    supabase
      .from('vocabulary')
      .select('id, word, article, part_of_speech, level, tags, translation_en, translation_np, example_de')
      .limit(MAX_ROWS),
    supabase
      .from('content_items')
      .select('id, content_type, payload')
      .eq('content_type', 'vocab-item')
      .limit(MAX_ROWS),
  ]);

  if (vocab.error) errors.push(`vocabulary: ${vocab.error.message}`);
  if (content.error) errors.push(`content_items: ${content.error.message}`);

  const rows: VocabRow[] = [];

  for (const r of (vocab.data ?? []) as RawVocab[]) {
    rows.push({
      key: `vocabulary:${r.id}`,
      id: r.id,
      source: 'vocabulary',
      word: r.word ?? `(row ${r.id.slice(0, 8)})`,
      article: r.article,
      partOfSpeech: r.part_of_speech,
      level: r.level,
      tags: Array.isArray(r.tags) ? r.tags : [],
      translationEn: r.translation_en,
      translationNp: r.translation_np,
      exampleDe: r.example_de,
    });
  }

  for (const r of (content.data ?? []) as RawContentItem[]) {
    const parsed = wordFromPayload(r.payload, r.id);
    rows.push({
      key: `content_items:${r.id}`,
      id: r.id,
      source: 'content_items',
      word: parsed.word,
      article: parsed.article,
      partOfSpeech: parsed.pos,
      // `content_items` has no CEFR column, so level is UNKNOWN rather than
      // invented. A dash is honest; a guessed level is not.
      level: null,
      tags: [],
      translationEn: null,
      translationNp: null,
      exampleDe: null,
    });
  }

  const uniq = (values: (string | null)[]): string[] =>
    Array.from(new Set(values.filter((v): v is string => typeof v === 'string' && v !== ''))).sort();

  return {
    rows,
    errors,
    facets: {
      levels: uniq(rows.map((r) => r.level)),
      partsOfSpeech: uniq(rows.map((r) => r.partOfSpeech)),
      tags: uniq(rows.flatMap((r) => r.tags)),
    },
  };
}

/**
 * RFC 4180 CSV. Every field is quoted, so a German quote or a comma inside a
 * translation cannot shift a column for whoever imports it next.
 */
export function toCsv(rows: VocabRow[]): string {
  const escape = (v: string | null): string => `"${(v ?? '').replace(/"/g, '""')}"`;
  const header = [
    'source', 'id', 'word', 'article', 'pos', 'level',
    'tags', 'translation_en', 'translation_np', 'example_de',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escape(r.source),
        escape(r.id),
        escape(r.word),
        escape(r.article),
        escape(r.partOfSpeech),
        escape(r.level),
        escape(r.tags.join(' ')),
        escape(r.translationEn),
        escape(r.translationNp),
        escape(r.exampleDe),
      ].join(',')
    );
  }
  return lines.join('\n');
}
