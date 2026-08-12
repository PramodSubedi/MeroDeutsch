import type { GrammarItem, GrammarDrill } from '../types/curriculum';

export const CONJUGATIONS = {
  sein: {
    title: 'sein (to be)',
    rows: [
      ['ich bin', 'I am'],
      ['du bist', 'you are'],
      ['er/sie/es ist', 'he/she/it is'],
      ['wir sind', 'we are'],
      ['ihr seid', 'you all are'],
      ['sie/Sie sind', 'they/you are'],
    ],
  },
  haben: {
    title: 'haben (to have)',
    rows: [
      ['ich habe', 'I have'],
      ['du hast', 'you have'],
      ['er/sie/es hat', 'he/she/it has'],
      ['wir haben', 'we have'],
      ['ihr habt', 'you all have'],
      ['sie/Sie haben', 'they/you are'],
    ],
  },
  weakVerb: {
    title: 'Weak verb pattern: machen (to do/make)',
    rows: [
      ['ich mach-e', 'I do'],
      ['du mach-st', 'you do'],
      ['er/sie/es mach-t', 'he/she/it does'],
      ['wir mach-en', 'we do'],
      ['ihr mach-t', 'you all do'],
      ['sie/Sie mach-en', 'they/you do'],
    ],
  },
} as const;

export const CASES = [
  { label: 'Nominativ', de: 'Wer? (subject)', en: 'The subject of the sentence' },
  { label: 'Akkusativ', de: 'Wen? (direct object)', en: 'The direct object' },
] as const;

export const DRILLS: Record<string, GrammarDrill[]> = {
  sein: [
    { prompt: 'Ich ___ Student.', options: ['bin', 'bist', 'ist'], correct: 'bin' },
    { prompt: 'Du ___ nett.', options: ['bin', 'bist', 'ist'], correct: 'bist' },
    { prompt: 'Er ___ müde.', options: ['bin', 'bist', 'ist'], correct: 'ist' },
    { prompt: 'Wir ___ hier.', options: ['sind', 'seid', 'ist'], correct: 'sind' },
    { prompt: 'Ihr ___ Freunde.', options: ['sind', 'seid', 'bin'], correct: 'seid' },
  ],
  haben: [
    { prompt: 'Ich ___ ein Buch.', options: ['habe', 'hast', 'hat'], correct: 'habe' },
    { prompt: 'Du ___ einen Stift.', options: ['habe', 'hast', 'hat'], correct: 'hast' },
    { prompt: 'Sie ___ eine Schwester.', options: ['habe', 'hast', 'hat'], correct: 'hat' },
    { prompt: 'Wir ___ Hunger.', options: ['haben', 'habt', 'hat'], correct: 'haben' },
    { prompt: 'Ihr ___ Zeit.', options: ['haben', 'habt', 'hast'], correct: 'habt' },
  ],
  weakVerb: [
    { prompt: 'Ich ___ Kaffee. (machen)', options: ['mache', 'machst', 'macht'], correct: 'mache' },
    { prompt: 'Du ___ die Arbeit. (machen)', options: ['mache', 'machst', 'macht'], correct: 'machst' },
    { prompt: 'Er ___ Sport. (machen)', options: ['mache', 'machst', 'macht'], correct: 'macht' },
    { prompt: 'Wir ___ Musik. (machen)', options: ['machen', 'macht', 'mache'], correct: 'machen' },
    { prompt: 'Ihr ___ Hausaufgaben. (machen)', options: ['machen', 'macht', 'mache'], correct: 'macht' },
  ],
  cases: [
    { prompt: 'Der Mann sieht ___ Frau. (who receives?)', options: ['den Mann', 'die Frau'], correct: 'die Frau' },
    { prompt: 'Ich habe ___ Bruder. (direct object)', options: ['einen', 'ein'], correct: 'einen' },
    { prompt: '___ Tisch ist groß. (subject)', options: ['Der', 'Den'], correct: 'Der' },
    { prompt: 'Wir kaufen ___ Buch. (direct object)', options: ['das', 'die'], correct: 'das' },
    { prompt: 'Sie liebt ___ Hund. (direct object)', options: ['einen', 'ein'], correct: 'einen' },
  ],
};
