/**
 * src/components/path/DailySession.tsx
 *
 * U1 — Daily learning session (no new modules).
 *
 * A single primary CTA ("Start today's session" / "Weiterlernen") that starts a
 * SHORT daily session:
 *
 *   startSession() behavior (documented):
 *   1. If there are due SRS review items (dueQueue, capped at MAX_REVIEW_ITEMS=8),
 *      the session runs the EXISTING ReviewSessionManager (reused, not rewritten)
 *      in embedded + autoStart mode with a limit of 8. The manager already shows
 *      a summary (Items Reviewed = answered, Promoted = correct) after the batch.
 *   2. After the batch, this component shows a compact "remaining due" summary
 *      plus a "Continue learning" CTA to the next A1 path node.
 *   3. If there are NO due items, the CTA simply navigates to the next A1 path
 *      node (getPushNode()) — no review batch, straight to learning.
 *   4. Bonus nodes never gate; path unlock rules are untouched (useA1Path owns
 *      that). This component only READS dueQueue + getPushNode().
 *
 * Reuses: useReviewQueue (dueQueue, markCorrect),
 *         useA1Path (getPushNode), ReviewSessionManager (existing review UI).
 * No new curriculum types, no Blitz rewrite, no path-unlock rule changes.
 *
 * Nur-DE safe: all new strings are localized via useLang (isDE).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { ReviewSessionManager } from '../ReviewSessionManager';
import { setDailySessionActive } from '../../lib/dailySessionSignal';
import { ANCHORS } from '../../lib/anchors';

/** Cap for the short daily review batch (task: max 8). */
const MAX_REVIEW_ITEMS = 8;

export function DailySession() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const navigate = useNavigate();
  const { getPushNode } = useA1Path();
  const { dueQueue, markCorrect } = useReviewQueue();

  // Local session state: CTA -> review batch -> summary.
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  const dueCount = dueQueue.length;
  const pushNode = getPushNode();

  // U6: tell the global Layout a review batch is active (non-blocking toast
  // for level-ups mid-session). Cleared when the batch ends or unmounts.
  const sessionActive = sessionStarted && dueCount > 0 && !sessionComplete;
  useEffect(() => {
    setDailySessionActive(sessionActive);
    return () => setDailySessionActive(false);
  }, [sessionActive]);

  // startSession(): the single entry point for the primary CTA.
  //  - due items exist -> start the short review batch (max 8) via the
  //    existing ReviewSessionManager (autoStart + limit).
  //  - no due items -> navigate straight to the next A1 path node.
  const startSession = () => {
    if (dueCount > 0) {
      setSessionStarted(true);
      setSessionComplete(false);
    } else if (pushNode) {
      navigate(pushNode.to);
    } else {
      navigate('/learn');
    }
  };

  // Called by ReviewSessionManager after its batch + summary are done.
  // We then show a compact "remaining due" summary + continue CTA.
  const handleComplete = () => {
    setSessionComplete(true);
  };

  const resetSession = () => {
    setSessionStarted(false);
    setSessionComplete(false);
  };

  const answered = Math.min(dueCount, MAX_REVIEW_ITEMS);
  const remainingDue = dueQueue.length;

  // ── Active review batch (reused existing review UI) ──────────────
  if (sessionStarted && dueCount > 0 && !sessionComplete) {
    return (
      <section id={ANCHORS.dailySession} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            {isDE ? 'Heutige Sitzung' : "Today's session"}
          </h2>
        </div>
        <ReviewSessionManager
          queue={dueQueue}
          dueQueue={dueQueue}
          onMarkCorrect={markCorrect}
          onCompleteSession={handleComplete}
          embedded
          limit={MAX_REVIEW_ITEMS}
          autoStart
          completeLabel={isDE ? 'Weiter' : 'Continue'}
        />
      </section>
    );
  }

  // ── Summary step after the review batch ──────────────────────────
  if (sessionComplete) {
    return (
      <section id={ANCHORS.dailySession} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            {isDE ? 'Heutige Sitzung' : "Today's session"}
          </h2>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-950/30">
            <div className="text-2xl" aria-hidden="true">✅</div>
            <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-300">
              {isDE ? 'Sitzung abgeschlossen!' : 'Session complete!'}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              {isDE
                ? `${answered} geprüft · ${remainingDue} noch fällig`
                : `${answered} reviewed · ${remainingDue} still due`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {pushNode && (
              <Link
                to={pushNode.to}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
              >
                🚀 {isDE ? 'Weiterlernen' : 'Continue learning'}
                <span className="truncate text-xs font-medium opacity-90">
                  {isDE ? pushNode.label.de : pushNode.label.en}
                </span>
              </Link>
            )}
            <button
              type="button"
              onClick={resetSession}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              🔁 {isDE ? 'Nochmal üben' : 'Review again'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Default: primary CTA ─────────────────────────────────────────
  return (
    <section id={ANCHORS.dailySession} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? 'Heutige Sitzung' : "Today's session"}
        </h2>
      </div>

      {dueCount > 0 ? (
        <button
          type="button"
          onClick={startSession}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
        >
          🎯 {isDE ? 'Starte die heutige Sitzung' : "Start today's session"}
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold text-white">
            {dueCount}
          </span>
        </button>
      ) : pushNode ? (
        /* 0 due — CTA goes straight to the next path node only. */
        <Link
          to={pushNode.to}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
        >
          🚀 {isDE ? 'Weiterlernen' : 'Continue learning'}
          <span className="truncate text-xs font-medium opacity-90">
            {isDE ? pushNode.label.de : pushNode.label.en}
          </span>
        </Link>
      ) : (
        <Link
          to="/learn"
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          ✅ {isDE ? 'Alles erledigt — zum Lernpfad' : 'All caught up — go to path'}
        </Link>
      )}
    </section>
  );
}