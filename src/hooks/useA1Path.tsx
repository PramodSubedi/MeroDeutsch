/**
 * src/hooks/useA1Path.tsx
 *
 * A1 learning-path state — single source of truth for the linear campaign.
 *
 * Storage architecture (cross-device sync upgrade):
 *   PRIMARY   : Dexie (IndexedDB) table `a1PathState`, keyed by userId
 *               ('guest' included) — offline-first, every write lands here first.
 *   CLOUD     : Supabase table `a1_path_state` — debounced upsert when
 *               authenticated; failed/offline writes are queued via
 *               syncService.queueA1PathPush and replayed on reconnect.
 *   HYDRATION : Dexie row → (if empty & authed) Supabase row → (if still
 *               empty) one-time migration from the LEGACY localStorage key
 *               `meroDeutschA1Path:<userId>`, which is removed after a
 *               successful copy so no existing learner loses progress.
 *
 * This key NEVER touches the existing progress / review-queue / XP keys
 * (mero_deutsch_progress / review_queue / mero_deutsch_xp / user_progress /
 *  user_achievements), satisfying .clinerules C13/C14.
 *
 * State:
 *  - completedNodeIds: learn/practice nodes completed (visit = complete, rule A)
 *  - unlockedUnitIndex: highest fully-passed checkpoint's unitIndex -> gates later units
 *  - checkpointBestByUnit: best score (0..1) per unit, persisted across retries
 *
 * Locked rules enforced here:
 *  - unlockedUnitIndex NEVER decreases.
 *  - unitIndex is clamped to [0, A1_UNIT_COUNT - 1].
 *  - Only a checkpoint pass (>= CHECKPOINT_PASS_THRESHOLD) advances a unit.
 *
 * The provider is mounted once in main.tsx (inside AuthProvider so it can read
 * the real userId). Visit-based node completion is performed by
 * `A1PathVisitTracker` (mounted under the Router in Layout), NOT here, so the
 * provider itself needs no router context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './useAuth';
import { db } from '../lib/db';
import type { A1PathStateRow } from '../lib/db';
import { userDataService } from '../services/userDataService';
import { queueA1PathPush } from '../services/syncService';
import { getItem, removeItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import {
  A1_CURRICULUM,
  A1_LEARN_NODES,
  A1_UNIT_COUNT,
  BAND_MIGRATION_MARKER,
  CHECKPOINT_PASS_THRESHOLD,
  M15_MIGRATION_MARKER,
  V3_TO_V4_UNIT_INDEX,
  V4_ORDER_MARKER,
  getNextGatedBandIndex,
  isBandNodeId,
  isLegacyPathNodeId,
  isModuleNodeId,
  isSixBandNodeId,
  remapBandToModuleIndex,
  remapLegacyUnitIndex,
  remapV3UnitIndex,
  remapV3NodeIds,
  type PathMode,
  type PathNode,
} from '../data/a1Path';

/** Legacy localStorage base key — read-only, migrated into Dexie once. */
const LEGACY_STORAGE_BASE = 'meroDeutschA1Path';

/** Debounce window for the Supabase cloud mirror (ms). */
const CLOUD_DEBOUNCE_MS = 600;

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

