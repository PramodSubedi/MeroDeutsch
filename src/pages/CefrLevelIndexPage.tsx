/**
 * src/pages/CefrLevelIndexPage.tsx — `/learn`, the CEFR level GRID.
 *
 * THE HUB, NOT THE COURSE
 * This page answers exactly one question: "which level do I take?" It is a
 * grid of level cards, one per CEFR level in data/cefrLevels.ts, and picking
 * one navigates to that level's own page (`/learn/a1`, `/learn/a2`, …) which
 * carries the actual lessons, stages and checkpoint gates. The grid therefore
 * holds NO lesson content and no curriculum data of its own — those belong to
 * the level page, where they stay.
 *
 * WHY THE GRID DOES NOT DUPLICATE THE PATH
 * Two rules keep the two pages honest:
 *   · Progress is read from the SAME `useA1Path` + `computeModuleProgress` pair
 *     the A1 spine uses, so the "4 / 15 modules" on this card is the same fact
 *     the spine's rings are counting — not a second tally that can drift.
 *   · The card is a LINK to the level page, never a second entry point into
 *     the same content. One level, one page, one URL.
 *
 * WHY COMING-SOON LEVELS ARE STILL CARDS
 * They are cards, and they are clickable. A greyed-out card teaches nothing and
 * strands the learner; a card that says "A2 — in the works, here's what's
 * planned" and then opens the A2 page is an honest roadmap entry. It also means
 * adding C1 later is a data edit, not new UI (see cefrLevels.ts).
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { usePageTitle } from '../hooks/usePageTitle';
import { A1_UNITS } from '../data/a1Path';
import { ProgressRing } from '../components/path/ProgressRing';
import { summarizeLevelProgress } from '../components/path/moduleProgress';
import { CEFR_LEVELS, COMING_SOON_LABEL, cefrLevelHref } from '../data/cefrLevels';
import { theme } from '../config/theme';
import type { CefrLevel } from '../data/cefrLevels';
import type { CefrLevelProgress } from '../components/path/moduleProgress';

export function CefrLevelIndexPage() {
  usePageTitle('Learn');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isNodeComplete, isCheckpointComplete, getUnitPhase } = useA1Path();

  return (
    <div className={theme.page.container}>
      <header className="mb-6">
        <Link
          to="/home"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-sm px-1 text-body text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
        >
          ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
        </Link>
        <p className={`${theme.type.kicker} mt-3`}>
          {isDE ? 'Deutsch lernen' : 'Learn German'}
        </p>
        <h1 className={`${theme.type.display} mt-1`}>
          {isDE ? 'Wähle dein Niveau' : 'Choose your level'}
        </h1>
        <p className="mt-2 max-w-prose text-body text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Jedes Niveau ist ein eigener Kurs. Wähle eines und starte dort, wo du stehst.'
            : 'Each level is its own course. Pick one and start where you are.'}
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CEFR_LEVELS.map((level, index) => {
          const comingSoon = level.status === 'coming-soon';
          // Only the first level has a curriculum to measure. Guarded by
          // position (not a literal) so a second shipped level gets its own
          // real progress source instead of silently showing A1's numbers.
          const progress =
            index === 0 && !comingSoon
              ? summarizeLevelProgress(
                  A1_UNITS,
                  isNodeComplete,
                  isCheckpointComplete,
                  getUnitPhase,
                )
              : null;

          return (
            <li key={level.id}>
              <Link
                to={cefrLevelHref(level.id)}
                data-level={level.id}
                data-level-status={level.status}
                className={`group flex h-full flex-col rounded-lg border p-5 transition focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-[0.99] ${
                  comingSoon
                    ? 'border-dashed border-ink-300 bg-transparent hover:border-ink-400 hover:bg-ink-25 dark:border-ink-700 dark:hover:border-ink-600 dark:hover:bg-ink-900'
                    : 'border-ink-200 bg-white hover:border-accent-400 hover:bg-ink-25 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-accent-600 dark:hover:bg-ink-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <LevelBadge level={level} progress={progress} />
                  <div className="min-w-0 flex-1">
                    <p className={`${theme.type.title} text-xl`}>{level.code}</p>
                    <p className="mt-0.5 text-body font-semibold text-ink-700 dark:text-ink-200">
                      {isDE ? level.name.de : level.name.en}
                    </p>
                    {comingSoon ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {isDE ? COMING_SOON_LABEL.de : COMING_SOON_LABEL.en}
                      </span>
                    ) : (
                      progress && <LevelProgressLine progress={progress} isDE={isDE} />
                    )}
                  </div>
                </div>

                <p className="mt-3 text-body text-ink-600 dark:text-ink-300">
                  {isDE ? level.description.de : level.description.en}
                </p>

                {comingSoon && level.planned.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {level.planned.slice(0, 3).map((item, i) => (
                      <li key={i} className="flex gap-2 text-meta text-ink-500 dark:text-ink-400">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400 dark:bg-ink-600"
                        />
                        <span>{isDE ? item.de : item.en}</span>
                      </li>
                    ))}
                    {level.planned.length > 3 && (
                      <li className="pl-3 text-micro text-ink-400 dark:text-ink-500">
                        {isDE
                          ? `+ ${level.planned.length - 3} weitere Themen`
                          : `+ ${level.planned.length - 3} more topics`}
                      </li>
                    )}
                  </ul>
                )}

                {/* `mt-auto` pins every card's CTA to the same baseline. Without
                    it the A1 card (no topic list) floats its CTA mid-card with
                    dead space beneath it, while A2/B1 reach the bottom — three
                    cards of equal height whose actions do not line up. `pt-4`
                    keeps the gap when a card is full. */}
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-meta font-semibold text-accent-600 dark:text-accent-300">
                  {comingSoon
                    ? isDE
                      ? 'Mehr erfahren'
                      : 'See what is planned'
                    : isDE
                      ? 'Kurs öffnen'
                      : 'Open course'}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── card parts ───────────────────────────────────────────────────────────── */

