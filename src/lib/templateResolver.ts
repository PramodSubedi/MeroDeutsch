/**
 * Dynamic sentence and exercise resolution engine for MeroDeutsch.
 * This is the first migration step toward the entity/template architecture
 * described in the project planning docs, while keeping compatibility with the
 * current content-pool service layer.
 */

import { shuffleArray } from '../utils/shuffleArray';
import type {
  LexicalEntity,
  ResolvedExerciseTemplate,
  ResolvedVocabularyQuestion,
  VocabularyQuestionVariant,
} from '../types/curriculum';
import type { VocabCard } from '../types';

const SUBJECT_EN_MAP: Record<string, string> = {
  ich: 'I',
  du: 'You',
  er: 'He',
  sie: 'She',
  wir: 'We',
  Sie: 'You (formal)',
};

const SUBJECT_NE_MAP: Record<string, string> = {
  ich: 'म',
  du: 'तिमी',
  er: 'उनी',
  sie: 'उनी',
  wir: 'हामी',
  Sie: 'तपाईं',
};

const VERB_CONJUGATIONS: Record<string, string> = {
  ich: 'komme',
  du: 'kommst',
  er: 'kommt',
  sie: 'kommt',
  wir: 'kommen',
  Sie: 'kommen',
};

export class TemplateResolver {
  static fromVocabularyCard(card: VocabCard): LexicalEntity {
    const gender = card.article === 'der'
      ? 'masculine'
      : card.article === 'die'
        ? 'feminine'
        : card.article === 'das'
          ? 'neuter'
          : 'none';
    return {
      id: card.id,
      category: 'vocabulary',
      lemma: card.lemma,
      partOfSpeech: card.partOfSpeech,
      gender,
      article: card.article,
      plural: card.plural,
      cefrLevel: card.cefrLevel,
      examples: card.examples.map((example) => ({
        de: example.de,
        en: example.en,
        ne: example.np,
      })),
      translations: { en: card.translation.en, ne: card.translation.np },
    };
  }

  static generateVocabularyQuestion(
    target: LexicalEntity,
    pool: ReadonlyArray<LexicalEntity>,
    requestedVariant: VocabularyQuestionVariant
  ): ResolvedVocabularyQuestion {
    let variant = requestedVariant;
    let prompt: string;
    let correctAnswer: string;
    let candidates: string[];

    const article = target.article ?? (target.gender === 'masculine'
      ? 'der'
      : target.gender === 'feminine'
        ? 'die'
        : target.gender === 'neuter'
          ? 'das'
          : null);

    if (variant === 'article' && article) {
      prompt = target.lemma;
      correctAnswer = article;
      candidates = ['der', 'die', 'das'];
    } else if (variant === 'plural' && target.plural && target.plural !== '-') {
      prompt = target.lemma;
      correctAnswer = target.plural;
      candidates = pool.map((entity) => entity.plural ?? '');
    } else {
      if (variant === 'article' || variant === 'plural') variant = 'de-to-en';
      if (variant === 'en-to-de') {
        prompt = target.translations.en;
        correctAnswer = target.lemma;
        candidates = pool.map((entity) => entity.lemma);
      } else {
        prompt = target.lemma;
        correctAnswer = target.translations.en;
        candidates = pool.map((entity) => entity.translations.en);
      }
    }

    const decoys = shuffleArray(Array.from(new Set(candidates.filter((answer) => answer && answer !== correctAnswer))))
      .slice(0, 3);
    return {
      id: `vocab-${variant}-${target.id}`,
      targetId: target.id,
      variant,
      prompt,
      correctAnswer,
      options: shuffleArray([...decoys, correctAnswer]),
    };
  }

  static resolveOriginStatement(
    subjectToken: 'ich' | 'du' | 'er' | 'sie' | 'wir' | 'Sie',
    countryEntity: LexicalEntity,
    distractorCountries: ReadonlyArray<LexicalEntity> = []
  ): ResolvedExerciseTemplate {
    const conjugatedVerb = VERB_CONJUGATIONS[subjectToken] ?? 'komme';
    const prepPhrase = countryEntity.caseGovernance?.prep_aus ?? 'aus';
    const countryLemma = countryEntity.lemma;

    const sentenceDe = `${this.capitalize(subjectToken)} ${conjugatedVerb} ${prepPhrase} ${countryLemma}.`;
    const sentenceEn = `${SUBJECT_EN_MAP[subjectToken] ?? 'I'} ${subjectToken === 'er' || subjectToken === 'sie' ? 'comes' : 'come'} from ${countryEntity.translations.en}.`;
    const sentenceNe = `${SUBJECT_NE_MAP[subjectToken] ?? 'म'} ${countryEntity.translations.ne}बाट आएको/आएकी हुँ।`;

    const prepTokens = prepPhrase.split(' ');
    const correctOrder = [this.capitalize(subjectToken), conjugatedVerb, ...prepTokens, countryLemma];
    const distractors = shuffleArray(
      distractorCountries.map((country) => country.lemma).filter((lemma) => lemma !== countryLemma)
    ).slice(0, 3);

    return {
      id: `dyn-origin-${subjectToken}-${countryEntity.id}`,
      sentenceDe,
      sentenceEn,
      sentenceNe,
      tokens: shuffleArray([...correctOrder, ...distractors.slice(0, 2)]),
      distractors,
      correctOrder,
      targetWord: countryLemma,
    };
  }

  static generateOriginExercises(
    countries: ReadonlyArray<LexicalEntity>,
    subjects: Array<'ich' | 'du' | 'er' | 'sie' | 'wir' | 'Sie'>,
    limit = 6
  ): ResolvedExerciseTemplate[] {
    const mutableCountries = [...countries];
    const chosenCountries = shuffleArray(mutableCountries).slice(0, Math.max(1, Math.min(limit, countries.length)));
    const exercises: ResolvedExerciseTemplate[] = [];

    for (const country of chosenCountries) {
      const subject = subjects[Math.floor(Math.random() * subjects.length)] ?? 'ich';
      const distractors = chosenCountries.filter((entry) => entry.id !== country.id);
      exercises.push(this.resolveOriginStatement(subject, country, distractors));
    }

    return exercises.slice(0, limit);
  }

  private static capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
