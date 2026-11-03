/** Pure helpers for A1 path state normalisation. Extracted so useA1Path.tsx
 * only exports the React hook (react/only-export-components). */

import type { A1PathState } from './useA1Path';
import { A1_UNIT_COUNT, isBandNodeId, isLegacyPathNodeId } from '../data/a1Path';

export interface CheckpointAttemptRecord {
  attempts: number;
  best: number;
  lastScore: number;
  lastAt: string;
  missedItemKeys: string[];
}

const MAX_TRACKED_MISSES = 10;

const DEFAULT_STATE: A1PathState = {
  completedNodeIds: [],
  unlockedUnitIndex: 0,
  checkpointBestByUnit: {},
  attemptsByUnit: {},
  pathMode: 'guided',
};

/** Coerce a raw/partial attempt record into a valid one. */
export function normalizeAttempt(raw: unknown): CheckpointAttemptRecord {
  const r = (raw ?? {}) as Partial<CheckpointAttemptRecord>;
  const attempts = Number.isFinite(r.attempts) ? Math.max(0, Number(r.attempts)) : 0;
  const best = Number.isFinite(r.best) ? Math.max(0, Math.min(1, Number(r.best))) : 0;
  const lastScore = Number.isFinite(r.lastScore) ? Math.max(0, Math.min(1, Number(r.lastScore))) : best;
  return {
    attempts,
    best,
    lastScore,
    lastAt: typeof r.lastAt === 'string' ? r.lastAt : new Date(0).toISOString(),
    missedItemKeys: Array.isArray(r.missedItemKeys)
      ? r.missedItemKeys.filter((k): k is string => typeof k === 'string').slice(0, MAX_TRACKED_MISSES)
      : [],
  };
}

/** True when a state object carries any real progress worth hydrating/migrating. */
export function hasProgress(s: Partial<A1PathState>): boolean {
  return (
    (Array.isArray(s.completedNodeIds) && s.completedNodeIds.length > 0) ||
    (typeof s.unlockedUnitIndex === 'number' && s.unlockedUnitIndex > 0) ||
    Boolean(
      s.checkpointBestByUnit && Object.keys(s.checkpointBestByUnit).length > 0
    ) ||
    Boolean(s.attemptsByUnit && Object.keys(s.attemptsByUnit).length > 0)
  );
}

/** Clamp/normalize any partial state into a valid A1PathState. */
export function normalizeState(raw: Partial<A1PathState>): A1PathState {
  let completedNodeIds = Array.isArray(raw.completedNodeIds)
    ? raw.completedNodeIds.filter((id): id is string => typeof id === 'string')
    : [];

  let unlockedRaw =
    typeof raw.unlockedUnitIndex === 'number' ? raw.unlockedUnitIndex : 0;
  let bestRaw =
    raw.checkpointBestByUnit && typeof raw.checkpointBestByUnit === 'object'
      ? raw.checkpointBestByUnit
      : {};

  let attemptsRaw: Record<number, CheckpointAttemptRecord> = {};
  if (raw.attemptsByUnit && typeof raw.attemptsByUnit === 'object') {
    for (const [k, v] of Object.entries(raw.attemptsByUnit)) {
      const idx = Number(k);
      if (!Number.isFinite(idx) || idx < 0 || idx >= A1_UNIT_COUNT) continue;
      attemptsRaw[idx] = normalizeAttempt(v);
    }
  }

  const hasLegacy = completedNodeIds.some(isLegacyPathNodeId);
  const hasNewBand = completedNodeIds.some(isBandNodeId);

  if (hasLegacy && !hasNewBand) {
    unlockedRaw = Math.max(0, Math.min(A1_UNIT_COUNT - 1, unlockedRaw));
  }

  return {
    ...DEFAULT_STATE,
    completedNodeIds,
    unlockedUnitIndex: Math.max(0, Math.min(A1_UNIT_COUNT - 1, unlockedRaw)),
    checkpointBestByUnit: bestRaw,
    attemptsByUnit: attemptsRaw,
    pathMode: raw.pathMode ?? 'guided',
  };
}