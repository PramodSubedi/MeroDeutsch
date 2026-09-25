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
  'articles',
  'core',
  'notebooklm',
  'unit-2',
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
  if (/^gender-(der|die|das)$/.test(t.toLowerCase())) return false;
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
  return getTopicalTags(tags)[0];
}

/** Returns every topical tag while preserving its stored order. */
export function getTopicalTags(tags: readonly string[] | undefined | null): string[] {
  return tags ? [...new Set(tags.map((tag) => tag.trim()).filter(isTopicalTag))] : [];
}

const TOPIC_LABELS: Record<string, { en: string; de: string }> = {
  'abstract-concepts': { en: 'Abstract concepts', de: 'Abstrakte Begriffe' },
  'action-verbs': { en: 'Action verbs', de: 'Handlungsverben' },
  alphabet: { en: 'Alphabet', de: 'Alphabet' },
  'body-health': { en: 'Body and health', de: 'Körper und Gesundheit' },
  clothing: { en: 'Clothing', de: 'Kleidung' },
  'city-travel': { en: 'City and travel', de: 'Stadt und Reisen' },
  colors: { en: 'Colors', de: 'Farben' },
  'daily-routine': { en: 'Daily routine', de: 'Tagesablauf' },
  'describing-adjectives': { en: 'Describing adjectives', de: 'Beschreibende Adjektive' },
  'doctor-shopping-phrases': { en: 'Doctor and shopping phrases', de: 'Beim Arzt und Einkaufen' },
  education: { en: 'Education', de: 'Bildung' },
  'education-work': { en: 'Education and work', de: 'Bildung und Beruf' },
  family: { en: 'Family', de: 'Familie' },
  food: { en: 'Food', de: 'Lebensmittel' },
  'food-drink': { en: 'Food and drink', de: 'Essen und Trinken' },
  greetings: { en: 'Greetings', de: 'Begrüßungen' },
  housing: { en: 'Housing', de: 'Wohnen' },
  'hobby-verbs': { en: 'Hobby verbs', de: 'Verben zu Hobbys' },
  'kitchen-household': { en: 'Kitchen and household', de: 'Küche und Haushalt' },
  'nature-time': { en: 'Nature and time', de: 'Natur und Zeit' },
  nature: { en: 'Nature', de: 'Natur' },
  numbers: { en: 'Numbers', de: 'Zahlen' },
  people: { en: 'People', de: 'Menschen' },
  personal: { en: 'Personal information', de: 'Persönliche Angaben' },
  'school-office': { en: 'School and office', de: 'Schule und Büro' },
  'smalltalk-phrases': { en: 'Small talk', de: 'Smalltalk' },
  'taste-texture-adjectives': { en: 'Taste and texture', de: 'Geschmack und Beschaffenheit' },
  time: { en: 'Time', de: 'Zeit' },
  travel: { en: 'Travel', de: 'Reisen' },
  'travel-questions': { en: 'Travel questions', de: 'Fragen zum Reisen' },
  weather: { en: 'Weather', de: 'Wetter' },
  'weather-wishes': { en: 'Weather and wishes', de: 'Wetter und Wünsche' },
  work: { en: 'Work', de: 'Beruf' },
  professions: { en: 'Professions', de: 'Berufe' },
};

/** Localized display label; the untranslated tag remains the filter value. */
export function topicalTagLabel(tag: string, isDE: boolean): string {
  const known = TOPIC_LABELS[tag.toLowerCase()];
  if (known) return isDE ? known.de : known.en;
  const readable = tag.replace(/[-_]+/g, ' ');
  return isDE ? readable : readable.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
