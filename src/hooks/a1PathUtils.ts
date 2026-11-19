/** Shared A1 progress normalization for local storage and cloud writes. */
import {
  A1_UNIT_COUNT,
  A1_CURRICULUM,
  BAND_MIGRATION_MARKER,
  CHECKPOINT_PASS_THRESHOLD,
  M15_MIGRATION_MARKER,
  V3_TO_V4_UNIT_INDEX,
  V4_ORDER_MARKER,
  isBandNodeId,
  isLegacyPathNodeId,
  isModuleNodeId,
  isSixBandNodeId,
  remapBandToModuleIndex,
  remapLegacyUnitIndex,
  remapV3UnitIndex,
  remapV3NodeIds,
  type PathMode,
} from '../data/a1Path';

export function hasPassedCheckpoint(
  state: Pick<A1PathState, 'checkpointBestByUnit' | 'completedNodeIds'>,
  unitIndex: number,
): boolean {
  const unit = A1_CURRICULUM.units[unitIndex];
  if (!unit?.checkpoint) return false;
  if ((state.checkpointBestByUnit[unitIndex] ?? 0) >= CHECKPOINT_PASS_THRESHOLD) return true;
  return unit.nodeIds.some((id) =>
    A1_CURRICULUM.nodeMap[id]?.kind === 'checkpoint' && state.completedNodeIds.includes(id)
  );
}

export interface A1PathState {
  completedNodeIds: string[];
  unlockedUnitIndex: number;
  checkpointBestByUnit: Record<number, number>;
  /**
   * Per-band gate attempt history, keyed by unit index.
   *
   * This exists for ONE reason: the "Retry" button used to redraw a completely
   * random deck, so a learner who missed 4 items on a failed gate would
   * frequently never see those 4 items again — the retry taught them nothing
   * diagnostic. `missedItemKeys` is the payload that fixes it: A1CheckpointPage
   * seeds the next deck with exactly those items first.
   *
   * LOCAL-ONLY (Dexie) FOR NOW. Deliberately NOT in the `a1_path_state` cloud
   * payload, so shipping this needs no DB migration. Consequence: a learner on
   * a brand-new device falls back to a random deck, which is no worse than the
   * behaviour before this field existed. Add an `attempts_by_unit` JSONB column
   * + wire it in userDataService when a migration window is available.
   */
  attemptsByUnit: Record<number, CheckpointAttemptRecord>;
  /**
   * `'guided'` (default) or `'self'`. Gates progression vs. leaves every module
   * open. Synced across devices via `a1_path_state.path_mode`.
   */
  pathMode: PathMode;
}

/** One band's gate history. */
export interface CheckpointAttemptRecord {
  /** How many times this gate has been submitted. */
  attempts: number;
  /** Best score ever recorded (0..1) — mirrors checkpointBestByUnit. */
  best: number;
  /** Score of the most recent submission (0..1). */
  lastScore: number;
  /** ISO timestamp of the most recent submission. */
  lastAt: string;
  /**
   * Question keys missed on the MOST RECENT attempt. Capped (see
   * MAX_TRACKED_MISSES) so a hopeless round cannot bloat the persisted row.
   */
  missedItemKeys: string[];
}

/** Cap on persisted missed keys — a round can have at most ~15 items. */
export const MAX_TRACKED_MISSES = 20;

