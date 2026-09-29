/**
 * src/components/path/UnitSpine.tsx
 *
 * The A1 roadmap: FIVE STAGES ACROSS, FIFTEEN LESSONS DOWN.
 *
 * WHAT THIS IS NOW
 * A horizontal stepper of stage cards, each holding a vertical list of lessons.
 * Every lesson is one row: number ring, title, state, completion. Every stage
 * ends with a checkpoint milestone — a hairline with a chip that states the 80%
 * rule — so the gate is a thing you meet on the path, not a sentence in help
 * text. Nothing else: no artwork, no motion, no second column of content.
 *
 * WHY THE RIVER WENT
 * The old trail spent its visual budget on illustration (a flowing stream, a
 * tilted pebble per lesson, a dam across the water) and carried state only in
 * text beside it. The result was calm but slow to read: you had to count
 * pebbles, and "how far through this lesson am I" had no answer at all, because
 * a stone is either trodden or not. A ring answers both at a glance — the arc
 * IS the percentage, the colour IS the phase — and it stays still, which is what
 * a roadmap is for.
 *
 * WHAT DID NOT CHANGE
 *   · the data: `A1_UNITS` / `A1_CLUSTERS` from data/a1Path, `useA1Path` for
 *     every state question. This is a presentation change, not a data change,
 *     so no learner needs a migration and no phase can disagree with the shell.
 *   · soft lock. A locked lesson is STILL a link: the page loads and explains
 *     what unlocks it. The roadmap decides what is recommended, not what is
 *     reachable (.clinerules C11 / Part B "Soft lock").
 *   · the 80% gate, the retry-anytime rule, and the checkpoint routes.
 *
 * LAYOUT
 *   1 column < 640px  ·  2 columns < 1024px  ·  3 columns to 1280px
 *   5 columns from xl — all five stages and all fifteen lesson titles visible
 *   without scrolling, which is the whole point of a horizontal stepper.
 *   Stage cards size to their own content (`items-start`): a ragged bottom edge
 *   is honest about stages having different lesson counts (5/4/2/2/2 today),
 *   where equal-height cards would leave dead space pretending to be content.
 *
 * A11y: the ring is decorative inside a row (`decorative`), because the row's
 * link already carries the full sentence — "Lesson 4 of 15: Family &
 * Relationships — Locked, 60%". Stage cards are labelled sections, and the
 * lesson list is a real <ol>, so the numbering is announced in order.
 */
import { Link } from 'react-router-dom';
import { Check, Flag, Lock, Unlock } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import {
  A1_CLUSTER_COUNT,
  A1_CLUSTERS,
  A1_UNIT_COUNT,
  A1_UNITS,
  CHECKPOINT_PASS_THRESHOLD,
} from '../../data/a1Path';
import { ProgressRing } from './ProgressRing';
import { computeModuleProgress, phaseStateWord } from './moduleProgress';
import { ANCHORS } from '../../lib/anchors';
import type { A1Unit, Cluster } from '../../data/a1Path';
import type { A1UnitPhase } from '../../hooks/useA1Path';

/* ── the gate, between two lessons ─────────────────────────────────────────── */

/**
 * A checkpoint milestone: a hairline either side of a chip that carries the gate
 * number and the figure that matters, linking straight to the checkpoint.
 *
 * It sits AFTER its lesson, so it reads as "…and this is what closes the
 * lesson", which is why it is drawn as a divider and not as a button.
 *
 * WHY THE CHIP IS JUST A NUMBER AND A PERCENTAGE
 * At five stage columns the whole card is ~155px wide, and "Checkpoint 1 ·
 * 80% to pass" measures ~200px — it overflowed its own column. The full
 * sentence ("Checkpoint 1 · 80% to unlock") is still there, in the tooltip and
 * the accessible name; what the eye reads is `⚑ 1 · 80%`. The rule itself is
 * stated once per page (the /learn header) and again in the legend, instead of
 * being repeated 15 times down the column.
 *
 * A gated milestone is inert (no link, dashed border, `cursor-not-allowed`) —
 * but the LESSON above it is still a link. That asymmetry is deliberate: the
 * gate is the thing that is closed, and the lesson stays softly reachable.
 *
 * 32px, not 44px: this is a secondary shortcut inside a dense roadmap. The
 * 44px touch rule is kept for the lesson rows, which are the primary targets.
 */
