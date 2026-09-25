/**
 * src/components/path/LearnerWaypoint.tsx
 *
 * A compact "where am I on the course?" strip for the app shell.
 *
 * The shell is now four quiet destinations, so the learner's position in the
 * A1 course needs its own persistent presence — this is that presence. It shows
 * the current band (A1 · Band C) and the exact next node, and links straight to
 * it, so the rail answers "where am I / what next?" without listing lessons.
 *
 * Data is READ-ONLY from the existing path state: `useA1Path().getPushNode()`
 * is the same target Home's "Push" card uses, and `A1_UNITS` is the curriculum
 * config. No new progress state, no second source of truth — if the spine and
 * this strip ever disagreed, one of them would be lying.
 *
 * Collapsed rail: renders the band code as a single chip (the full strip does
 * not fit an 80px column).
 */

import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { A1_UNITS } from '../../data/a1Path';
import type { A1Unit } from '../../data/a1Path';

interface LearnerWaypointProps {
  /** The rail is collapsed to an icon-only strip. */
  collapsed?: boolean;
}

/** Band containing the push node, else the band the learner is standing on. */
function resolveUnit(
  pushUnitIndex: number | null,
  getUnitPhase: (index: number) => 'locked' | 'current' | 'done',
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
  const { getPushNode, getUnitPhase } = useA1Path();

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

  if (collapsed) {
    return (
      <Link
        to={target}
        title={`A1 · ${unitTitle} — ${fullLabel}`}
        aria-label={`A1 ${isDE ? 'Lernpfad' : 'path'} · ${unitTitle} — ${fullLabel}`}
        className="flex h-11 w-full items-center justify-center rounded-sm border border-ink-200 bg-white text-meta font-extrabold text-accent-700 transition hover:border-accent-300 hover:bg-accent-50 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 dark:border-ink-800 dark:bg-ink-900 dark:text-accent-300 dark:hover:border-accent-800"
      >
        {unit.code}
      </Link>
    );
  }

  return (
    <Link
      to={target}
      className="group block rounded-sm border border-ink-200 bg-white p-3 transition hover:border-accent-300 hover:bg-accent-50 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-accent-800 dark:hover:bg-accent-950/40"
    >
      <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        {isDE ? 'Dein A1-Pfad' : 'Your A1 path'}
      </span>
      <span className="mt-1 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-meta font-extrabold text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
          {unit.code}
        </span>
        <span className="min-w-0 truncate text-body font-bold text-ink-900 dark:text-white">{unitTitle}</span>
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-meta text-ink-600 dark:text-ink-300">
        <Target className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{fullLabel}</span>
      </span>
    </Link>
  );
}
