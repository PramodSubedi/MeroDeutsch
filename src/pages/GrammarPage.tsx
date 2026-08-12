import { useState, useEffect } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { GrammarDrill } from '../types/curriculum';

const CONJUGATIONS = {
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

const CASES = [
  { label: 'Nominativ', de: 'Wer? (subject)', en: 'The subject of the sentence' },
  { label: 'Akkusativ', de: 'Wen? (direct object)', en: 'The direct object' },
] as const;

type DrillItem = { prompt: string; options: string[]; correct: string };
type DrillKey = 'sein' | 'haben' | 'weakVerb' | 'cases';

const DRILLS: Record<DrillKey, GrammarDrill[]> = {
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

export function GrammarPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  const [tab, setTab] = useState<'sein' | 'haben' | 'weakVerb' | 'cases'>('sein');
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [drills, setDrills] = useState<GrammarDrill[]>([]);

  useEffect(() => {
    curriculumService.getGrammarDrills(tab).then(setDrills);
  }, [tab]);

  const count = Object.keys(answers).length;
  const allDone = count === drills.length;
  const score = drills.filter((d, i) => answers[i] === d.correct).length;

  const choose = (qi: number, opt: string) => {
    const next = { ...answers, [qi]: opt };
    setAnswers(next);
    if (opt !== drills[qi].correct) {
      addWrongAnswer({ moduleType: 'grammar', itemKey: drills[qi].prompt, userAnswer: opt, correctAnswer: drills[qi].correct });
    }
  };

  const tabBtn = (id: 'sein' | 'haben' | 'weakVerb' | 'cases', label: string) => (
    <button type="button" onClick={() => { setTab(id); setAnswers({}); }} className={tab === id ? theme.button.toggleActive : theme.button.toggleInactive}>
      {label}
    </button>
  );

  const table = tab === 'cases' ? null : undefined;

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isDE ? 'Grammatik' : 'Grammar'}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDE ? 'A1-Grammatik: sein, haben, regelmäßige Verben & Fälle.' : 'A1 grammar: sein, haben, weak verbs & cases.'}
      </p>

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        {tabBtn('sein', 'sein')}
        {tabBtn('haben', 'haben')}
        {tabBtn('weakVerb', isDE ? 'machen' : 'machen')}
        {tabBtn('cases', isDE ? 'Fälle' : 'Cases')}
      </div>

      <div className={`${theme.panel.surface} mb-6`}>
        <h2 className="text-lg font-semibold">{isDE ? 'Fälle' : 'Cases'}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CASES.map((c) => (
            <div key={c.label} className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/40">
              <div className="font-bold text-blue-700 dark:text-blue-300">{c.label}</div>
              <div className="mt-1 text-slate-600 dark:text-slate-300">{isDE ? c.de : c.en}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${theme.panel.surface}`}>
        <h2 className="text-lg font-semibold">{isDE ? 'Mini-Übung' : 'Mini-drill'} — {count}/{drills.length}</h2>
        <div className="mt-3 space-y-4">
          {drills.map((d, i) => (
            <div key={d.prompt}>
              <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{d.prompt}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {d.options.map((opt) => {
                  const chosen = answers[i] === opt;
                  const ok = d.correct === opt;
                  let cls = theme.button.pill;
                  if (chosen && ok) cls += ' border-green-500 bg-green-100 text-green-800';
                  else if (chosen && !ok) cls += ' border-red-500 bg-red-100 text-red-800';
                  return <button key={opt} type="button" className={cls} onClick={() => choose(i, opt)}>{opt}</button>;
                })}
              </div>
            </div>
          ))}
          {allDone && (
            <div className={`rounded-xl p-3 text-sm font-semibold ${score === drills.length ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
              {isDE ? `Ergebnis: ${score}/${drills.length}` : `Score: ${score}/${drills.length}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}