/**
 * src/data/genderPronouns.ts
 *
 * Gender → personal-pronoun quick-fire data for the Articles page "Pronomen"
 * matching mode (der → er · die → sie · das → es).
 *
 * Same role as a1Verbs.ts / uhrzeit.ts: client-side UI data, hand-verified,
 * NOT a database seed. Family/person nouns keep the rule concrete (NotebookLM
 * workbook mechanic) and include the classic Mädchen trap (das, not die).
 * Devanagari glosses follow the app's NE-bridge convention (hidden in Nur DE).
 */

export interface GenderPronounItem {
  /** Bare noun (no article). */
  noun: string;
  /** Definite article — the gender cue. */
  article: 'der' | 'die' | 'das';
  /** Matching personal pronoun. */
  pronoun: 'er' | 'sie' | 'es';
  en: string;
  ne: string;
  /** Optional teaching note (trap warnings etc.). */
  note?: string;
}

export const GENDER_PRONOUNS: GenderPronounItem[] = [
  { noun: 'Mann', article: 'der', pronoun: 'er', en: 'man', ne: 'पुरुष' },
  { noun: 'Frau', article: 'die', pronoun: 'sie', en: 'woman', ne: 'महिला' },
  { noun: 'Kind', article: 'das', pronoun: 'es', en: 'child', ne: 'बच्चा' },
  { noun: 'Vater', article: 'der', pronoun: 'er', en: 'father', ne: 'बुबा' },
  { noun: 'Mutter', article: 'die', pronoun: 'sie', en: 'mother', ne: 'आमा' },
  { noun: 'Bruder', article: 'der', pronoun: 'er', en: 'brother', ne: 'दाजु/भाइ' },
  { noun: 'Schwester', article: 'die', pronoun: 'sie', en: 'sister', ne: 'दिदी/बहिनी' },
  { noun: 'Baby', article: 'das', pronoun: 'es', en: 'baby', ne: 'शिशु' },
  { noun: 'Freund', article: 'der', pronoun: 'er', en: 'friend (m)', ne: 'साथी (पुरुष)' },
  { noun: 'Freundin', article: 'die', pronoun: 'sie', en: 'friend (f)', ne: 'साथी (महिला)' },
  {
    noun: 'Mädchen',
    article: 'das',
    pronoun: 'es',
    en: 'girl',
    ne: 'केटी',
    note: 'Trap: -chen nouns are ALWAYS das — even Mädchen!',
  },
  {
    noun: 'Lehrerin',
    article: 'die',
    pronoun: 'sie',
    en: 'teacher (f)',
    ne: 'शिक्षिका',
    note: '-in endings mark female persons → die.',
  },
];