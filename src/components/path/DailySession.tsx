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
import { useHasA1Campaign } from '../../hooks/usePremium';
import { useLastModule } from '../../hooks/useLastModule';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { labelForPath } from '../../config/routeLabels';
import { resolvePushTarget } from '../../lib/pushTarget';
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
  const { hasCampaign } = useHasA1Campaign();
  const { getLastModule } = useLastModule();
  const { dueQueue, markCorrect } = useReviewQueue();

  // Local session state: CTA -> review batch -> summary.
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  const dueCount = dueQueue.length;
  const a1PushNode = getPushNode();

  /**
   * The "Push" target, resolved for THIS tier.
   *
   * Premium gets the A1 campaign's next node ("Next: Greetings", a `/lesson/:n`
   * route). A free signed-in learner has no campaign, so the A1 push node would
   * be a dead end pointing into a curriculum they cannot see - their /learn is
   * the `LearningPath` roadmap. Their push target is instead the module they
   * last opened (`useLastModule`, which falls back to `/alphabet`), labelled
   * from the shared `ROUTE_LABELS` so the six roadmap modules read correctly in
   * both languages. `labelForPath` returns '' for an unknown path, in which case
   * we drop the label rather than render a blank.
   *
   * The CAMPAIGN case is delegated to `resolvePushTarget`, the same helper
   * `/learn` uses for its Resume button, so the finished state reads identically
   * on both surfaces. That also fixes the self-link this used to have: a learner
   * sitting on Home was offered "All caught up - go to path" linking back to
   * Home, which is a button that goes nowhere.
   */
  const continueTarget = hasCampaign
    ? resolvePushTarget(a1PushNode, isDE)
    : (() => {
        const to = getLastModule();
        const label = labelForPath(to, isDE);
        return { to, label: label || null, isComplete: false };
      })();

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
    } else if (continueTarget) {
      navigate(continueTarget.to);
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
      <section id={ANCHORS.dailySession} className="rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:bg-ink-900 dark:border-ink-800">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
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
    // `aria-live="polite"` on the summary: finishing the batch is an
    // asynchronous state change the user did not navigate to, so without a
    // live region a screen-reader user is told nothing - the CTA they just
    // pressed silently replaced itself with a success panel and two new
    // buttons. `polite` (not `assertive`) because it is a confirmation, not
    // an error, and it must not interrupt whatever is still being read.
      <section
        id={ANCHORS.dailySession}
        role="status"
        aria-live="polite"
        className="rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:bg-ink-900 dark:border-ink-800"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
            {isDE ? 'Heutige Sitzung' : "Today's session"}
          </h2>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg bg-success-50 p-4 text-center dark:bg-success-950/30">
            <div className="text-2xl" aria-hidden="true">✅</div>
            <p className="mt-1 text-body font-bold text-success-800 dark:text-success-300">
              {isDE ? 'Sitzung abgeschlossen!' : 'Session complete!'}
            </p>
            <p className="mt-1 text-meta text-success-700 dark:text-success-400">
              {isDE
                ? `${answered} geprüft · ${remainingDue} noch fällig`
                : `${answered} reviewed · ${remainingDue} still due`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {continueTarget && (
              <Link
                to={continueTarget.to}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-3 text-body font-bold text-white shadow-sm transition hover:bg-accent-700 active:scale-95"
              >
                🚀 {isDE ? 'Weiterlernen' : 'Continue learning'}
                {continueTarget.label && (
                  <span className="truncate text-meta font-medium opacity-90">
                    {continueTarget.label}
                  </span>
                )}
              </Link>
            )}
            <button
              type="button"
              onClick={resetSession}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-body font-bold text-ink-700 transition hover:bg-ink-50 active:scale-95 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
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
    <section id={ANCHORS.dailySession} className="rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:bg-ink-900 dark:border-ink-800">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
          {isDE ? 'Heutige Sitzung' : "Today's session"}
        </h2>
      </div>

      {dueCount > 0 ? (
        <button
          type="button"
          onClick={startSession}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-3 text-body font-bold text-white shadow-sm transition hover:bg-accent-700 active:scale-95"
        >
          🎯 {isDE ? 'Starte die heutige Sitzung' : "Start today's session"}
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-1.5 text-meta font-bold text-white">
            {dueCount}
          </span>
        </button>
      ) : continueTarget.isComplete ? (
        /* The campaign is finished. This used to be a `continueTarget ? ... : ...`
           fallback pointing at A1_PATH_ROUTE, which on Home is a link back to
           the page already open - a dead button. `resolvePushTarget` sends it to
           the CEFR level grid instead, matching /learn's Resume button exactly. */
        <Link
          to={continueTarget.to}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-body font-bold text-success-800 transition hover:bg-success-100 active:scale-95 dark:border-success-900/50 dark:bg-success-950/30 dark:text-success-300"
        >
          ✅ {continueTarget.label}
        </Link>
      ) : (
        /* 0 due - CTA goes straight to the next thing for THIS tier: the A1
           campaign node on Premium, the last-opened roadmap module on free. */
        <Link
          to={continueTarget.to}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-3 text-body font-bold text-white shadow-sm transition hover:bg-accent-700 active:scale-95"
        >
          🚀 {isDE ? 'Weiterlernen' : 'Continue learning'}
          {continueTarget.label && (
            <span className="truncate text-meta font-medium opacity-90">
              {continueTarget.label}
            </span>
          )}
        </Link>
      )}
    </section>
  );
}