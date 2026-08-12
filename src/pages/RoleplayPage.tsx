import { useEffect, useState } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useMilestoneToast } from '../hooks/useMilestoneToast';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { RoleplayScenario, RoleplayOption } from '../types/curriculum';

export function RoleplayPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { toast, showToast, dismissToast } = useMilestoneToast();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [correctCount, setCorrectCount] = useState(0);
  const [scenarios, setScenarios] = useState<RoleplayScenario[]>([]);

  useEffect(() => {
    curriculumService.getRoleplayScenarios().then(setScenarios);
  }, []);

  const scenario = scenarios[scenarioIdx];
  if (!scenario) return null;

  const step = scenario.steps[stepIdx];
  const isLastStep = stepIdx === scenario.steps.length - 1;
  const isLastScenario = scenarioIdx === scenarios.length - 1;
  const totalSteps = scenarios.reduce((acc, s) => acc + s.steps.length, 0);

  const choose = (opt: RoleplayOption) => {
    if (status !== 'idle') return;
    if (opt.ok) {
      setStatus('correct');
      setCorrectCount((c) => c + 1);
      if (isLastStep && isLastScenario) {
        showToast({ message: isDE ? 'Alle Szenarien geschafft! 🎉' : 'All scenarios complete! 🎉', icon: '🏅' });
      }
    } else {
      setStatus('wrong');
      showToast({ message: opt.fb, icon: '💡' });
    }
  };

  const next = () => {
    if (isLastStep) {
      if (isLastScenario) { setScenarioIdx(0); setStepIdx(0); setCorrectCount(0); }
      else { setScenarioIdx((s) => s + 1); setStepIdx(0); }
    } else {
      setStepIdx((s) => s + 1);
    }
    setStatus('idle');
  };

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isDE ? 'Rollenspiele' : 'Role-play'} 🎭</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{isDE ? 'Übe Alltagsgespräche auf Deutsch.' : 'Practice everyday German conversations.'}</p>

      {toast && (
        <div className="mb-4 mt-2 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <span>{toast.icon} {toast.message}</span>
          <button type="button" onClick={dismissToast} className="text-amber-500 hover:text-amber-700" aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {scenarios.map((s, i) => (
          <button key={s.id} type="button" onClick={() => { setScenarioIdx(i); setStepIdx(0); setStatus('idle'); }} className={i === scenarioIdx ? theme.button.toggleActive : theme.button.toggleInactive}>
            {s.emoji} {s.title}
          </button>
        ))}
      </div>

      <div className={`${theme.panel.surface} mx-auto mt-4 max-w-xl`}>
        <div className="mb-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{isDE ? 'Punkte' : 'Score'}: <b className="text-slate-900 dark:text-white">{correctCount}</b> / {totalSteps}</span>
          <span>{isDE ? 'Schritt' : 'Step'} {stepIdx + 1}/{scenario.steps.length}</span>
        </div>

        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">👤 {step.npc}</div>
            <button type="button" onClick={() => speakWord(step.npc)} className={theme.button.icon} aria-label="Speak">🔊</button>
          </div>
        </div>

        <div className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">{step.prompt}</div>

        <div className="space-y-2">
          {step.options.map((opt) => {
            let cls = theme.button.pill + ' w-full text-left';
            if (status === 'correct' && opt.ok) cls += ' border-green-500 bg-green-100 text-green-800';
            else if (status === 'wrong' && opt.ok) cls += ' opacity-50';
            return (
              <button
                key={opt.text}
                type="button"
                className={cls}
                onClick={() => choose(opt)}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        {status !== 'idle' && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${status === 'correct' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
              {status === 'correct' ? (isDE ? '✅ Richtig!' : '✅ Correct!') : (isDE ? '❌ Nicht ganz.' : '❌ Not quite.')}
            </div>
            <button type="button" onClick={next} className={theme.button.primary}>
              {isDE ? 'Weiter →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
