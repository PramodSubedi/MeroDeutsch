/**
 * src/data/templateCountries.ts
 *
 * The tiny, hand-authored country pool used by TemplateResolver's
 * "origin statement" exercises — "Ich komme aus Nepal." and its distractors.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * The list was copy-pasted into two pages and the copies had already DRIFTED:
 *
 *   SentenceBuilderPage  — 5 countries (incl. Türkei)
 *   A1CheckpointPage    — 4 countries (Türkei missing)
 *
 * So the Gate A fallback pool quietly offered one fewer distractor than the
 * sentence builder did, and there was no way to notice except by diffing two
 * page files. One list, one truth, both consumers import it.
 *
 * It is intentionally NOT a database table: origin statements are a fixed
 * closed-class frame, every slot is grammatical on its own, and keeping it
 * local means the fallback keeps working offline and pre-seed.
 *
 * `caseGovernance.prep_aus` carries the contracted form ("aus der Schweiz")
 * because that is the part a template sentence actually has to get right.
 */

import type { LexicalEntity } from '../types/curriculum';

export const TEMPLATE_COUNTRIES: LexicalEntity[] = [
  { id: 'country:nepal', category: 'country', lemma: 'Nepal', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'Nepal', ne: 'नेपाल' } },
  { id: 'country:schweiz', category: 'country', lemma: 'Schweiz', partOfSpeech: 'noun', gender: 'feminine', caseGovernance: { prep_aus: 'aus der' }, translations: { en: 'Switzerland', ne: 'स्वित्जरल्याण्ड' } },
  { id: 'country:deutschland', category: 'country', lemma: 'Deutschland', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'Germany', ne: 'जर्मनी' } },
  { id: 'country:indien', category: 'country', lemma: 'Indien', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'India', ne: 'भारत' } },
  { id: 'country:turkei', category: 'country', lemma: 'Türkei', partOfSpeech: 'noun', gender: 'feminine', caseGovernance: { prep_aus: 'aus der' }, translations: { en: 'Turkey', ne: 'टर्की' } },
];