/**
 * The card's leading glyph: a real ProgressRing when the level has progress to
 * show, an outlined code badge when it does not (so a coming-soon level still
 * leads with a big, legible "A2" instead of a blank corner).
 *
 * NO NUMBER GOES INSIDE THE RING. `ProgressRing`'s inner disc is 17/32 of the
 * diameter, so at 52px only ~28px of clear space is available — enough for the
 * 1-2 character lesson numbers the spine puts there, and not enough for "33%",
 * which spills out over the ring stroke on both sides. The count belongs in the
 * line beside the code, where it has room to be read.
 *
 * The arc uses `modulePct` (not the finer `pct`) so the ring and the
 * "n / 15 modules done" line below it are the SAME unit. A 33%-steps ring next
 * to "0 / 15 modules done" is two true numbers that read as a broken widget.
 */
function LevelBadge({
  level,
  progress,
}: {
  level: CefrLevel;
  progress: CefrLevelProgress | null;
}) {
  if (progress) {
    return (
      <ProgressRing
        phase={progress.phase}
        pct={progress.modulePct}
        label=""
        size={52}
        // The line beside the code already states the counts, so the ring is
        // decoration here — announcing it again would just repeat itself.
        decorative
        className="mt-0.5"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-dashed border-ink-300 text-title font-extrabold text-ink-400 dark:border-ink-700 dark:text-ink-500"
    >
      {level.code}
    </span>
  );
}

/**
 * "0 / 15 modules done" under the level name.
 *
 * Deliberately shows NO percentage: the ring is the only place a percentage
 * appears. Printing it in both places (which this did) meant the same number
 * twice, and made the ring-vs-count mismatch look like a rendering fault
 * rather than two different measures.
 */
function LevelProgressLine({
  progress,
  isDE,
}: {
  progress: CefrLevelProgress;
  isDE: boolean;
}) {
  const complete = progress.done >= progress.total;
  return (
    <p className="mt-1.5 text-meta text-ink-500 dark:text-ink-400">
      {complete ? (
        <span className="font-semibold text-success-700 dark:text-success-300">
          {isDE ? 'Kurs abgeschlossen' : 'Course complete'}
        </span>
      ) : (
        <>
          <span className="font-semibold text-ink-700 dark:text-ink-200">
            {progress.done} / {progress.total}
          </span>{' '}
          {isDE ? 'Module geschafft' : 'modules done'}
        </>
      )}
    </p>
  );
}
