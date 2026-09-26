/**
 * src/components/path/LearnerWaypoint.tsx
 *
 * A compact "where am I on the course?" marker for the app shell.
 *
 * The shell is four quiet destinations, so the learner's position in the A1
 * course needs its own persistent presence — this is that presence. It shows
 * the current lesson as a ring, the stage it belongs to, and the exact next
 * action, and links straight to it. It answers "where am I / what next?" in one
 * glance WITHOUT listing lessons, because the roadmap does that and this sits
 * in an 80px rail.
 *
 * WHY A RING, NOT THE OLD CHIP
 * The collapsed rail used to show a coloured pill carrying the module code —
 * a code, not a state. It said "M04" to someone who has no idea whether M04 is
 * finished, open or locked. The ring is the same component the roadmap uses, so
 * the rail's arc and the roadmap's arc are literally the same number, and the
 * rail now answers the question the code could not.
 *
 * Data is READ-ONLY from the existing path state: `useA1Path().getPushNode()`
 * is the same target Home's "Push" card uses, and the percentage comes from
 * `computeModuleProgress` — the shared function the roadmap and the dashboard
 * strip call. No new progress state, no second source of truth: if the rail and
 * the roadmap ever disagreed, one of them would be lying.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { A1_UNITS, getClusterForModule } from '../../data/a1Path';
import { ProgressRing } from './ProgressRing';
import { computeModuleProgress, phaseStateWord } from './moduleProgress';
import type { A1Unit } from '../../data/a1Path';
import type { A1UnitPhase } from '../../hooks/useA1Path';

interface LearnerWaypointProps {
  /** The rail is collapsed to an icon-only strip. */
  collapsed?: boolean;
}

/**
 * Module containing the push node, else the module the learner is standing on.
 *
 * Falls back to the first 'current' module. A SUPPORT module reports 'optional'
 * and is therefore never returned here — it must not become the rail's "you are
 * here" target, because the learner can be inside it while being on a different
 * module overall.
 */
function resolveUnit(
  pushUnitIndex: number | null,
  getUnitPhase: (index: number) => A1UnitPhase,
): A1Unit | null {
  if (pushUnitIndex !== null) {
    const pushUnit = A1_UNITS[pushUnitIndex];
    if (pushUnit) return pushUnit;
  }
  return A1_UNITS.find((unit) => getUnitPhase(unit.index) === 'current') ?? A1_UNITS[0] ?? null;
}

export function LearnerWaypoint({ collapsed = false }: LearnerWaypointProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getPushNode, getUnitPhase, isNodeComplete, isCheckpointComplete } = useA1Path();

  const pushNode = getPushNode();
  const unit = resolveUnit(pushNode ? pushNode.unitIndex : null, getUnitPhase);
  if (!unit) return null;

  // No push node left = the whole spine is done; fall back to the path itself.
  const target = pushNode?.to ?? '/learn';
  const nextLabel = pushNode ? (isDE ? pushNode.label.de : pushNode.label.en) : null;
  const unitTitle = isDE ? unit.title.de : unit.title.en;
  const fullLabel = nextLabel
    ? `${isDE ? 'Weiter' : 'Next'}: ${nextLabel}`
    : isDE
      ? 'Pfad abgeschlossen'
      : 'Path complete';

  const phase = getUnitPhase(unit.index);
  const passed = isCheckpointComplete(unit.index);
  const { pct } = computeModuleProgress(unit, isNodeComplete, isCheckpointComplete);
  const stageCode = getClusterForModule(unit.index).code;
  const stateWord = phaseStateWord(phase, passed, isDE);
  const lessonNumber = unit.index + 1;
  const accessibleName = `${isDE ? 'A1-Lernpfad' : 'A1 path'} · ${
    isDE ? `Lektion ${lessonNumber}` : `Lesson ${lessonNumber}`
  }: ${unitTitle} — ${stateWord}, ${pct}%. ${fullLabel}`;

  const ring = (
    // decorative: the link in both variants already carries `accessibleName`,
    // so the ring must not announce the same sentence a second time.
    <ProgressRing
      phase={phase}
      pct={pct}
      label={String(lessonNumber)}
      size={collapsed ? 26 : 32}
      decorative
    />
  );

  if (collapsed) {
    return (
      <Link
        to={target}
        title={`${unit.code} · ${unitTitle} — ${fullLabel}`}
        aria-label={accessibleName}
        className="flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 rounded-md border border-ink-200 bg-white py-1.5 transition hover:border-accent-300 hover:bg-accent-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 active:scale-95 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-800 dark:hover:bg-accent-950/40"
      >
        {ring}
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-500 dark:text-ink-400">
          {unit.code}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to={target}
      aria-label={accessibleName}
      className="group block rounded-md border border-ink-200 bg-white p-3 transition hover:border-accent-300 hover:bg-accent-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 active:scale-[0.99] dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-800 dark:hover:bg-accent-950/40"
    >
      <span className="block text-micro font-extrabold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        {isDE ? 'Dein A1-Pfad' : 'Your A1 path'}
      </span>
      <span className="mt-1.5 flex items-center gap-2.5">
        {ring}
        <span className="min-w-0">
          <span className="block text-micro font-extrabold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
            {unit.code} · {stageCode}
          </span>
          <span className="block truncate text-body font-bold text-ink-900 dark:text-ink-50">
            {unitTitle}
          </span>
        </span>
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-meta text-ink-600 dark:text-ink-300">
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{fullLabel}</span>
      </span>
    </Link>
  );
}
