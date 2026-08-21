/**
 * Rapid Blitz – Section Data Structures
 *
 * Each exported constant represents a pool of four A1‑level challenge items
 * for the corresponding challenge type.  The shape of each item matches the
 * interfaces used by `useRapidBlitzMultiChallenge`.
 */
export const VOCAB_TRANSLATION_QUESTIONS = [
  {
    id: 'vocab-trans-1',
    type: 'vocabulary-translation',
    timeLimit: 5000,
    english: 'apple',
    german: 'apfel',
    options: ['apfel', 'haus', 'Auto'],
  },
  {
    id: 'vocab-trans-2',
    type: 'vocabulary-translation',
    timeLimit: 5000,
    english: 'water',
    german: 'wasser',
    options: ['Wasser', 'Brot', 'Hund'],
  },
  {
    id: 'vocab-trans-3',
    type: 'vocabulary-translation',
    timeLimit: 5000,
    english: 'friend',
    german: 'Freund',
    options: ['Freundin', 'Freund', 'Frei'],
  },
  {
    id: 'vocab-trans-4',
    type: 'vocabulary-translation',
    timeLimit: 5000,
    english: 'book',
    german: 'Buch',
    options: ['Buch', 'Baum', 'Bank'],
  },
];

export const AUDIO_COMPREHENSION_QUESTIONS = [
  {
    id: 'audio-comp-1',
    type: 'audio-comprehension',
    timeLimit: 6000,
    word: 'Haus',
    meaning: 'house',
    options: ['house', 'home', 'yard'],
  },
  {
    id: 'audio-comp-2',
    type: 'audio-comprehension',
    timeLimit: 6000,
    word: 'Buch',
    meaning: 'book',
    options: ['book', 'table', 'chair'],
  },
  {
    id: 'audio-comp-3',
    type: 'audio-comprehension',
    timeLimit: 6000,
    word: 'Freund',
    meaning: 'friend',
    options: ['friend', 'teacher', 'doctor'],
  },
  {
    id: 'audio-comp-4',
    type: 'audio-comprehension',
    timeLimit: 6000,
    word: 'Wasser',
    meaning: 'water',
    options: ['water', 'milk', 'juice'],
  },
];

export const ARTICLE_PRECISION_QUESTIONS = [
  {
    id: 'article-1',
    type: 'article-precision',
    timeLimit: 4000,
    noun: 'Apfel',
    article: 'der',
  },
  {
    id: 'article-2',
    type: 'article-precision',
    timeLimit: 4000,
    noun: 'Tisch',
    article: 'der',
  },
  {
    id: 'article-3',
    type: 'article-precision',
    timeLimit: 4000,
    noun: 'Tür',
    article: 'die',
  },
  {
    id: 'article-4',
    type: 'article-precision',
    timeLimit: 4000,
    noun: 'Haus',
    article: 'das',
  },
];

export const NUMBER_CONVERSION_QUESTIONS = [
  {
    id: 'number-1',
    type: 'number-conversion',
    timeLimit: 5000,
    number: 5,
    germanText: 'fünf',
    direction: 'digit-to-text',
    options: ['fünf', 'zehn', 'eins'],
  },
  {
    id: 'number-2',
    type: 'number-conversion',
    timeLimit: 5000,
    number: 12,
    germanText: 'zwölf',
    direction: 'text-to-digit',
    options: ['12', '21', '2'],
  },
  {
    id: 'number-3',
    type: 'number-conversion',
    timeLimit: 5000,
    number: 20,
    germanText: 'zwanzig',
    direction: 'digit-to-text',
    options: ['zwanzig', 'fünfzehn', 'dreißig'],
  },
  {
    id: 'number-4',
    type: 'number-conversion',
    timeLimit: 5000,
    number: 30,
    germanText: 'dreißig',
    direction: 'text-to-digit',
    options: ['30', '31', '20'],
  },
];

export const VERB_CONJUGATION_QUESTIONS = [
  {
    id: 'verb-1',
    type: 'verb-conjugation',
    timeLimit: 5000,
    pronoun: 'ich',
    verb: 'sein',
    conjugated: 'bin',
    options: ['bin', 'bist', 'ist'],
  },
  {
    id: 'verb-2',
    type: 'verb-conjugation',
    timeLimit: 5000,
    pronoun: 'du',
    verb: 'haben',
    conjugated: 'hast',
    options: ['habe', 'hast', 'hat'],
  },
  {
    id: 'verb-3',
    type: 'verb-conjugation',
    timeLimit: 5000,
    pronoun: 'er',
    verb: 'machen',
    conjugated: 'macht',
    options: ['mache', 'macht', 'machen'],
  },
  {
    id: 'verb-4',
    type: 'verb-conjugation',
    timeLimit: 5000,
    pronoun: 'wir',
    verb: 'gehen',
    conjugated: 'gehen',
    options: ['gehe', 'gehen', 'geht'],
  },
];

export const PRONUNCIATION_READING_QUESTIONS = [
  {
    id: 'pron-1',
    type: 'pronunciation-reading',
    timeLimit: 7000,
    text: 'Haus',
    meaning: 'house',
    audio: 'Haus',
    options: ['Haus', 'Hase', 'Haut'],
  },
  {
    id: 'pron-2',
    type: 'pronunciation-reading',
    timeLimit: 7000,
    text: 'Buch',
    meaning: 'book',
    audio: 'Buch',
    options: ['Buch', 'Baden', 'Burg'],
  },
  {
    id: 'pron-3',
    type: 'pronunciation-reading',
    timeLimit: 7000,
    text: 'Freund',
    meaning: 'friend',
    audio: 'Freund',
    options: ['Freund', 'Früh', 'Frei'],
  },
  {
    id: 'pron-4',
    type: 'pronunciation-reading',
    timeLimit: 7000,
    text: 'Wasser',
    meaning: 'water',
    audio: 'Wasser',
    options: ['Wasser', 'Wald', 'Werk'],
  },
];