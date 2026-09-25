import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useA1Path } from '../hooks/useA1Path';
import { useLang } from '../hooks/useLang';
import { A1_UNITS, CHECKPOINT_PASS_THRESHOLD } from '../data/a1Path';
import { A1PathProgress } from './path/A1PathProgress';
import { theme } from '../config/theme';
import type { RailSpec } from '../config/moduleRail';

/**
 * Desktop context rail (xl+), rendered ONLY for routes listed in
 * `config/moduleRail.ts`.
 *
 * WHAT CHANGED. This used to show a global "Today / Next step / Streak" rail.
 * All three facts were already on Home: `DailySession` holds the same
 * `dueQueue` and `getPushNode()` and renders the same two CTAs — and does so
 * *actionably*, since its CTA starts the review batch inline where this rail
 * merely navigated to /dashboard — and `HomeLayoutA` shows the same streak and
 * the same "all clear" predicate. Signed in on /home, the two sat side by
 * side. That duplication is gone.
 *
 * WHAT IT IS NOW: a route-scoped AGGREGATE that exists only where the page
 * below it cannot answer the question in one glance. For /learn that is the
 * cross-band roll-up — how many of the five gates are passed, and which gate
 * to attack next — because `UnitSpine` presents bands as an ordered list and
 * never states the totals.
 *
 * ANTI-DUPLICATION RULE (the reason 18 of 19 surfaces get nothing): roll-up
 * only. `UnitSpine` owns per-band detail. If a block here ever restates a band
 * card, it gets cut rather than kept "for consistency".
 *
 * DATA: read-only from `useA1Path` + `A1_CURRICULUM`, the same state
 * `UnitSpine` and the Dashboard already read. No new state, no fetch.
 */
