import { useState, useEffect } from 'react';
import { BookText, Check, RefreshCw, Layout } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useXp } from '../hooks/useXp';
import { TabGroup } from '../components/TabGroup';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { GrammarDrill } from '../types/curriculum';

const CASES = [
  { label: 'Nominativ', de: 'Wer? (subject)', en: 'The subject of the sentence' },
  { label: 'Akkusativ', de: 'Wen? (direct object)', en: 'The direct object' },
] as const;

export function GrammarPage() {
  usePageTitle('Grammar');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();
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
    if (opt === drills[qi].correct) {
      // +10 XP for a correct grammar drill answer (first selection only)
      if (answers[qi] !== opt) reportAnswer({ correct: true, module: 'grammar' });
    } else {
      addWrongAnswer({ moduleType: 'grammar', itemKey: drills[qi].prompt, userAnswer: opt, correctAnswer: drills[qi].correct });
    }
  };


  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isDE ? 'Grammatik' : 'Grammar'}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDE ? 'A1-Grammatik: sein, haben, regelmäßige Verben & Fälle.' : 'A1 grammar: sein, haben, weak verbs & cases.'}
      </p>

      <TabGroup
        tabs={[
          { id: 'sein', label: 'sein', icon: BookText },
          { id: 'haben', label: 'haben', icon: Check },
          { id: 'weakVerb', label: 'machen', icon: RefreshCw },
          { id: 'cases', label: isDE ? 'Fälle' : 'Cases', icon: Layout },
        ]}
        activeTab={tab}
        onChange={(newTab) => { setTab(newTab); setAnswers({}); }}
      />

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