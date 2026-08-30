import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Flag, Users, Zap } from 'lucide-react';
import { useLang } from '../hooks/useLang';

/**
 * Self-contained, presentational preview of the guest Home daily loop.
 *
 * Used by LandingPage's `HeroMock` — renders WITHOUT auth context so the
 * landing "try as guest" CTA shows a real, representative Home surface.
 * It reads LangMode internally via useLang (works at route level, no provider
 * dependency beyond the one already mounted in main.tsx).
 *
   * Data is representative mock data only — no hooks into the real A1 path
 * state here. The real GuestHomePage stays the source of truth for live
 * guest sessions.
 */
export function AppHomePreview() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className="flex flex-col gap-3">
      {/* Warm-up (review due) */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {isDE ? 'Wiederholung' : 'Review'}
          </span>
        </div>
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {isDE ? '5 Fächer' : '5 due'}
        </span>
      </div>

      {/* Push (next path node) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-1 flex items-center gap-2">
          <Flag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isDE ? 'Als Nächstes' : 'Next up'}
          </span>
        </div>
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {isDE ? 'A1 · Einheit 1 — Begrüßeungen' : 'A1 · Unit 1 — Greetings'}
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isDE ? 'Alltagsvokabeln & Artikel' : 'Everyday vocab & articles'}
        </div>
      </div>

      {/* Challenge (Blitz) */}
      <Link
        to="/rapid-fire"
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 no-underline transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
      >
        <span className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {isDE ? 'Schnelltest' : 'Rapid Blitz'}
        </span>
        <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </Link>

      {/* Mini path spine (locked states) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isDE ? 'Lernpfad' : 'A1 Path'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {['Guten Tag', isDE ? 'Anrede' : 'Articles', isDE ? 'Zahlen' : 'Numbers', isDE ? 'Zeit' : 'Time', isDE ? 'Navigation' : 'Navigation'].map(
            (word, idx) => {
              const locked = idx > 0;
              return (
                <span
                  key={word}
                  className={`
                    flex h-7 items-center justify-center rounded-lg px-2.5 text-xs font-semibold
                    ${
                      locked
                        ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    }
                  `}
                                    title={locked ? (isDE ? 'Gesperrt' : 'Locked') : word}
                >
                  {word}
                </span>
              );
            }
          )}
        </div>
            </div>
    </div>
  );
}