export function ContextPanel({ spec }: { spec: RailSpec }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isCheckpointComplete, getPushNode, checkpointBestByUnit } = useA1Path();

  if (spec.kind !== 'a1-aggregate') return null;

  // CORE BANDS ONLY — the easy thing to get wrong here. A1_UNITS is
  // A(core), B(SUPPORT), C, D, E, F: band B has no checkpoint,
  // `getUnitPhase` returns 'current' for it forever, and `isCheckpointComplete`
  // returns false. Counting it would report "2/6" when the learner has passed
  // 2 of the 5 gates they are actually able to pass.
  const coreBands = A1_UNITS.filter((band) => band.kind === 'core');
  const gatesPassed = coreBands.filter((band) => isCheckpointComplete(band.index)).length;

  // The next gate is the first CORE band whose checkpoint isn't complete — NOT
  // the push node. The push node is frequently a lesson ("Greetings"), which
  // is work to do rather than a gate to pass.
  const nextGate = coreBands.find((band) => !isCheckpointComplete(band.index)) ?? null;
  const nextGateBest = nextGate ? checkpointBestByUnit[nextGate.index] : undefined;
  const nextGatePct = typeof nextGateBest === 'number' ? Math.round(nextGateBest * 100) : null;
  const passPct = Math.round(CHECKPOINT_PASS_THRESHOLD * 100);

  // "Keep going" target: the first incomplete step in the unlocked path.
  const pushNode = getPushNode();

  return (
    <aside
      aria-label={isDE ? 'Lernfortschritt' : 'Course progress'}
      className="hidden w-72 shrink-0 xl:block"
    >
      <div className="sticky top-20 space-y-6 pb-8">
        {/* ── Band strip ───────────────────────────────────────────────
            REUSED, not rebuilt. `A1PathProgress` already renders the six-band
            phase strip (done / current / locked, amber for the support band)
            from this same hook; its `compact` mode had no caller until now. */}
        <section>
          <h2 className={theme.type.kicker}>{isDE ? 'Dein Kurs' : 'Your course'}</h2>
          <div className="mt-3">
            {/* hideLabel: this section already supplies the "Your course"
                kicker, so the strip's own label would double up. */}
            <A1PathProgress compact hideLabel />
          </div>
        </section>

        {/* ── Gate roll-up ───────────────────────────────────────────────
            The fact UnitSpine never states: totals ACROSS the five gates. */}
        <section className="border-t border-ink-200 pt-5 dark:border-ink-800">
          <h2 className={theme.type.kicker}>{isDE ? 'Tore' : 'Gates'}</h2>
          <p className={`${theme.type.display} mt-1.5`}>
            {gatesPassed}
            <span className="text-title text-ink-400 dark:text-ink-600">/{coreBands.length}</span>
          </p>
          <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
            {gatesPassed === 0
              ? isDE ? 'Noch keines bestanden' : 'None passed yet'
              : gatesPassed === coreBands.length
                ? isDE ? 'Alle Tore bestanden' : 'All gates passed'
                : isDE ? 'Tore bestanden' : 'gates passed'}
          </p>
        </section>

        {/* ── Next gate ──────────────────────────────────────────────────
            Which SINGLE gate to attack next and how close the last attempt
            fell. This is a shortcut to the checkpoint, not a restatement of
            the Band card that also links to it further down the page. */}
        {nextGate ? (
          <section className="border-t border-ink-200 pt-5 dark:border-ink-800">
            <h2 className={theme.type.kicker}>{isDE ? 'Nächstes Tor' : 'Next gate'}</h2>
            <p className={`${theme.type.section} mt-1.5`}>Band {nextGate.code}</p>
            <p className="mt-0.5 text-meta text-ink-500 dark:text-ink-400">
              {isDE ? nextGate.title.de : nextGate.title.en}
            </p>
            {nextGatePct === null ? (
              <p className="mt-2 text-meta text-ink-500 dark:text-ink-400">
                {isDE ? 'Noch nicht versucht' : 'Not attempted yet'}
              </p>
            ) : (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-meta">
                <span
                  className={
                    nextGatePct >= passPct
                      ? 'font-semibold text-success-700 dark:text-success-400'
                      : 'font-semibold text-warning-700 dark:text-warning-400'
                  }
                >
                  {isDE ? `Bestwert ${nextGatePct} %` : `Best ${nextGatePct}%`}
                </span>
                <span className="text-ink-500 dark:text-ink-400">
                  {isDE ? `· ${passPct} % nötig` : `· needs ${passPct}%`}
                </span>
              </p>
            )}
            <Link
              to={`/checkpoint/${nextGate.index}`}
              className={`${theme.button.secondarySmall} mt-3 w-full justify-between`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                {isDE ? 'Tor öffnen' : 'Open the gate'}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        ) : (
          <section className="border-t border-ink-200 pt-5 dark:border-ink-800">
            <h2 className={theme.type.kicker}>{isDE ? 'Nächstes Tor' : 'Next gate'}</h2>
            <p className="mt-1.5 text-body text-ink-600 dark:text-ink-300">
              {isDE ? 'Alle Tore bestanden.' : 'All gates passed. Nothing left to unlock.'}
            </p>
          </section>
        )}

        {/* ── Next step ─────────────────────────────────────────────────
            The push node — the first incomplete unlocked step. Deliberately
            distinct from the gate above: this is the next THING TO DO, which
            is usually a lesson rather than a checkpoint. */}
        {pushNode && (
          <section className="border-t border-ink-200 pt-5 dark:border-ink-800">
            <h2 className={theme.type.kicker}>{isDE ? 'Nächster Schritt' : 'Next step'}</h2>
            <p className={`${theme.type.section} mt-1.5`}>
              {isDE ? pushNode.label.de : pushNode.label.en}
            </p>
            <Link
              to={pushNode.to}
              className={`${theme.button.secondarySmall} mt-3 w-full justify-between`}
            >
              <span>{isDE ? 'Loslegen' : 'Start'}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        )}
      </div>
    </aside>
  );
}
