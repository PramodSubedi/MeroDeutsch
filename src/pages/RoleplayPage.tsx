import { useState } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useMilestoneToast } from '../hooks/useMilestoneToast';
import { theme } from '../config/theme';

type Opt = { text: string; ok: boolean; fb: string };
type Step = { npc: string; prompt: string; options: Opt[] };
type Scenario = { id: string; title: string; emoji: string; steps: Step[] };

const SCENARIOS: Scenario[] = [
  {
    id: 'cafe', title: 'Im Café', emoji: '☕',
    steps: [
      { npc: 'Guten Tag! Was möchten Sie?', prompt: 'What do you order?', options: [
        { text: 'Ich hätte gern einen Kaffee, bitte.', ok: true, fb: 'Sehr gut!' },
        { text: 'Wo ist der Bahnhof?', ok: false, fb: 'That is directions, not an order.' },
        { text: 'Ich bin müde.', ok: false, fb: 'True, but you still need to order!' },
      ]},
      { npc: 'Möchten Sie auch etwas zu essen?', prompt: 'What do you answer?', options: [
        { text: 'Nein, danke. Nur den Kaffee.', ok: true, fb: 'Perfekt!' },
        { text: 'Ich heiße Anna.', ok: false, fb: 'That is your name, not about food.' },
      ]},
    ],
  },
  {
    id: 'intro', title: 'Vorstellung', emoji: '👋',
    steps: [
      { npc: 'Hallo! Wie heißt du?', prompt: 'Introduce yourself.', options: [
        { text: 'Ich heiße Pramod. Und du?', ok: true, fb: 'Sehr gut!' },
        { text: 'Ich bin aus Nepal.', ok: false, fb: 'That answers origin, not name.' },
      ]},
      { npc: 'Woher kommst du?', prompt: 'Answer where you are from.', options: [
        { text: 'Ich komme aus Nepal.', ok: true, fb: 'Perfekt!' },
        { text: 'Ich habe Hunger.', ok: false, fb: 'That is about hunger, not origin.' },
      ]},
    ],
  },
  {
    id: 'hotel', title: 'Hotel-Check-in', emoji: '🏨',
    steps: [
      { npc: 'Guten Abend. Haben Sie eine Reservierung?', prompt: 'Answer the hotel clerk.', options: [
        { text: 'Ja, ich habe eine Reservierung.', ok: true, fb: 'Sehr gut!' },
        { text: 'Ich brauche ein Taxi.', ok: false, fb: 'A taxi is not a reservation.' },
      ]},
      { npc: 'Ihr Zimmer ist Nummer 12. Hier ist der Schlüssel.', prompt: 'What do you say?', options: [
        { text: 'Vielen Dank!', ok: true, fb: 'Perfekt!' },
        { text: 'Auf Wiedersehen!', ok: false, fb: 'Thank the clerk first!' },
      ]},
    ],
  },
];

export function RoleplayPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { toast, showToast, dismissToast } = useMilestoneToast();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [correctCount, setCorrectCount] = useState(0);

  const scenario = SCENARIOS[scenarioIdx];
  const step = scenario.steps[stepIdx];
  const isLastStep = stepIdx === scenario.steps.length - 1;
  const isLastScenario = scenarioIdx === SCENARIOS.length - 1;
  const totalSteps = SCENARIOS.reduce((acc, s) => acc + s.steps.length, 0);

  const choose = (opt: Opt) => {
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
        {SCENARIOS.map((s, i) => (
          <button key={s.id} type="button" onClick={() => { setScenarioIdx(i); setStepIdx(0); setStatus('idle'); }} className={i === scenarioIdx ? theme.button.toggleActive : theme.button.toggleInactive}>
            {s.emoji} {s.title}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SCENARIOS.map((s, i) => (
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
