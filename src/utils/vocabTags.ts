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

/* ==========================================================================
   THEMEN — coarse German-semantic grouping over the fine-grained tags
   ========================================================================== */

/**
 * A Thema is the learner's coarse mental bucket ("Essen & Trinken"), while the
 * stored English tags stay the fine-grained filter values ("food", "food-drink",
 * "kitchen-household"). Two levels on purpose:
 *
 *   - `tags[]` is what the DATA stores. It is derived from the import sources
 *     (NotebookLM clusters, PDF extracts) and cannot be renamed without touching
 *     ~1000 rows and every historical review_queue item_key.
 *   - The Thema is a PRESENTATION layer on top: a stable, small, human set a
 *     beginner can actually hold in their head, mapped onto whichever English
 *     tags happen to exist. New tags get a Thema by adding one line to
 *     `TAG_THEME` below; no data migration.
 *
 * This is why there is no `vokabel_themen` table: the grouping is a pure
 * function of the tag, and a table would just be a second source of truth that
 * the client still has to read and keep in sync.
 */
export interface Thema {
  /** Stable machine id, also the grouping key. */
  id: string;
  /** German label — shown in Nur-Deutsch mode. */
  de: string;
  /** English label. */
  en: string;
  /** Lucide-free emoji used as the group's visual marker. */
  emoji: string;
}

/**
 * The canonical A1 Thema set, ordered roughly like a course syllabus so the
 * Glossary filter reads top-to-bottom in a sensible progression.
 */
export const THEMEN: readonly Thema[] = [
  { id: 'people',       de: 'Menschen',        en: 'People',           emoji: '\u{1F465}' },
  { id: 'family',       de: 'Familie',         en: 'Family',           emoji: '\u{1F46A}' },
  { id: 'food',         de: 'Essen & Trinken', en: 'Food & Drink',     emoji: '\u{1F372}' },
  { id: 'home',         de: 'Haus & Wohnen',   en: 'Home & Living',    emoji: '\u{1F3E0}' },
  { id: 'city',         de: 'Stadt & Wege',    en: 'City & Getting Around', emoji: '\u{1F5FA}\uFE0F' },
  { id: 'travel',       de: 'Reisen',          en: 'Travel',           emoji: '\u2708\uFE0F' },
  { id: 'work',         de: 'Arbeit & Beruf',  en: 'Work & Jobs',      emoji: '\u{1F4BB}' },
  { id: 'school',       de: 'Schule & Lernen', en: 'School & Learning',emoji: '\u{1F393}' },
  { id: 'time',         de: 'Zeit & Kalender', en: 'Time & Calendar',  emoji: '\u23F0' },
  { id: 'nature',       de: 'Natur & Wetter',  en: 'Nature & Weather', emoji: '\u{1F31E}' },
  { id: 'health',       de: 'Gesundheit & Körper', en: 'Health & Body',  emoji: '\u{1FA7A}' },
  { id: 'shopping',     de: 'Einkaufen',       en: 'Shopping',         emoji: '\u{1F6D2}' },
  { id: 'clothes',      de: 'Kleidung',        en: 'Clothing',         emoji: '\u{1F455}' },
  { id: 'communication',de: 'Sprechen',        en: 'Communication',    emoji: '\u{1F4AC}' },
  { id: 'actions',      de: 'Handlungen',      en: 'Actions',          emoji: '\u270B' },
  { id: 'describing',   de: 'Beschreibungen',  en: 'Describing',       emoji: '\u{1F3AD}' },
  { id: 'general',      de: 'Allgemein',       en: 'General',          emoji: '\u{1F4D6}' },
] as const;

/** Fallback bucket for a topical tag with no explicit mapping. */
export const DEFAULT_THEMA_ID = 'general';

/**
 * Every fine-grained tag -> its Thema. This is the only place a new tag needs to
 * be registered. Keys are lower-cased; lookup is case-insensitive.
 *
 * Deliberately flat and one-to-one: a tag belongs to exactly one Thema so the
 * counts in the Glossary filter never double-count a word across groups.
 */
const TAG_THEME: Record<string, Thema['id']> = {
  // people / family
  people: 'people',
  personal: 'people',
  family: 'family',
  professions: 'work',

  // food
  food: 'food',
  'food-drink': 'food',
  'taste-texture-adjectives': 'food',

  // home
  housing: 'home',
  'kitchen-household': 'home',

  // city + travel
  'city-travel': 'city',
  'travel': 'travel',
  'travel-questions': 'travel',

  // work / school
  work: 'work',
  'education-work': 'work',
  'education': 'school',
  'school-office': 'school',

  // time
  time: 'time',
  'nature-time': 'time',
  'daily-routine': 'time',

  // nature
  nature: 'nature',
  weather: 'nature',
  'weather-wishes': 'nature',
  colors: 'nature',

  // health
  'body-health': 'health',
  'doctor-shopping-phrases': 'health',

  // shopping / clothes
  clothing: 'clothes',

  // communication
  greetings: 'communication',
  alphabet: 'communication',
  'smalltalk-phrases': 'communication',

  // adjectives / verbs / abstractions
  'action-verbs': 'actions',
  'hobby-verbs': 'actions',
  'describing-adjectives': 'describing',
  'abstract-concepts': 'general',
  numbers: 'general',
};

/** The Thema record for an id, falling back to the general bucket. */
export function themaById(id: string): Thema {
  return THEMEN.find((t) => t.id === id) ?? THEMEN[THEMEN.length - 1];
}

/**
 * The Thema a fine-grained tag belongs to. Non-topical tags (POS, CEFR level,
 * gender, unit markers) return undefined so callers can ignore them entirely
 * rather than double-classify structural noise as a topic.
 */
export function themaForTag(tag: string): Thema | undefined {
  if (!isTopicalTag(tag)) return undefined;
  return themaById(TAG_THEME[tag.trim().toLowerCase()] ?? DEFAULT_THEMA_ID);
}

/**
 * The Thema for a card, chosen from its first topical tag. A card whose tags are
 * all structural resolves to the general bucket rather than undefined, so every
 * card belongs to exactly one group and group counts sum to the total.
 */
export function themaForTags(tags: readonly string[] | null | undefined): Thema {
  for (const tag of getTopicalTags(tags)) {
    const t = TAG_THEME[tag.trim().toLowerCase()];
    if (t) return themaById(t);
  }
  return themaById(DEFAULT_THEMA_ID);
}

/**
 * Collapse a set of topical tags into their distinct Themen, preserving the
 * canonical syllabus order from `THEMEN` rather than tag order — so the filter
 * list is stable no matter which tag happened to be seen first.
 */
export function themenForTags(tags: readonly string[] | null | undefined): Thema[] {
  const ids = new Set(getTopicalTags(tags).map((t) => TAG_THEME[t.trim().toLowerCase()] ?? DEFAULT_THEMA_ID));
  return THEMEN.filter((t) => ids.has(t.id));
}