function CheckpointMilestone({ unitIndex, locked }: { unitIndex: number; locked: boolean }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isCheckpointComplete, checkpointBestByUnit } = useA1Path();

  const passed = isCheckpointComplete(unitIndex);
  const best = checkpointBestByUnit[unitIndex];
  const pct = typeof best === 'number' ? Math.round(best * 100) : null;
  const need = Math.round(CHECKPOINT_PASS_THRESHOLD * 100);
  const number = unitIndex + 1;

  // The glyph lives ONLY in the icon below, never in these strings: it is
  // decorative, and a second copy would be announced by a screen reader
  // ("lock lock, pass lesson two…").
  const fullLabel = passed
    ? isDE
      ? `Prüfung ${number} bestanden · ${pct}%`
      : `Checkpoint ${number} passed · ${pct}%`
    : locked
      ? isDE
        ? `Prüfung ${number} · ${need} % zum Freischalten`
        : `Checkpoint ${number} · ${need}% to unlock`
      : isDE
        ? `Prüfung ${number} · ${need} % nötig`
        : `Checkpoint ${number} · ${need}% to pass`;

  // The number is the same in both languages; only the number of the gate moves.
  const shortLabel = `${number} · ${passed ? pct : need}%`;

  // Backgrounds, no borders: the hairline either side already marks the
  // boundary, so the chip is a caption on that line rather than a control.
  const tone = passed
    ? 'bg-success-100/70 text-success-800 dark:bg-success-900/40 dark:text-success-300'
    : locked
      ? 'text-ink-400 dark:text-ink-500'
      : 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300';

  const Icon = passed ? Check : locked ? Lock : Flag;

  // Borderless and one line tall. A bordered 32px pill under every lesson cost
  // ~40px x 5 = 200px in the tallest column and turned a divider into a row of
  // buttons; the hairlines already do the "this boundary matters" work, so the
  // chip only has to say the number and the figure.
  const chip = (
    <span
      title={fullLabel}
      aria-label={fullLabel}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-micro font-semibold transition ${
        locked ? 'cursor-not-allowed' : 'hover:brightness-[0.98]'
      } ${tone}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {shortLabel}
    </span>
  );

  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="h-px min-w-0 flex-1 bg-ink-150 dark:bg-ink-800" aria-hidden="true" />
      {locked ? (
        chip
      ) : (
        <Link
          to={`/checkpoint/${unitIndex}`}
          className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          {chip}
        </Link>
      )}
      <span className="h-px min-w-0 flex-1 bg-ink-150 dark:bg-ink-800" aria-hidden="true" />
    </div>
  );
}

/* ── one lesson row ────────────────────────────────────────────────────────── */

/**
 * A lesson: ring, title, state, percentage. The link IS the row.
 *
 * The percentage comes from `computeModuleProgress`, so the roadmap, the
 * dashboard strip and the shell waypoint can never disagree about how far
 * through a lesson someone is.
 */
function LessonRow({ unit, phase }: { unit: A1Unit; phase: A1UnitPhase }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isNodeComplete, isCheckpointComplete } = useA1Path();

  const { pct } = computeModuleProgress(unit, isNodeComplete, isCheckpointComplete);
  const passed = isCheckpointComplete(unit.index);
  const isLocked = phase === 'locked';
  const title = isDE ? unit.title.de : unit.title.en;

  // Shown beside the title AND folded into the link's accessible name, because
  // the ring is decoration — without this a screen reader would hear fifteen
  // identical titles and no idea which ones are open. The wording itself is
  // shared with the dashboard strip and the shell rail (see `phaseStateWord`).
  const stateWord = phaseStateWord(phase, passed, isDE);

  const a11yName = `${
    isDE ? `Lektion ${unit.index + 1} von ${A1_UNIT_COUNT}` : `Lesson ${unit.index + 1} of ${A1_UNIT_COUNT}`
  }: ${title} — ${stateWord}, ${pct}%`;

  return (
    <li>
      <Link
        to={`/lesson/${unit.index}`}
        aria-label={a11yName}
        title={title}
        className={`flex min-h-[44px] items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 active:scale-[0.99] dark:hover:bg-ink-800/60 dark:focus-visible:bg-ink-800/60 ${
          isLocked ? 'opacity-80' : ''
        }`}
      >
        <ProgressRing
          phase={phase}
          pct={pct}
          label={String(unit.index + 1)}
          size={28}
          decorative
        />
        <span className="min-w-0 flex-1">
          {/* `break-words` is load-bearing, not decoration: the stage columns are
              ~60px of text width at desktop, and a single long word
              ("Comprehensive", "Relationships") is wider than that. Without
              breaking, `word-break: normal` lets it spill past the card edge
              and get clipped by the neighbouring column's border. */}
          <span
            className={`block break-words text-meta font-semibold leading-[1.15rem] ${
              isLocked ? 'text-ink-600 dark:text-ink-400' : 'text-ink-900 dark:text-ink-50'
            }`}
          >
            {title}
          </span>
          {/* Same constraint: the state word and the percentage are two flex
              items that together can exceed the column, so let them wrap
              rather than overrun the row. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-micro font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            {stateWord}
            <span aria-hidden="true">·</span>
            <span className={phase === 'current' ? 'text-accent-600 dark:text-accent-400' : undefined}>
              {pct}%
            </span>
          </span>
        </span>
        {/* The padlock states the gate. The row stays a link either way — see the
            soft-lock note at the top of this file. */}
        {isLocked && (
          <Lock className="h-3.5 w-3.5 shrink-0 text-ink-400 dark:text-ink-500" aria-hidden="true" />
        )}
      </Link>
      <CheckpointMilestone unitIndex={unit.index} locked={isLocked} />
    </li>
  );
}

/* ── one stage card ────────────────────────────────────────────────────────── */

