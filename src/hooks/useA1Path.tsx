/** Per-account A1 progress with local persistence and cloud reconciliation. */

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
import { A1_PATH_CHANGED_EVENT, hasPendingA1Reset, queueA1PathReset } from '../services/syncService';
import { mergeA1Progress } from '../services/a1Progress';
import { BOOT_GATE_TIMEOUT_MS, withTimeout } from '../data/curriculum/bootGate';
import { getItem, removeItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { DEFAULT_STATE, hasPassedCheckpoint, hasProgress, normalizeAttempt, normalizeState, type A1PathState } from './a1PathUtils';
import {
  A1_CURRICULUM,
  A1_LEARN_NODES,
  A1_UNIT_COUNT,
  BAND_MIGRATION_MARKER,
  CHECKPOINT_PASS_THRESHOLD,
  M15_MIGRATION_MARKER,
  V4_ORDER_MARKER,
  getNextGatedBandIndex,
  type PathMode,
  type PathNode,
} from '../data/a1Path';

/** Legacy localStorage base key — read-only, migrated into Dexie once. */
const LEGACY_STORAGE_BASE = 'meroDeutschA1Path';

export { hasProgress, normalizeAttempt, normalizeState, MAX_TRACKED_MISSES } from './a1PathUtils';
export type { A1PathState, CheckpointAttemptRecord } from './a1PathUtils';

/** Write-through to Dexie (the offline-first primary store). Never throws. */
async function persistToDexie(userId: string, state: A1PathState): Promise<boolean> {
  if (!db) return false;
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
    return true;
  } catch (err) {
    console.warn('[a1Path] Dexie persist failed:', err);
    return false;
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
  return (
    <A1PathSession key={userId} userId={userId} isAuthenticated={isAuthenticated}>
      {children}
    </A1PathSession>
  );
}

function A1PathSession({ children, userId, isAuthenticated }: A1PathProviderProps & {
  userId: string;
  isAuthenticated: boolean;
}) {
  const legacyKey = useMemo(() => scopedKey(LEGACY_STORAGE_BASE, userId), [userId]);

  const [state, setState] = useState<A1PathState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Track the latest committed mutation between renders and async callbacks.
  const stateRef = useRef(state);
  const replaceState = useCallback((next: A1PathState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Restore local and legacy progress before reconciling the cloud snapshot.
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

      // Legacy localStorage one-time migration (pre-Dexie installs).
      if (!hasProgress(next)) {
        const raw = getItem(legacyKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<A1PathState>;
            if (hasProgress(parsed)) {
              next = normalizeState(parsed);
              if (!cancelled && await persistToDexie(userId, next)) removeItem(legacyKey);
            } else {
              removeItem(legacyKey); // empty legacy shell — clean up
            }
          } catch {
            removeItem(legacyKey); // malformed — clean up
          }
        }
      }

      if (isAuthenticated && !hasPendingA1Reset(userId) && navigator.onLine) {
        try {
          const cloud = await withTimeout(
            userDataService.getA1PathState(userId),
            BOOT_GATE_TIMEOUT_MS,
            'reading cloud progress',
          );
          if (cloud && !cancelled) {
            const normalized = normalizeState(cloud);
            next = hasProgress(next) || next.pathMode === 'self'
              ? mergeA1Progress(next, normalized)
              : normalized;
            await persistToDexie(userId, next);
          }
        } catch (err) {
          console.warn('[a1Path] cloud hydration failed:', err);
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
      if (!cancelled && (
        next.completedNodeIds.includes(BAND_MIGRATION_MARKER) ||
        next.completedNodeIds.includes(M15_MIGRATION_MARKER) ||
        next.completedNodeIds.includes(V4_ORDER_MARKER)
      )) {
        void persistToDexie(userId, next);
      }

      if (!cancelled) {
        replaceState(next);
        setHydrated(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, isAuthenticated, legacyKey, replaceState]);

  /* ────────────────────────────────────────────────────────────
   * Cross-tab freshness: after any write, notify other tabs; they
   * re-read the Dexie row (single-writer-per-tab, Dexie is shared).
   * ──────────────────────────────────────────────────────────── */
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    let cancelled = false;
    const channel = new BroadcastChannel('meroDeutschA1Path');
    channel.onmessage = (event: MessageEvent<{ userId?: string }>) => {
      if (event.data?.userId !== userId || !db) return;
      void db.a1PathState
        .get(userId)
        .then((row) => {
          if (!cancelled && row) replaceState(normalizeState(row));
        })
        .catch(() => {
          /* ignore */
        });
    };
    channelRef.current = channel;
    return () => {
      cancelled = true;
      channel.close();
      channelRef.current = null;
    };
  }, [userId, replaceState]);

  const broadcast = useCallback(() => {
    channelRef.current?.postMessage({ userId });
    if (isAuthenticated) window.dispatchEvent(new Event(A1_PATH_CHANGED_EVENT));
  }, [userId, isAuthenticated]);

  const commitState = useCallback((next: A1PathState) => {
    replaceState(next);
    void persistToDexie(userId, next).then((saved) => {
      if (saved) broadcast();
    });
  }, [userId, replaceState, broadcast]);

  /* ────────────────────────────────────────────────────────────
   * Mutations — setState + immediate Dexie write (offline-first).
   * ──────────────────────────────────────────────────────────── */

  const completeNode = useCallback(
    (id: string) => {
      if (!hydrated) return;
      const prev = stateRef.current;
      if (prev.completedNodeIds.includes(id)) return;
      commitState({
        ...prev,
        completedNodeIds: [...prev.completedNodeIds, id],
      });
    },
    [commitState, hydrated]
  );

  const markCheckpointResult = useCallback(
    (unitIndex: number, score: number, missedItemKeys: string[] = []) => {
      if (!hydrated) return;
      const safeUnit = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
      const prev = stateRef.current;
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
      commitState(next);
    },
    [commitState, hydrated]
  );

  const resetPath = useCallback(() => {
    if (!hydrated) return;
    replaceState(DEFAULT_STATE);
    void persistToDexie(userId, DEFAULT_STATE).then((saved) => {
      if (isAuthenticated && saved) queueA1PathReset(userId);
      if (saved) broadcast();
    });
  }, [userId, isAuthenticated, hydrated, replaceState, broadcast]);

  const isCheckpointComplete = useCallback(
    (unitIndex: number) => hasPassedCheckpoint({
      checkpointBestByUnit: state.checkpointBestByUnit,
      completedNodeIds: state.completedNodeIds,
    }, unitIndex),
    [state.checkpointBestByUnit, state.completedNodeIds]
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
        if (isCheckpointComplete(safe)) return 'done';
        const touched = A1_LEARN_NODES.some(
          (n) => n.unitIndex === safe && state.completedNodeIds.includes(n.id),
        );
        return touched ? 'current' : 'available';
      }

      if (safe > state.unlockedUnitIndex) return 'locked';
      return isCheckpointComplete(safe) ? 'done' : 'current';
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
      if (!hydrated) return;
      const prev = stateRef.current;
      if (prev.pathMode === mode) return;
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
      commitState(next);
    },
    [hydrated, highestReachedIndex, commitState],
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
