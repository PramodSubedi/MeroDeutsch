/**
 * src/components/dashboard/CoursePosition.tsx
 *
 * THE ONE place the learner app states their course position, at a size that
 * reads as the primary fact on the page.
 *
 * WHY THIS EXISTS (it replaced two things that said the same fact differently)
 * ---------------------------------------------------------------------------
 * The Dashboard used to render a "Modules 3/15" stat tile and, ~400px below it,
 * `A1PathProgress`'s "3 of 16 passed" caption. Same question, two answers, two
 * DIFFERENT DENOMINATORS: 15 is the count of `kind: 'core'` units, 16 is
 * `A1_UNIT_COUNT` including the `support` band. A learner scrolling the page saw
 * "3/15" and then "3 of 16" and had no way to know which was wrong.
 *
 * That is the exact "two competing truths" failure the Dashboard's own header
 * comment describes having fixed for the Alphabet-era tiles — reintroduced one
 * component lower.
 *
 * THE RULE THIS ENCODES
 * ---------------------
 * One number, one denominator, and it must match the thing the learner is
 * looking at. Here that is the RING STRIP: 16 rings are drawn, so the caption
 * counts to 16. The gate average is not a peer of that number — it is a caption
 * UNDER it, because it answers a different question ("am I passing?") rather
 * than giving a second answer to "how far along?".
 *
 * "NEXT" IS THE SHARED HOOK, NOT A LOCAL RECOMPUTE
 * ------------------------------------------------
 * `getPushNode()` is already read by `ContinueLearningPage`, Home's
 * `DailySession`, the sidebar `LearnerWaypoint`, and `ContextPanel`. This
 * component reads it too rather than deriving "the next unit" from the phase
 * list a few lines above — a second derivation would be a place for Home and
 * the Dashboard to disagree about where "next" is, which is the whole failure
 * mode this component was written to end.
 */
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { A1_CURRICULUM, A1_UNIT_COUNT } from '../../data/a1Path';
import { ProgressRing } from '../path/ProgressRing';
import { computeModuleProgress, phaseStateWord } from '../path/moduleProgress';
import type { A1UnitPhase } from '../../hooks/useA1Path';

interface CoursePositionProps {
  /**
   * Mean best score across every gate actually attempted, 0..100 - or `null` when
   * no gate has been attempted. Passed in rather than recomputed so this stays a
   * presentational component and the Dashboard keeps one derivation of it.
   */
  gateAveragePct: number | null;
}