const DEFAULT_STATE: A1PathState = {
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

/** Write-through to Dexie (the offline-first primary store). Never throws. */
async function persistToDexie(userId: string, state: A1PathState): Promise<void> {
  if (!db) return;
  const row: A1PathStateRow = {
    userId,
    unlockedUnitIndex: state.unlockedUnitIndex,
    completedNodeIds: state.completedNodeIds,
    checkpointBestByUnit: state.checkpointBestByUnit,
    attemptsByUnit: state.attemptsByUnit,
    pathMode: state.pathMode,
    updatedAt: new Date().toISOString(),
  };
  try {
    await db.a1PathState.put(row);
  } catch (err) {
    console.warn('[a1Path] Dexie persist failed:', err);
  }
}

/**
 * Display phase of a band.
 *
 *   locked   — beyond `unlockedUnitIndex`; its gate is not yet passed
 *   current  — the band the learner is working in
 *   done     — behind the learner; its gate IS passed
 *   optional — SUPPORT band (B): always reachable, never gated, never "done"
 *
 * `optional` exists so a support band is not rendered as a permanently
 * in-progress unit (see getUnitPhase).
 *
 * `available` is the SELF-GUIDED "open, not started" state. In guided mode a
 * module is either reachable ('current'/'done') or gated ('locked'), so this
 * state can never be produced there — it exists purely so self mode does not
 * have to render untouched modules with a "Locked" pill, which would be a lie.
 */
export type A1UnitPhase = 'locked' | 'current' | 'done' | 'optional' | 'available';

export interface A1PathContextValue extends A1PathState {
  userId: string;
  /** learn/practice node id marked complete on visit. */
  completeNode: (id: string) => void;
  /**
   * Record a checkpoint attempt result for a unit. Advances unlock forward only
   * when score >= threshold; always persists the best score seen so Retry has
   * history. `missedItemKeys` are the question keys the learner got wrong —
   * the next attempt seeds its deck with exactly those.
   */
  markCheckpointResult: (unitIndex: number, score: number, missedItemKeys?: string[]) => void;
  /** Is this unit's checkpoint passed? */
  isCheckpointComplete: (unitIndex: number) => boolean;
  /**
   * Is this unit unlocked? In self mode ALWAYS true (that is the whole point);
   * otherwise `unitIndex <= unlockedUnitIndex`.
   */
  isUnitUnlocked: (unitIndex: number) => boolean;
  isNodeUnlocked: (node: PathNode) => boolean;
  isNodeComplete: (node: PathNode) => boolean;
  /** First incomplete node within unlocked units (the "Push" target), or null. */
  getPushNode: () => PathNode | null;
  /** Unit display phase for the spine. */
  getUnitPhase: (unitIndex: number) => A1UnitPhase;
  /**
   * Switch between 'guided' and 'self'.
   *
   * FORWARD-ONLY: switching INTO guided raises `unlockedUnitIndex` to the
   * highest module the learner has actually reached (completed nodes or passed
   * checkpoints) rather than re-locking finished work, and it never lowers it.
   */
  setPathMode: (mode: PathMode) => void;
  /** Clear all A1 path data (debug / reset). Does not touch XP/queue/progress. */
  resetPath: () => void;
}

const A1PathContext = createContext<A1PathContextValue | undefined>(undefined);

interface A1PathProviderProps {
  children: ReactNode;
}

export function A1PathProvider({ children }: A1PathProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? 'guest';
  const legacyKey = useMemo(() => scopedKey(LEGACY_STORAGE_BASE, userId), [userId]);

  const [state, setState] = useState<A1PathState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Ref mirroring latest state so async hydration/cloud callbacks never read
  // a stale render-closure value.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /* ────────────────────────────────────────────────────────────
   * Hydration: Dexie → Supabase (authed) → legacy localStorage.
   * Runs once per identity change.
   * ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setHydrated(false);
      let next: A1PathState = DEFAULT_STATE;

      // 1. Primary: local Dexie row.
      if (db) {
        try {
          const row = await db.a1PathState.get(userId);
          if (row) next = normalizeState(row);
        } catch (err) {
          console.warn('[a1Path] Dexie read failed:', err);
        }
      }

      // 2. Cloud fallback: authenticated user with no local progress yet
      //    (e.g. first login on a new device) pulls the cloud row.
      if (!hasProgress(next) && isAuthenticated && user?.userId === userId) {
        try {
          const cloud = await userDataService.getA1PathState(userId);
          if (cloud && hasProgress(cloud)) {
            next = normalizeState(cloud);
            void persistToDexie(userId, next); // seed local from cloud
          }
        } catch (err) {
          console.warn('[a1Path] cloud hydration failed:', err);
        }
      }

      // 3. Legacy localStorage one-time migration (pre-Dexie installs).
      if (!hasProgress(next)) {
        const raw = getItem(legacyKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<A1PathState>;
            if (hasProgress(parsed)) {
              next = normalizeState(parsed);
              void persistToDexie(userId, next);
              removeItem(legacyKey); // migrated — retire the legacy key
            } else {
              removeItem(legacyKey); // empty legacy shell — clean up
            }
          } catch {
            removeItem(legacyKey); // malformed — clean up
          }
        }
      }

      // Persist the migration markers back so every remap is idempotent — the
      // very next hydrate sees the marker and skips the work. This is a no-op for
      // fresh and already-migrated states.
      //
      // Checked against ALL THREE markers, not just the band one. It used to
      // check `BAND_MIGRATION_MARKER` alone, so a state that had already passed
      // through the 5->6 step was never written back after the 6->15 remap: the
      // remap re-ran on every single load and the Dexie row kept the old indices
      // forever. The remapped values still reached Supabase (a separate effect
      // pushes `state` once hydrated), which is why it went unnoticed — guests,
      // who have no cloud row, simply re-migrated on every visit.
      if (
        next.completedNodeIds.includes(BAND_MIGRATION_MARKER) ||
        next.completedNodeIds.includes(M15_MIGRATION_MARKER) ||
        next.completedNodeIds.includes(V4_ORDER_MARKER)
      ) {
        void persistToDexie(userId, next);
      }

      if (!cancelled) {
        setState(next);
        setHydrated(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, isAuthenticated, user?.userId, legacyKey]);

  /* ────────────────────────────────────────────────────────────
   * Cloud mirror: debounced Supabase upsert when authenticated.
   * Offline/failed pushes are queued for replay by executeSync().
   * ──────────────────────────────────────────────────────────── */
  const cloudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;

    if (cloudTimeoutRef.current) clearTimeout(cloudTimeoutRef.current);
    cloudTimeoutRef.current = setTimeout(() => {
      userDataService
        .saveA1PathState(user.userId, stateRef.current)
        .catch((err) => {
          console.warn('[a1Path] cloud push failed (queued):', err);
          queueA1PathPush(user.userId);
        });
    }, CLOUD_DEBOUNCE_MS);

    return () => {
      if (cloudTimeoutRef.current) clearTimeout(cloudTimeoutRef.current);
    };
  }, [state, hydrated, isAuthenticated, user]);

  /* ────────────────────────────────────────────────────────────
   * Cross-tab freshness: after any write, notify other tabs; they
   * re-read the Dexie row (single-writer-per-tab, Dexie is shared).
   * ──────────────────────────────────────────────────────────── */
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('meroDeutschA1Path');
    channel.onmessage = (event: MessageEvent<{ userId?: string }>) => {
      if (event.data?.userId !== userId || !db) return;
      void db.a1PathState
        .get(userId)
        .then((row) => {
          if (row) setState(normalizeState(row));
        })
        .catch(() => {
          /* ignore */
        });
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [userId]);

  const broadcast = useCallback(() => {
    channelRef.current?.postMessage({ userId });
  }, [userId]);

  /* ────────────────────────────────────────────────────────────
   * Mutations — setState + immediate Dexie write (offline-first).
   * ──────────────────────────────────────────────────────────── */

  const completeNode = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.completedNodeIds.includes(id)) return prev;
        const next: A1PathState = {
          ...prev,
          completedNodeIds: [...prev.completedNodeIds, id],
        };
        void persistToDexie(userId, next);
        broadcast();
        return next;
      });
    },
    [userId, broadcast]
  );

  const markCheckpointResult = useCallback(
    (unitIndex: number, score: number, missedItemKeys: string[] = []) => {
      const safeUnit = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
      setState((prev) => {
        const prevBest = prev.checkpointBestByUnit[safeUnit] ?? 0;
        const best = Math.max(prevBest, score);
        const passed = best >= CHECKPOINT_PASS_THRESHOLD;

        const checkpointNode = A1_CURRICULUM.units[safeUnit]?.nodeIds
          .map((id) => A1_CURRICULUM.nodeMap[id])
          .find((n) => n.kind === 'checkpoint');

        let completedNodeIds = prev.completedNodeIds;
        if (passed && checkpointNode && !completedNodeIds.includes(checkpointNode.id)) {
          completedNodeIds = [...completedNodeIds, checkpointNode.id];
        }

        // Advance to the NEXT CORE band (getNextGatedBandIndex skips support
        // band B) when the gate is passed; unlock NEVER decreases; clamp top.
        const unlockedUnitIndex = Math.min(
          passed
            ? Math.max(prev.unlockedUnitIndex, getNextGatedBandIndex(safeUnit))
            : prev.unlockedUnitIndex,
          A1_UNIT_COUNT - 1
        );

        const prevAttempt = prev.attemptsByUnit[safeUnit];

        const next: A1PathState = {
          ...prev,
          completedNodeIds,
          unlockedUnitIndex,
          checkpointBestByUnit: { ...prev.checkpointBestByUnit, [safeUnit]: best },
          attemptsByUnit: {
            ...prev.attemptsByUnit,
            [safeUnit]: normalizeAttempt({
              attempts: (prevAttempt?.attempts ?? 0) + 1,
              best,
              lastScore: score,
              lastAt: new Date().toISOString(),
              // Keep the miss list from the previous FAILED attempt while the
              // learner retries, and overwrite it with the new one on every
              // submission. A passed gate clears it — there is nothing left to
              // re-drill, and a stale list would leak into Analytics' "weakest
              // items" panel long after the band was done.
              missedItemKeys: passed ? [] : missedItemKeys,
            }),
          },
        };
        void persistToDexie(userId, next);
        broadcast();
        return next;
      });
    },
    [userId, broadcast]
  );

  const resetPath = useCallback(() => {
    setState(DEFAULT_STATE);
    void persistToDexie(userId, DEFAULT_STATE);
    if (isAuthenticated && user) {
      // Best-effort cloud reset so other devices converge.
      userDataService
        .saveA1PathState(user.userId, DEFAULT_STATE)
        .catch(() => queueA1PathPush(user.userId));
    }
    broadcast();
  }, [userId, isAuthenticated, user, broadcast]);

  const isCheckpointComplete = useCallback(
    (unitIndex: number) => {
      const safe = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
      const band = A1_CURRICULUM.units[safe];
      // SUPPORT bands (B) carry no checkpoint — treat as not passed.
      if (!band || band.kind === 'support') return false;
      // Passing `safe`'s gate advanced unlockedUnitIndex to at least the NEXT
      // CORE band index (getNextGatedBandIndex skips support bands like B).
      return state.unlockedUnitIndex >= getNextGatedBandIndex(safe);
    },
    [state.unlockedUnitIndex]
  );

  const isUnitUnlocked = useCallback(
    (unitIndex: number) => {
      // SELF-GUIDED: everything is open. This single line is what un-gates the
      // whole spine, and it also makes A1CheckpointPage's existing
      // `if (!unlocked) return <Locked/>` branch unreachable in self mode —
      // which is the correct behaviour there, not an oversight.
      if (state.pathMode === 'self') return true;

      const safe = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
      const band = A1_CURRICULUM.units[safe];
      // SUPPORT bands (B) are always accessible — they never gate.
      if (band && band.kind === 'support') return true;
      return safe <= state.unlockedUnitIndex;
    },
    [state.unlockedUnitIndex, state.pathMode]
  );

  const isNodeComplete = useCallback(
    (node: PathNode) => {
      if (node.kind === 'checkpoint') return isCheckpointComplete(node.unitIndex);
      return state.completedNodeIds.includes(node.id);
    },
    [state.completedNodeIds, isCheckpointComplete]
  );

  const isNodeUnlocked = useCallback(
    (node: PathNode) => {
      // Bonus chips are reachable when their unit is unlocked; they never gate.
      return isUnitUnlocked(node.unitIndex);
    },
    [isUnitUnlocked]
  );

  const getPushNode = useCallback((): PathNode | null => {
    // SELF-GUIDED: "continue where you left off".
    //
    // Guided mode wants the first incomplete node in ascending order, which is
    // well defined because exactly one frontier exists. In self mode the learner
    // may be anywhere, so walking the list from the top would always return
    // M01 — telling someone to redo greetings when they are halfway through
    // Module 11. Instead we resume inside the HIGHEST module they have touched.
    if (state.pathMode === 'self') {
      let highestTouched = -1;
      for (const node of A1_LEARN_NODES) {
        const done =
          node.kind === 'checkpoint'
            ? isCheckpointComplete(node.unitIndex)
            : state.completedNodeIds.includes(node.id);
        if (done && node.unitIndex > highestTouched) highestTouched = node.unitIndex;
      }
      const from = highestTouched >= 0 ? highestTouched : 0;
      for (const node of A1_LEARN_NODES) {
        if (node.unitIndex < from) continue;
        if (node.kind === 'checkpoint') {
          if (!isCheckpointComplete(node.unitIndex)) return node;
        } else if (node.kind === 'learn' || node.kind === 'practice') {
          if (!state.completedNodeIds.includes(node.id)) return node;
        }
      }
      // Everything the learner has touched is finished; fall back to the
      // earliest module with anything outstanding so the CTA still has a target.
      for (const node of A1_LEARN_NODES) {
        if (node.kind === 'checkpoint') {
          if (!isCheckpointComplete(node.unitIndex)) return node;
        } else if (node.kind === 'learn' || node.kind === 'practice') {
          if (!state.completedNodeIds.includes(node.id)) return node;
        }
      }
      return null;
    }

    for (const node of A1_LEARN_NODES) {
      if (node.unitIndex > state.unlockedUnitIndex) continue; // locked unit
      if (node.kind === 'checkpoint') {
        if (!isCheckpointComplete(node.unitIndex)) return node;
      } else if (node.kind === 'learn' || node.kind === 'practice') {
        if (!state.completedNodeIds.includes(node.id)) return node;
      }
    }
    return null;
  }, [state.unlockedUnitIndex, state.completedNodeIds, state.pathMode, isCheckpointComplete]);

  const getUnitPhase = useCallback(
    (unitIndex: number): A1UnitPhase => {
      const safe = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
      const band = A1_CURRICULUM.units[safe];
      // SUPPORT bands are optional side tracks and stay 'optional' in BOTH
      // modes — they are not part of the linear sequence either way.
      if (band && band.kind === 'support') return 'optional';

      if (state.pathMode === 'self') {
        // Nothing is gated, so the frontier concept ('current' = the one module
        // the gate points at) does not exist. Report real progress instead:
        // finished, in progress, or simply open. Rendering 'locked' here would
        // be a straight lie.
        if (safe < state.unlockedUnitIndex) return 'done';
        if (isCheckpointComplete(safe)) return 'done';
        const touched = A1_LEARN_NODES.some(
          (n) => n.unitIndex === safe && state.completedNodeIds.includes(n.id),
        );
        return touched ? 'current' : 'available';
      }

      if (safe < state.unlockedUnitIndex) return 'done';
      if (safe === state.unlockedUnitIndex) return 'current';
      return 'locked';
    },
    [state.unlockedUnitIndex, state.completedNodeIds, state.pathMode, isCheckpointComplete],
  );

  /**
   * Highest module index the learner has demonstrably reached, derived from real
   * progress: any completed node, or a passed checkpoint.
   *
   * This is what makes self -> guided safe. Without it, a learner who completed
   * M01–M06 in self mode still has `unlockedUnitIndex === 0` (they never passed a
   * gate), so switching back to guided would re-lock M02–M07 — modules they had
   * already done. That is a trust-destroying surprise, so the floor is raised to
   * wherever they actually are instead.
   */
  const highestReachedIndex = useCallback(
    (s: A1PathState): number => {
      let highest = -1;
      for (const node of A1_LEARN_NODES) {
        if (s.completedNodeIds.includes(node.id) && node.unitIndex > highest) {
          highest = node.unitIndex;
        }
      }
      for (const [k, v] of Object.entries(s.checkpointBestByUnit)) {
        if (typeof v === 'number' && v >= CHECKPOINT_PASS_THRESHOLD) {
          const idx = Number(k);
          if (Number.isFinite(idx) && idx > highest) highest = idx;
        }
      }
      return highest;
    },
    [],
  );

  const setPathMode = useCallback(
    (mode: PathMode) => {
      setState((prev) => {
        if (prev.pathMode === mode) return prev;
        // FORWARD-ONLY. Entering guided may raise the floor to match real
        // progress; nothing here can ever lower `unlockedUnitIndex`, which
        // preserves the existing never-revoke invariant.
        const floor =
          mode === 'guided'
            ? Math.max(prev.unlockedUnitIndex, highestReachedIndex(prev))
            : prev.unlockedUnitIndex;
        const next: A1PathState = {
          ...prev,
          pathMode: mode,
          unlockedUnitIndex: Math.max(0, Math.min(floor, A1_UNIT_COUNT - 1)),
        };
        void persistToDexie(userId, next);
        if (isAuthenticated && user) {
          void userDataService.saveA1PathState(userId, next).catch(() => {
            /* best-effort cloud mirror; Dexie already has it */
          });
        }
        broadcast();
        return next;
      });
    },
    [userId, isAuthenticated, user, highestReachedIndex, broadcast],
  );

  const value = useMemo<A1PathContextValue>(
    () => ({
      ...state,
      userId,
      completeNode,
      markCheckpointResult,
      isCheckpointComplete,
      isUnitUnlocked,
      isNodeUnlocked,
      isNodeComplete,
      getPushNode,
      getUnitPhase,
      setPathMode,
      resetPath,
    }),
    [
      state,
      userId,
      completeNode,
      markCheckpointResult,
      isCheckpointComplete,
      isUnitUnlocked,
      isNodeUnlocked,
      isNodeComplete,
      getPushNode,
      getUnitPhase,
      setPathMode,
      resetPath,
    ]
  );

  return <A1PathContext.Provider value={value}>{children}</A1PathContext.Provider>;
}

export function useA1Path() {
  const context = useContext(A1PathContext);
  if (!context) {
    throw new Error('useA1Path must be used within an A1PathProvider');
  }
  return context;
}