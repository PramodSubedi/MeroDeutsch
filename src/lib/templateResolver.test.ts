import { TemplateResolver } from './templateResolver';
import type { VocabCard } from '../types';
import { getTopicalTags, topicalTagLabel } from '../utils/vocabTags';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const country = {
  id: 'country:schweiz',
  category: 'country',
  lemma: 'Schweiz',
  partOfSpeech: 'noun',
  gender: 'feminine',
  caseGovernance: { prep_aus: 'aus der' },
  translations: { en: 'Switzerland', ne: 'स्वित्जरल्याण्ड' },
} as const;

const result = TemplateResolver.resolveOriginStatement('ich', country, []);
assert(result.sentenceDe === 'Ich komme aus der Schweiz.', 'Feminine country sentence should resolve to aus der.');
assert(result.targetWord === 'Schweiz', 'Target word should be the country lemma.');
assert(result.tokens.includes('Ich'), 'Sentence tokens should include the subject.');
assert(result.tokens.includes('komme'), 'Sentence tokens should include the verb.');

const countries = [
  { id: 'country:nepal', category: 'country', lemma: 'Nepal', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'Nepal', ne: 'नेपाल' } },
  { id: 'country:schweiz', category: 'country', lemma: 'Schweiz', partOfSpeech: 'noun', gender: 'feminine', caseGovernance: { prep_aus: 'aus der' }, translations: { en: 'Switzerland', ne: 'स्वित्जरल्याण्ड' } },
  { id: 'country:deutschland', category: 'country', lemma: 'Deutschland', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'Germany', ne: 'जर्मनी' } },
] as const;

const exercises = TemplateResolver.generateOriginExercises(countries, ['ich', 'du'], 2);
assert(exercises.length === 2, 'Exercise generation should honor the requested limit.');
assert(exercises.every((exercise) => exercise.sentenceDe.includes('komme') || exercise.sentenceDe.includes('kommst')), 'Generated exercises should always include a valid verb form.');

const vocabCards: VocabCard[] = [
  {
    id: 'word:apfel', lemma: 'Apfel', article: 'der', plural: 'Äpfel', partOfSpeech: 'noun',
    cefrLevel: 'A1', translation: { en: 'apple', np: 'स्याउ' }, phonetics: { ipa: '', devanagari: '' },
    tags: ['food'], examples: [],
  },
  {
    id: 'word:haus', lemma: 'Haus', article: 'das', plural: 'Häuser', partOfSpeech: 'noun',
    cefrLevel: 'A1', translation: { en: 'house', np: 'घर' }, phonetics: { ipa: '', devanagari: '' },
    tags: ['home'], examples: [],
  },
  {
    id: 'word:lernen', lemma: 'lernen', article: null, plural: null, partOfSpeech: 'verb',
    cefrLevel: 'A1', translation: { en: 'learn', np: 'सिक्नु' }, phonetics: { ipa: '', devanagari: '' },
    tags: ['verbs'], examples: [],
  },
];
const entities = vocabCards.map(TemplateResolver.fromVocabularyCard);
const articleQuestion = TemplateResolver.generateVocabularyQuestion(entities[0], entities, 'article');
assert(articleQuestion.correctAnswer === 'der', 'Article questions should use the canonical noun article.');
assert(articleQuestion.options.includes('der'), 'Article options should include the correct article.');

const pluralQuestion = TemplateResolver.generateVocabularyQuestion(entities[0], entities, 'plural');
assert(pluralQuestion.correctAnswer === 'Äpfel', 'Plural questions should use the canonical plural form.');

const translationQuestion = TemplateResolver.generateVocabularyQuestion(entities[0], entities, 'en-to-de');
assert(translationQuestion.prompt === 'apple', 'English-to-German questions should prompt with the English translation.');
assert(translationQuestion.options.includes('Apfel'), 'English-to-German options should contain the German lemma.');

const fallbackQuestion = TemplateResolver.generateVocabularyQuestion(entities[2], entities, 'article');
assert(fallbackQuestion.variant === 'de-to-en', 'Unsupported article questions should fall back to a translation question.');

const topicalTags = getTopicalTags(['A1', 'noun', 'food-drink', 'notebooklm', 'unit-2', 'core', 'gender-der']);
assert(topicalTags.length === 1 && topicalTags[0] === 'food-drink', 'Source and structural tags must not be exposed as topics.');
assert(topicalTagLabel('food-drink', true) === 'Essen und Trinken', 'German UI should show localized theme labels.');