export const DEFAULT_STATE: A1PathState = {
  completedNodeIds: [],
  unlockedUnitIndex: 0,
  checkpointBestByUnit: {},
  attemptsByUnit: {},
  // Guided is the default because it is the behaviour every learner has today;
  // self mode is something they must opt into.
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
  // `let`, not `const`: the v3->v4 node-id migration below REBINDS this to the
  // remapped list. Same pattern as `markCheckpointResult` further down.
  let completedNodeIds = Array.isArray(raw.completedNodeIds)
    ? raw.completedNodeIds.filter((id): id is string => typeof id === 'string')
    : [];

  let unlockedRaw =
    typeof raw.unlockedUnitIndex === 'number' ? raw.unlockedUnitIndex : 0;
  let bestRaw =
    raw.checkpointBestByUnit && typeof raw.checkpointBestByUnit === 'object'
      ? raw.checkpointBestByUnit
      : {};

  // attemptsByUnit is optional on the wire (absent from the cloud row and from
  // pre-Wave-1 Dexie rows), so it always coerces to {} rather than throwing.
  let attemptsRaw: Record<number, CheckpointAttemptRecord> = {};
  if (raw.attemptsByUnit && typeof raw.attemptsByUnit === 'object') {
    for (const [k, v] of Object.entries(raw.attemptsByUnit)) {
      const idx = Number(k);
      if (!Number.isFinite(idx) || idx < 0 || idx >= A1_UNIT_COUNT) continue;
      attemptsRaw[idx] = normalizeAttempt(v);
    }
  }

  // One-time band migration: an OLD (5-unit) state is detected by the presence
  // of a legacy `uN-` node id with NO new band id yet. We REMAP `unlockedUnitIndex`
  // and `checkpointBestByUnit` keys to the new band indices (see LEGACY_TO_BAND_INDEX)
  // and never wipe completedNodeIds. The BAND_MIGRATION_MARKER makes the remap
  // idempotent — the very next hydrate sees a new-band id and skips it.
  const hasLegacy = completedNodeIds.some(isLegacyPathNodeId);
  const hasNewBand = completedNodeIds.some(isBandNodeId);
  if (hasLegacy && !hasNewBand) {
    unlockedRaw = remapLegacyUnitIndex(unlockedRaw);
    const remappedBest: Record<number, number> = {};
    for (const [k, v] of Object.entries(bestRaw)) {
      const oldIdx = Number(k);
      if (!Number.isFinite(oldIdx) || oldIdx < 0 || oldIdx > 4) continue;
      remappedBest[remapLegacyUnitIndex(oldIdx)] = Number(v);
    }
    bestRaw = remappedBest;
    completedNodeIds.push(BAND_MIGRATION_MARKER);
  }

  // SECOND one-time migration: 6-band (A–F) -> 15-module (M01–M15).
  //
  // Detection mirrors the first migration exactly: a band-shaped id with no
  // module-shaped id yet. Both branches are independent and can run back to back
  // on a single very old state (5-unit -> 6-band -> 15-module), because each only
  // fires when the NEXT scheme is absent.
  //
  // Only the INDEX is remapped. `completedNodeIds` is never rewritten or pruned
  // — the old `a-`/`b-` ids simply stop matching any node, which is harmless
  // (path lookups ignore unknown ids) and guarantees the learner's completed
  // history is never silently destroyed. The learner re-visits the new module
  // nodes; visit-based completion re-marks them, and the gate they already passed
  // is honoured through `unlockedUnitIndex` + `checkpointBestByUnit`.
  const hasSixBand = completedNodeIds.some(isSixBandNodeId);
  const hasModule = completedNodeIds.some(isModuleNodeId);
  if (hasSixBand && !hasModule) {
    unlockedRaw = remapBandToModuleIndex(unlockedRaw);
    const remappedBest: Record<number, number> = {};
    for (const [k, v] of Object.entries(bestRaw)) {
      const oldIdx = Number(k);
      if (!Number.isFinite(oldIdx) || oldIdx < 0 || oldIdx > 5) continue;
      remappedBest[remapBandToModuleIndex(oldIdx)] = Number(v);
    }
    bestRaw = remappedBest;
    completedNodeIds.push(M15_MIGRATION_MARKER);
  }

  // ── v3 order -> v4.0 order ───────────────────────────────────────────────
  // Fires for EVERY existing learner on first load after the reorder, because
  // none of them can be carrying the new marker yet.
  //
  // Two things move, and the second is easy to miss:
  //   1. everything keyed by unit INDEX — `unlockedUnitIndex`,
  //      `checkpointBestByUnit`, `attemptsByUnit` (see V3_TO_V4_UNIT_INDEX);
  //   2. every NODE id in `completedNodeIds`, because the v4.0 pass renamed 20
  //      node ids from semantic to positional (`m06-professions` → `m06-learn`,
  //      `mNN-gate` → `mNN-checkpoint`). This used to be skipped on the
  //      assumption that only ORDER changed. It did not: `isNodeComplete` is
  //      `completedNodeIds.includes(node.id)`, so a learner who finished
  //      `m06-professions` saw that node revert to incomplete. Roughly twenty
  //      finished nodes per learner were being silently discarded.
  //
  // `missedItemKeys` are cleared on remap rather than carried across: Phase 1
  // changed those units' decks (m07 gained `prepositions`, m10 moved to its own
  // `accusative` pool, m12 gained `dative`), so the recorded misses point at
  // items the retry can no longer find. `best` and `attempts` survive, so the
  // learner keeps their score history and attempt count.
  if (!completedNodeIds.includes(V4_ORDER_MARKER)) {
    unlockedRaw = remapV3UnitIndex(unlockedRaw);

    const remapKeyed = <T,>(src: Record<number, T>): Record<number, T> => {
      const out: Record<number, T> = {};
      for (const [k, v] of Object.entries(src)) {
        const oldIdx = Number(k);
        if (!Number.isFinite(oldIdx) || oldIdx < 0 || oldIdx >= V3_TO_V4_UNIT_INDEX.length) continue;
        out[remapV3UnitIndex(oldIdx)] = v;
      }
      return out;
    };

    const remappedAttempts = remapKeyed(attemptsRaw);
    for (const record of Object.values(remappedAttempts)) {
      record.missedItemKeys = [];
    }
    attemptsRaw = remappedAttempts;
    bestRaw = remapKeyed(bestRaw);
    // Node ids are remapped BEFORE the marker is pushed, so the marker is not
    // itself run through the map. `remapV3NodeIds` is idempotent regardless,
    // but keeping the marker out of it makes the intent obvious.
    completedNodeIds = remapV3NodeIds(completedNodeIds);
    completedNodeIds.push(V4_ORDER_MARKER);
  }

  return {
    completedNodeIds,
    unlockedUnitIndex: Math.max(0, Math.min(unlockedRaw, A1_UNIT_COUNT - 1)),
    checkpointBestByUnit: bestRaw,
    attemptsByUnit: attemptsRaw,
    // Absent on every row written before the field existed, and could be
    // anything in a hand-edited row. Both load as 'guided' — the behaviour they
    // already had — so this can never silently promote someone to self mode.
    pathMode: raw.pathMode === 'self' ? 'self' : 'guided',
  };
}
