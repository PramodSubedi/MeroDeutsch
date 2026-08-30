import { useEffect, useState } from 'react';
import { ArrowRight, Check, Flag, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/** Cycle speed per frame (ms) — a calm 4-step, ~7.6s loop. */
const FRAME_MS = 1900;

/**
 * Hero option B — "Looping demo".
 *
 * A silent 4-frame loop (Home → Start → quiz feedback → reward) that sells
 * "interactive" without a video asset. Pure CSS/JS: the interval pauses under
 * prefers-reduced-motion and a static first frame is shown instead. A real
 * <video> can later be dropped into the same slot.
 *
 * Guest-safe: presentational only, no links, no auth.
 */
export function HeroOptionB() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [frame, setFrame] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    if (mq.matches) return undefined;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 4), FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  const frames = [
    // Frame 0 — Home daily loop
    <div key="home" className="space-y-1.5">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          {isDE ? 'Wiederholung' : 'Warm-up'}
        </span>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{isDE ? '5 fällig' : '5 due'}</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Flag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          {isDE ? 'Einheit 1 · Begrüßungen' : 'Unit 1 · Greetings'}
        </span>
        <span className="text-xs text-slate-400">{isDE ? 'als Nächstes' : 'next'}</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          {isDE ? 'Schnelltest' : 'Rapid Blitz'}
        </span>
        <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>
    </div>,

    // Frame 1 — tap Start → path node card
    <div key="start" className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-500 dark:text-blue-400">
        {isDE ? 'A1-Lernpfad' : 'A1 path'}
      </p>
      <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
        {isDE ? 'Einheit 1 · Begrüßungen' : 'Unit 1 · Greetings'}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {isDE ? 'Alltagsvokabeln von Anfang an' : 'Everyday words from day one'}
      </p>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white">
        {isDE ? 'Jetzt starten' : 'Start now'}
        <ArrowRight className="h-4 w-4" />
      </div>
    </div>,

    // Frame 2 — quick quiz + instant feedback (vocab, NOT article chips)
    <div key="quiz" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {isDE ? 'Schnelltest' : 'Quick quiz'}
      </p>
      <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">Guten Tag</p>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between rounded-lg border-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300">
          {isDE ? 'Hallo' : 'Hello'}
          <Check className="h-4 w-4" />
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 dark:border-slate-700">
          {isDE ? 'Auf Wiedersehen' : 'Goodbye'}
        </div>
      </div>
    </div>,

    // Frame 3 — reward feedback
    <div key="reward" className="rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800">
      <Sparkles className="mx-auto h-8 w-8 text-amber-500" />
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">+10 XP</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDE ? 'Richtig! Weiter so.' : 'Correct! Keep going.'}
      </p>
    </div>,
  ];

  const shown = reduced ? frames[0] : (frames[frame] ?? frames[0]);

  return (
    <div className="relative w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      {/* Browser chrome */}
      <div className="flex items-center justify-between rounded-t-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">merodeutsch.app</p>
        <span className="w-12" />
      </div>

      <div className="min-h-[300px] p-4">
        {/* key forces a remount per frame → the entrance animation replays */}
        <div key={reduced ? 'static' : frame} className="animate-in fade-in slide-in-from-right-2 duration-300">
          {shown}
        </div>
      </div>

      {/* Frame dots */}
      <div className="flex items-center justify-center gap-1.5 pb-4">
        {frames.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === frame && !reduced ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}