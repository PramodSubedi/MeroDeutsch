/**
 * src/components/path/PathNode.tsx
 *
 * A single spine node (learn / practice / checkpoint / bonus) on the /learn
 * campaign. Reuses existing routes only. Visual state (locked / current /
 * done) is derived from useA1Path. Touch targets >=44px, primary buttons
 * get `active:scale-95` (E1.4).
 */

import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import type { PathNode } from '../../data/a1Path';

export type UnitPhase = 'locked' | 'current' | 'done';

interface PathNodeProps {
  node: PathNode;
  /** Phase of the unit this node belongs to. */
  unitPhase: UnitPhase;
}

const NODE_ICON: Record<PathNode['kind'], string> = {
  learn: '📚',
  practice: '⚡',
  checkpoint: '✅',
  bonus: '⭐',
};

export function PathNodeItem({ node, unitPhase }: PathNodeProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isNodeUnlocked, isNodeComplete, completeNode } = useA1Path();

  const unlocked = unitPhase !== 'locked' ? isNodeUnlocked(node) : false;
  const complete = isNodeComplete(node);
  const isCheckpoint = node.kind === 'checkpoint';

  // Locked node: still rendered (soft lock), but not navigable.
  if (!unlocked) {
    return (
      <div
        className="pointer-events-none inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-400 opacity-60 dark:bg-slate-800 dark:text-slate-500"
        aria-label={isDE ? `${node.label.de} (gesperrt)` : `${node.label.en} (locked)`}
      >
        <span aria-hidden="true">🔒</span>
        <span className="truncate">{isDE ? node.label.de : node.label.en}</span>
      </div>
    );
  }

  const base =
    'inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95';
  // State via surface tint + shadow, not rigid outlines.
  const variant: string = isCheckpoint
    ? complete
      ? 'bg-emerald-50 text-emerald-800 shadow-sm hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300'
      : 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-700'
    : complete
      ? 'bg-emerald-50 text-emerald-800 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-300'
      : 'bg-blue-50 text-blue-800 shadow-sm hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300';

  const handleClick = () => {
    // Visit-completion for learn/practice (rule A). Idempotent. Checkpoint
    // completes only on a passing score (handled in the checkpoint page).
    if (node.kind === 'learn' || node.kind === 'practice') {
      completeNode(node.id);
    }
  };

  return (
    <Link
      to={node.to}
      onClick={handleClick}
      className={base + ' ' + variant}
      aria-label={
        isDE
          ? `${node.label.de}${complete ? ' ✅' : ''}`
          : `${node.label.en}${complete ? ' ✅' : ''}`
      }
    >
      <span aria-hidden="true">
        {complete ? '✅' : NODE_ICON[node.kind]}
      </span>
      <span className="truncate">{isDE ? node.label.de : node.label.en}</span>
    </Link>
  );
}