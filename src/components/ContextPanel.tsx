import { Link, useLocation } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useA1Path } from '../hooks/useA1Path';
import { useLang } from '../hooks/useLang';
import { A1_UNITS, CHECKPOINT_PASS_THRESHOLD } from '../data/a1Path';
import { resolveLessonTools } from '../data/lessonPracticeLinks';
import { labelForPath } from '../config/routeLabels';
import { lessonIndexFromPath } from '../config/moduleRail';
import { A1PathProgress } from './path/A1PathProgress';
import { usePremium } from '../hooks/usePremium';
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
 *
 * TIER: the two kinds differ, and the rule is not a blanket gate.
 *   - `a1-aggregate` summarises the A1 campaign, which is the Premium
 *     curriculum, so it is Premium only. `config/moduleRail.ts` decides WHICH
 *     routes may have a rail; this component decides whether the TIER may see
 *     one. Both must say yes.
 *   - `a1-lesson` annotates the free interactive lesson, so it stays available
 *     to everyone, and is gated only on the `/lesson/:n/notes` document route
 *     that <PremiumGate> already wraps.
 */
/**
 * The rail for `/lesson/:n`: the practice tools that reinforce THIS lesson.
 *
 * These are SUPPORTING tools, not the lesson. The lesson is the material on the
 * page — objectives, lexicon, grammar, traps, culture, dialogue, practice bank.
 * A tool appears here only because it drills something that lesson covered, and
 * each one says why in a sentence, so the learner can tell "this helps me with
 * the accusative" from "this is just fun".
 *
 * Resolution is deliberately late: `toolId` is looked up in the module registry
 * at render time, so renaming or retiming a tool needs no change here, and a tool
 * that disappears simply drops out instead of rendering a dead link.
 */
