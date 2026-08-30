import { BookA, BookOpen, Flag, Library, Lock, RefreshCw, Zap } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * Hero option A — "App frame collage".
 *
 * One browser frame containing three stacked UI slices (Home session bar,
 * A1 path strip, practice tools row) so visitors instantly read "this is an
 * app", not a blog. Guest-safe: purely presentational — no links, no auth,
 * no router. Rendered inside an aria-hidden container on the landing page.
 */
export function HeroOptionA() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className="relative w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
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

      <div className="space-y-3 p-4">
        {/* Slice 1 — Home session bar */}
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {isDE ? 'Heute' : 'Today'}
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {isDE ? 'Wiederholung' : 'Warm-up'}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {isDE ? '5 fällig' : '5 due'}
              </span>
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
              <span className="text-xs text-slate-400">{isDE ? '2 Min.' : '2 min'}</span>
            </div>
          </div>
        </div>

        {/* Slice 2 — A1 path strip (sign-in-gated: later steps shown locked) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <BookOpen className="h-3.5 w-3.5" />
            {isDE ? 'A1-Lernpfad' : 'A1 path'}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="flex h-7 items-center rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white">
              {isDE ? 'Begrüßung' : 'Greetings'}
            </span>
            {[
              'Alphabet',
              isDE ? 'Zahlen' : 'Numbers',
              isDE ? 'Zeit' : 'Time',
            ].map((step) => (
              <span
                key={step}
                className="flex h-7 items-center gap-1 rounded-lg bg-slate-200/70 px-2.5 text-xs font-semibold text-slate-400 dark:bg-slate-700 dark:text-slate-500"
              >
                <Lock className="h-3 w-3" />
                {step}
              </span>
            ))}
          </div>
        </div>

        {/* Slice 3 — practice tools row */}
        <div className="flex gap-2">
          {[
            { icon: BookA, label: isDE ? 'Alphabet' : 'Alphabet' },
            { icon: Zap, label: isDE ? 'Blitz' : 'Blitz' },
            { icon: Library, label: isDE ? 'Glossar' : 'Glossary' },
          ].map((tool) => (
            <span
              key={tool.label}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <tool.icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              {tool.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}