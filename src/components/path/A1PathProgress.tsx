/**
 * src/components/path/A1PathProgress.tsx
 *
 * The Dashboard / context-rail progress strip: one ring per lesson, fifteen
 * rings, in the order they are learned.
 *
 * WHAT CHANGED
 * This used to have two lives — a full-width list of fifteen module rows on the
 * Dashboard, and a wrap of small pills in the rail. Two layouts meant two things
 * to keep in sync, and the wide one was a quieter SECOND copy of the roadmap:
 * same fifteen lessons, same phases, half the information per row. There is now
 * one representation — the ring — at two sizes, and the detailed row view is
 * gone. When you want the titles, the roadmap is one click away.
 *
 * WHY `compact` WRAPS INSTEAD OF SCROLLING (the honest caveat)
 * Fifteen rings at 28px plus gaps are ~480px wide; the context rail is 288px.
 * A single scrolling row there would hide the learner's own position off the
 * right edge — precisely the failure the old wrapping strip existed to avoid.
 * So `compact` (the rail) wraps and every ring stays reachable, while the
 * Dashboard, which has the whole content column, gets one row that scrolls only
 * if it has to. Either way the caption underneath states the position in words
 * ("7 of 15 passed · next: Lesson 8"), so the strip is never the only place the
 * learner's position exists.
 *
 * Every ring is a link to its lesson, with the full title, state and percentage
 * in the `aria-label` and the `title` tooltip. Locked lessons link too — soft
 * lock: the lesson page loads and explains the gate rather than dead-ending.
 */
import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { A1_CURRICULUM, A1_UNIT_COUNT } from '../../data/a1Path';
import { ProgressRing } from './ProgressRing';
import { computeModuleProgress, phaseStateWord } from './moduleProgress';
import type { A1UnitPhase } from '../../hooks/useA1Path';

interface A1PathProgressProps {
  /** Narrow host (the 288px context rail): smaller rings, wrapping rows. */
  compact?: boolean;
  /**
   * Suppress the built-in "A1 Path" kicker. Set when the host already supplies
   * a heading — otherwise the two labels stack and read as a mistake ("YOUR
   * COURSE" sitting directly above "A1 PATH").
   */
  hideLabel?: boolean;
}

export function A1PathProgress({ compact = false, hideLabel = false }: A1PathProgressProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getUnitPhase, isNodeComplete, isCheckpointComplete } = useA1Path();

  const size = compact ? 28 : 34;
  const modules = A1_CURRICULUM.units;
  const phases = modules.map((unit) => getUnitPhase(unit.index));
  const passedCount = phases.filter((phase) => phase === 'done').length;
  const nextOffset = phases.findIndex((phase) => phase !== 'done');
  const nextUnit = nextOffset === -1 ? null : modules[nextOffset]!;

  return (
    <div>
      {!hideLabel && (
        <p className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
          {isDE ? 'A1-Fortschritt' : 'A1 Path'}
        </p>
      )}

      <ul
        className={
          compact
            ? 'mt-2 flex flex-wrap items-center gap-1.5'
            : 'mt-2 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]'
        }
      >
        {modules.map((unit, index) => {
          const phase: A1UnitPhase = phases[index]!;
          const passed = isCheckpointComplete(unit.index);
          const { pct } = computeModuleProgress(unit, isNodeComplete, isCheckpointComplete);
          const title = isDE ? unit.title.de : unit.title.en;
          const stateWord = phaseStateWord(phase, passed, isDE);
          const a11yName = `${
            isDE ? `Lektion ${unit.index + 1} von ${A1_UNIT_COUNT}` : `Lesson ${unit.index + 1} of ${A1_UNIT_COUNT}`
          }: ${title} — ${stateWord}, ${pct}%`;

          return (
            <li key={unit.id} className="shrink-0">
              <Link
                to={`/lesson/${unit.index}`}
                title={a11yName}
                aria-label={a11yName}
                className="inline-flex rounded-full transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                {/* decorative: the link above carries the whole name, so the ring
                    must not announce it a second time. */}
                <ProgressRing
                  phase={phase}
                  pct={pct}
                  label={String(unit.index + 1)}
                  size={size}
                  decorative
                />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* The position in words — the strip is a glance, not the only source. */}
      <p className="mt-2 text-meta text-ink-500 dark:text-ink-400">
        {isDE
          ? `${passedCount} von ${A1_UNIT_COUNT} bestanden`
          : `${passedCount} of ${A1_UNIT_COUNT} passed`}
        {nextUnit && (
          <span className="text-ink-400 dark:text-ink-500">
            {isDE ? ' · Als Nächstes' : ' · next'}: {nextUnit.code}
          </span>
        )}
      </p>
    </div>
  );
}