export function CoursePosition({ gateAveragePct }: CoursePositionProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getPushNode, getUnitPhase, isNodeComplete, isCheckpointComplete } = useA1Path();

  const units = A1_CURRICULUM.units;
  const phases = units.map((unit) => getUnitPhase(unit.index));
  const passedCount = phases.filter((phase) => phase === 'done').length;
  const pushNode = getPushNode();
  const nextUnit = pushNode ? units[pushNode.unitIndex] : undefined;
  // Resolved once, outside the JSX, so the branch can test it instead of
  // asserting non-null. `getPushNode()` returns a node only when it has a
  // route, so the two guards below are belt-and-braces rather than a real
  // third state.
  const nextTarget = pushNode?.to ?? '';

  // One denominator, and it is the number of rings actually drawn below.
  const pct = Math.round((passedCount / A1_UNIT_COUNT) * 100);

  return (
    <section
      aria-labelledby="course-position-heading"
      className="mb-6 overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
    >
      {/* Heading row. `border-b` rather than a shadow because this is a surface
          boundary, not something floating above the page. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-150 px-4 py-3 sm:px-5 dark:border-ink-850">
        <h2
          id="course-position-heading"
          className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400"
        >
          {isDE ? 'Dein A1-Kurs' : 'Your A1 course'}
        </h2>
        {/* The one authoritative figure. `tabular-nums` so the glyphs do not
            shift width as the count changes. */}
        <p className="font-mono text-title font-bold tracking-[-0.02em] tabular-nums text-ink-900 dark:text-white">
          {passedCount}
          <span className="text-ink-400 dark:text-ink-500">/{A1_UNIT_COUNT}</span>
        </p>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {/* NEXT. A link when there is one, because "where am I" and "what next"
            are the same question and the answer should be clickable wherever it
            appears. Plain text when the course is done — a link to nowhere is
            worse than no link.

            `nextTarget` is resolved OUTSIDE the JSX rather than re-asserting
            `pushNode!.to` inside it: the `? :` already proves the node exists,
            and a non-null assertion there would be the one way a future edit
            could turn this into a link to `undefined`. */}
        {nextUnit && nextTarget ? (
          <Link
            to={nextTarget}
            className="group flex items-baseline gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900"
          >
            <span className="shrink-0 font-mono text-meta font-bold tracking-wider text-accent-600 dark:text-accent-400">
              {nextUnit.code}
            </span>
            <span className="min-w-0 text-body font-semibold text-ink-900 group-hover:text-accent-700 dark:text-ink-100 dark:group-hover:text-accent-300">
              {isDE ? nextUnit.title.de : nextUnit.title.en}
            </span>
            {/* The hover arrow is a pure opacity fade, so it is already
                compositor-friendly. `motion-safe:` keeps it from fading at all
                under `prefers-reduced-motion`, and it is `aria-hidden`, so
                nothing is lost for a screen reader either way. */}
            <span
              className="ml-auto shrink-0 text-meta font-medium text-accent-600 opacity-0 transition-opacity motion-safe:group-hover:opacity-100 dark:text-accent-400"
              aria-hidden="true"
            >
              &rarr;
            </span>
          </Link>
        ) : (
          <p className="flex items-baseline gap-3 text-body font-semibold text-ink-900 dark:text-ink-100">
            <span className="font-mono text-meta font-bold tracking-wider text-success-600 dark:text-success-400">
              &check;
            </span>
            {isDE ? 'Kurs abgeschlossen' : 'Course complete'}
          </p>
        )}


        {/* The ring strip. Sixteen rings, sixteen units — the same set the
            headline above counts, which is the entire point of this component.

            `role="list"` on the scrolling `<ul>`: `overflow-x-auto` gives the
            element a scrollbar, and in Chrome a scroll container loses its
            implicit list role, so a screen reader would otherwise hear the
            sixteen lessons as an unlabelled group of links. The role is
            restored explicitly rather than by removing the scroll.

            Each ring link is a 30px target. The strip is a *secondary* view —
            the same sixteen lessons are full-size rows on `/learn` — so the
            small target is deliberate, and the caption below restates the
            position in words so the strip is never the only way to read it. */}
        <ul
          role="list"
          className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {units.map((unit, index) => {
            const phase: A1UnitPhase = phases[index]!;
            const passed = isCheckpointComplete(unit.index);
            const { pct: unitPct } = computeModuleProgress(unit, isNodeComplete, isCheckpointComplete);
            const title = isDE ? unit.title.de : unit.title.en;
            const stateWord = phaseStateWord(phase, passed, isDE);
            // The full sentence lives on the link, so the ring itself is
            // decorative and a screen reader hears each lesson exactly once.
            const a11yName = `${
              isDE ? `Lektion ${unit.index + 1} von ${A1_UNIT_COUNT}` : `Lesson ${unit.index + 1} of ${A1_UNIT_COUNT}`
            }: ${title} — ${stateWord}, ${unitPct}%`;

            return (
              <li key={unit.id} className="shrink-0">
                <Link
                  to={`/lesson/${unit.index}`}
                  title={a11yName}
                  aria-label={a11yName}
                  className="inline-flex rounded-full transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                >
                  <ProgressRing phase={phase} pct={unitPct} label={String(unit.index + 1)} size={30} decorative />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Captions, not cards. These are subordinate facts about the number
            above: how far, and how well. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-500 dark:text-ink-400">
          <span className="tabular-nums">
            {pct}% {isDE ? 'des Kurses' : 'of the course'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            {gateAveragePct === null
              ? isDE
                ? 'Noch keine Prüfung'
                : 'No checkpoint attempted'
              : isDE
                ? `Prüfungen im Schnitt ${gateAveragePct}%`
                : `Checkpoints averaging ${gateAveragePct}%`}
          </span>
        </div>
      </div>
    </section>
  );
}