function LessonPracticeRail({ pathname, isDE }: { pathname: string; isDE: boolean }) {
  const index = lessonIndexFromPath(pathname);
  const unit = index === null ? undefined : A1_UNITS[index];

  // Resolve through the shared helper so the desktop rail and the inline
  // below-xl list can never drift — same ids, same reasons, same registry.
  const suggestions = index === null ? [] : resolveLessonTools(index);

  return (
    <aside
      aria-label={isDE ? 'Passende Übungen' : 'Related practice'}
      className="hidden w-72 shrink-0 xl:block"
    >
      <div className="sticky top-20 space-y-6 pb-8">
        <section>
          <h2 className={theme.type.kicker}>
            {isDE ? 'Passende Übungen' : 'Related practice'}
          </h2>
          <p className="mt-1.5 text-meta text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Optionale Wiederholung zu dieser Lektion. Die Lektion selbst ist der Text auf der Seite.'
              : 'Optional reinforcement for this lesson. The lesson itself is the material on the page.'}
          </p>
        </section>

        {suggestions.length > 0 ? (
          <ul className="space-y-3">
            {suggestions.map((tool) => {
              const Icon = tool.Icon;
              return (
                <li key={tool.toolId}>
                  <Link
                    to={tool.path}
                    className={`${theme.button.secondarySmall} w-full items-start justify-start gap-2.5 text-left`}
                  >
                    <span className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {labelForPath(tool.path, isDE)}
                      </span>
                      <span className="mt-0.5 block text-micro font-normal leading-snug text-ink-500 dark:text-ink-400">
                        {isDE ? tool.why.de : tool.why.en}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-meta text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Für diese Lektion sind keine Übungen hinterlegt.'
              : 'No practice tools are linked to this lesson yet.'}
          </p>
        )}

        {unit && (
          <section className="border-t border-ink-200 pt-5 dark:border-ink-800">
            <h2 className={theme.type.kicker}>{isDE ? 'Lektion abschließen' : 'Finish the lesson'}</h2>
            <p className="mt-1.5 text-meta text-ink-500 dark:text-ink-400">
              {isDE
                ? `Die Prüfung für ${unit.code} braucht ${Math.round(CHECKPOINT_PASS_THRESHOLD * 100)} %.`
                : `The ${unit.code} checkpoint needs ${Math.round(CHECKPOINT_PASS_THRESHOLD * 100)}%.`}
            </p>
            <Link to={`/checkpoint/${unit.index}`} className={`${theme.button.secondarySmall} mt-3 w-full justify-between`}>
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                {isDE ? 'Prüfung öffnen' : 'Open the checkpoint'}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        )}
      </div>
    </aside>
  );
}

export function ContextPanel({ spec }: { spec: RailSpec }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isCheckpointComplete, getPushNode, checkpointBestByUnit } = useA1Path();
  const { pathname } = useLocation();

  // ── TIER GATE ────────────────────────────────────────────────────────────
  // The two rail kinds have DIFFERENT tier rules, which is why this is not one
  // blanket `if (!isPremium) return null`.
  //
  //  - `a1-aggregate` (on /learn) summarises the A1 CAMPAIGN: the 15-module
  //    spine and the five 80% checkpoint gates. That campaign is the Premium
  //    curriculum. A guest or free learner lands on the free
  //    learning-components path instead (`components/learning/LearningPath`), so
  //    showing them "2/5 checkpoints passed" plus a button that opens
  //    `/checkpoint/:n` would advertise a curriculum they are not on and route
  //    them into it. Premium only.
  //
  //  - `a1-lesson` (on /lesson/:n) annotates the INTERACTIVE lesson surface,
  //    which is free and stays free - only `/lesson/:n/notes`, the document
  //    deep-dive, sits behind <PremiumGate>. So this rail must NOT be gated
  //    generally, or a free learner would lose useful practice navigation on a
  //    page they are fully entitled to read. It IS gated on the notes route,
  //    where a rail of "related practice" next to a paywall would be nonsense.
  //
  // Returning null is layout-safe: `Layout` renders the rail as a sibling in a
  // `flex gap-8` row, and a null child collapses that row to the single `flex-1`
  // content column, so no dead 288px gutter is reserved.
  //
  // `isLoading` renders nothing rather than guessing, matching `PremiumGate` - a
  // rail that flashes campaign state at a free learner, or hides it from a
  // Premium one, is worse than one that arrives 100ms late.
  const { isPremium, isLoading: planLoading } = usePremium();
  const isNotesRoute = pathname.endsWith('/notes');
  const railIsPremium = spec.kind !== 'a1-lesson' || isNotesRoute;
  if (planLoading && railIsPremium) return null;
  if (railIsPremium && !isPremium) return null;

  // ── Lesson pages get a different rail entirely ──────────────────────────
  // Dispatched first because the two kinds share nothing but the wrapper. The
  // lesson rail answers one question ("what can I drill on what I just read?")
  // and deliberately shows no cross-lesson roll-up: a learner mid-lesson does not
  // need to be told how many gates they have passed.
  if (spec.kind === 'a1-lesson') {
    return <LessonPracticeRail pathname={pathname} isDE={isDE} />;
  }

  if (spec.kind !== 'a1-aggregate') return null;

  // CORE MODULES ONLY — the easy thing to get wrong here. Every one of the 15
  // modules is currently 'core' (each carries a checkpoint that gates the next),
  // so this filter is a no-op today. It stays because it is what makes the
  // roll-up correct if a support/optional module is ever added back: such a
  // module has no checkpoint, `getUnitPhase` returns 'optional' for it, and
  // `isCheckpointComplete` returns false — counting it would report "2/16" when
  // the learner has passed 2 of the 15 checkpoints they can actually pass.
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
            REUSED, not rebuilt. `A1PathProgress` already renders the per-module
            phase strip (done / current / locked, amber for an optional module)
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
          <h2 className={theme.type.kicker}>{isDE ? 'Prüfungen' : 'Checkpoints'}</h2>
          <p className={`${theme.type.display} mt-1.5`}>
            {gatesPassed}
            <span className="text-title text-ink-400 dark:text-ink-600">/{coreBands.length}</span>
          </p>
          <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
            {gatesPassed === 0
              ? isDE ? 'Noch keines bestanden' : 'None passed yet'
              : gatesPassed === coreBands.length
                ? isDE ? 'Alle Prüfungen bestanden' : 'All checkpoints passed'
                : isDE ? 'Prüfungen bestanden' : 'checkpoints passed'}
          </p>
        </section>

        {/* ── Next gate ──────────────────────────────────────────────────
            Which SINGLE gate to attack next and how close the last attempt
            fell. This is a shortcut to the checkpoint, not a restatement of
            the Band card that also links to it further down the page. */}
        {nextGate ? (
          <section className="border-t border-ink-200 pt-5 dark:border-ink-800">
            <h2 className={theme.type.kicker}>{isDE ? 'Nächste Prüfung' : 'Next checkpoint'}</h2>
            <p className={`${theme.type.section} mt-1.5`}>{nextGate.code}</p>
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
                  {isDE ? `· ${passPct} % zum Meistern` : `· ${passPct}% to master`}
                </span>
              </p>
            )}
            <Link
              to={`/checkpoint/${nextGate.index}`}
              className={`${theme.button.secondarySmall} mt-3 w-full justify-between`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                {isDE ? 'Prüfung öffnen' : 'Open the checkpoint'}
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
