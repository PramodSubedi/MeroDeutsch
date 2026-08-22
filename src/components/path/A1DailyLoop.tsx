/**
 * src/components/path/A1DailyLoop.tsx
 *
 * Logged-in Home daily loop (Part F): Warm-up -> Push -> Challenge.
 *  - Warm-up: shown only when due SRS items exist -> existing
 *    /dashboard?sprint=true review session (never invents /review).
 *  - Push: first incomplete node within unlocked units (route or checkpoint
 *    route) via useA1Path.getPushNode().
 *  - Challenge: existing /rapid-fire Rapid Blitz (no engine rewrite).
 *
 * Wired to the REAL userId through useA1Path (user?.userId ?? 'guest').
 * Guest: Unit 1 visible; later units locked; sign-in prompt to save path.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { useAuth } from '../../hooks/useAuth';
import { useReviewQueue } from '../../hooks/useReviewQueue';

export function A1DailyLoop() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { getPushNode, userId, unlockedUnitIndex } = useA1Path();
  const { dueQueue } = useReviewQueue();

  const dueCount = dueQueue.length;
  const pushNode = getPushNode();

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? 'Dein Tagesablauf' : 'Your daily loop'}
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          {isDE ? `Einheit ${unlockedUnitIndex + 1} freigeschaltet` : `Unit ${unlockedUnitIndex + 1} unlocked`}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {/* 1. Warm-up — only when due items exist; else hidden (falls back to Push) */}
        {dueCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/dashboard?sprint=true')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50/60 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 active:scale-95 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
          >
            🔥 {isDE ? 'Aufwärmen' : 'Warm-up'}
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-600 px-1.5 text-xs font-bold text-white">
              {dueCount}
            </span>
          </button>
        )}

        {/* 2. Push — next unlocked incomplete node */}
        {pushNode ? (
          <Link
            to={pushNode.to}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
          >
            🚀 {isDE ? 'Weiter' : 'Push'}
            <span className="truncate text-xs font-medium opacity-90">
              {isDE ? pushNode.label.de : pushNode.label.en}
            </span>
          </Link>
        ) : (
          <span className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            ✅ {isDE ? 'Alles erledigt!' : 'All caught up!'}
          </span>
        )}

        {/* 3. Challenge — existing Rapid Blitz */}
        <Link
          to="/rapid-fire"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800 transition hover:bg-indigo-100 active:scale-95 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
        >
          ⚡ {isDE ? 'Blitz' : 'Challenge'}
        </Link>
      </div>

      {!isAuthenticated && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Du lernst als Gast — '
            : 'You are learning as a guest — '}
          <Link to="/auth" className="font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-300">
            {isDE ? 'melde dich an, um den Pfad zu speichern' : 'sign in to save your path'}
          </Link>
          {' · '}
          <span className="font-mono text-[10px]">{userId}</span>
        </p>
      )}
    </section>
  );
}