/** A stage: code, name, lesson range, topic area, and its vertical lesson list. */
function StageCard({ cluster, units }: { cluster: Cluster; units: A1Unit[] }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getUnitPhase } = useA1Path();

  if (!units.length) return null;
  const from = units[0]!.index + 1;
  const to = units[units.length - 1]!.index + 1;
  const passedCount = units.filter((unit) => getUnitPhase(unit.index) === 'done').length;
  const headingId = `stage-${cluster.index}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900"
    >
      <header className="border-b border-ink-150 pb-2.5 dark:border-ink-800">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-micro font-extrabold uppercase tracking-[0.14em] text-accent-600 dark:text-accent-400">
            {isDE ? `Etappe ${cluster.index + 1}` : `Stage ${cluster.index + 1}`} · {cluster.code}
          </p>
          <p
            title={
              isDE
                ? `${passedCount} von ${units.length} bestanden`
                : `${passedCount} of ${units.length} passed`
            }
            className="shrink-0 text-micro font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500"
          >
            {passedCount}/{units.length}
          </p>
        </div>
        <h3
          id={headingId}
          className="mt-1 text-body font-bold leading-tight tracking-[-0.01em] text-ink-900 dark:text-ink-50"
        >
          {isDE ? cluster.title.de : cluster.title.en}
        </h3>
        <p className="mt-1 text-micro leading-4 text-ink-500 dark:text-ink-400">
          {isDE
            ? `Lektionen ${from}–${to} · ${cluster.topicArea.de}`
            : `Lessons ${from}–${to} · ${cluster.topicArea.en}`}
        </p>
      </header>
      <ol className="mt-1 flex flex-col">
        {units.map((unit) => (
          <LessonRow key={unit.id} unit={unit} phase={getUnitPhase(unit.index)} />
        ))}
      </ol>
    </section>
  );
}

/* ── the key ───────────────────────────────────────────────────────────────── */

/** The four ring states, so the colours are decodable without a tutorial. */
function RingLegend() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const items: { phase: A1UnitPhase; pct: number; en: string; de: string }[] = [
    { phase: 'done', pct: 100, en: 'Passed', de: 'Bestanden' },
    { phase: 'current', pct: 62, en: 'In progress', de: 'In Arbeit' },
    { phase: 'available', pct: 0, en: 'Open', de: 'Offen' },
    { phase: 'locked', pct: 0, en: 'Locked', de: 'Gesperrt' },
  ];

  return (
    <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-150 pt-4 dark:border-ink-800">
      {items.map((item) => (
        <li
          key={item.phase}
          className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400"
        >
          <ProgressRing phase={item.phase} pct={item.pct} label="" size={18} decorative />
          {isDE ? item.de : item.en}
        </li>
      ))}
      {/* The one glyph the legend cannot leave unexplained: the gate chip now
          says only "⚑ 4 · 80%", so the 80% rule is spelled out here, once. */}
      <li className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        <Flag className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
        {isDE ? 'Prüfung: 80 % schaltet frei' : 'Checkpoint: 80% unlocks'}
      </li>
    </ul>
  );
}

/* ── the roadmap ───────────────────────────────────────────────────────────── */

export function UnitSpine() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getUnitPhase, pathMode } = useA1Path();

  // SELF-GUIDED shows an open padlock, GUIDED a closed one. `getUnitPhase`
  // already reports 'available' instead of 'locked' in self mode, so this one
  // flag re-reads the whole roadmap — there is no lock logic of our own here.
  const selfMode = pathMode === 'self';
  const passedCount = A1_UNITS.filter((unit) => getUnitPhase(unit.index) === 'done').length;

  const chipBase =
    'inline-flex min-h-[28px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-micro font-semibold uppercase tracking-wider';

  return (
    <section id={ANCHORS.a1Spine} className="w-full py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-title font-bold tracking-[-0.02em] text-ink-900 dark:text-ink-50">
            {isDE ? 'Dein A1-Lernpfad' : 'Your A1 learning path'}
          </h2>
          <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
            {isDE
              ? `${A1_UNIT_COUNT} Lektionen in ${A1_CLUSTER_COUNT} Etappen. Zum Lernen auf eine Lektion klicken.`
              : `${A1_UNIT_COUNT} lessons across ${A1_CLUSTER_COUNT} stages. Click a lesson to open it.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`${chipBase} border-ink-200 bg-white text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300`}
          >
            {isDE
              ? `${passedCount} / ${A1_UNIT_COUNT} bestanden`
              : `${passedCount} / ${A1_UNIT_COUNT} passed`}
          </span>
          <span
            className={`${chipBase} ${
              selfMode
                ? 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-800/70 dark:bg-accent-950/40 dark:text-accent-300'
                : 'border-ink-200 bg-white text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300'
            }`}
          >
            {selfMode ? (
              <Unlock className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            {selfMode ? (isDE ? 'Selbstgeführt' : 'Self-guided') : isDE ? 'Geführt' : 'Guided'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {A1_CLUSTERS.map((cluster) => (
          <StageCard
            key={cluster.code}
            cluster={cluster}
            units={A1_UNITS.filter((unit) => unit.cluster === cluster.index)}
          />
        ))}
      </div>

      <RingLegend />
    </section>
  );
}
