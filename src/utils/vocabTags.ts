/**
 * Shared vocabulary tag classifier.
 *
 * Single source of truth for deciding whether a vocab card's tag is a *topical*
 * category (e.g. 'numbers', 'food', 'travel') versus a structural tag that
 * describes the word itself (part of speech, CEFR level, target language,
 * gender, misc grouping). Used by the Glossary (chip + filter-source badges),
 * the Vocab Trainer (filter options + category passthrough), and the clipboard
 * flag — so every surface classifies tags exactly the same way.
 *
 * Structural tags are deliberately *not* deleted from the DB or from
 * `card.tags` — they are harmless to filters — but they must never surface as
 * a "category/badge" user-facing value. That decision lives here and only here.
 */

/** Part-of-speech tags (English, as used across the vocab batches). */
const POS_TAGS = new Set([
  'verb',
  'noun',
  'adjective',
  'adverb',
  'preposition',
  'pronoun',
  'conjunction',
  'interjection',
  'numeral',
  'particle',
  'phrase',
  'abbreviation',
  'expression',
  'questionword',
  'modalverb',
  'auxiliary',
]);

/** CEFR level tags, e.g. 'A1', 'a1' (case-insensitive). */
const LEVEL_RE = /^[ab][12]$/i;

/** Structural tags from the cluster/gender/unit passes that are not topics. */
const STRUCTURAL_TAGS = new Set([
  'general',
  'unit1',
  'unit2',
  'unit3',
  'unit4',
  'unit5',
  'der',
  'die',
  'das',
  'pl',
  'plural',
  'germany',
]);

/**
 * True when `tag` is a real topical category a learner can filter by.
 * Categories are expected to be short English noun-ish topic names.
 */
export function isTopicalTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;
  const t = tag.trim();
  if (t.length < 2) return false;
  if (POS_TAGS.has(t.toLowerCase())) return false;
  if (LEVEL_RE.test(t)) return false;
  if (STRUCTURAL_TAGS.has(t.toLowerCase())) return false;
  // Junk fragments from bad backfills (e.g. '8/15/26,').
  if (/[0-9/,_]/.test(t)) return false;
  return true;
}

/**
 * Returns the first topical tag in `tags` (in array order), or undefined when
 * the card has no topical category. This is what surfaces as the Glossary
 * "category" badge and the Trainer's category filter source.
 */
export function firstTopicalTag(tags: readonly string[] | undefined | null): string | undefined {
  if (!tags) return undefined;
  for (const t of tags) {
    if (isTopicalTag(t)) return t;
  }
  return undefined;
}
