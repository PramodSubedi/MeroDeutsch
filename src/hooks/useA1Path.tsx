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
  CHECKPOINT_PASS_THRESHOLD,
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
}

const DEFAULT_STATE: A1PathState = {
  completedNodeIds: [],
  unlockedUnitIndex: 0,
  checkpointBestByUnit: {},
};

/** True when a state object carries any real progress worth hydrating/migrating. */
function hasProgress(s: Partial<A1PathState>): boolean {
  return (
    (Array.isArray(s.completedNodeIds) && s.completedNodeIds.length > 0) ||
    (typeof s.unlockedUnitIndex === 'number' && s.unlockedUnitIndex > 0) ||
    Boolean(
      s.checkpointBestByUnit && Object.keys(s.checkpointBestByUnit).length > 0
    )
  );
}

/** Clamp/normalize any partial state into a valid A1PathState. */
function normalizeState(raw: Partial<A1PathState>): A1PathState {
  const unlockedRaw =
    typeof raw.unlockedUnitIndex === 'number' ? raw.unlockedUnitIndex : 0;
  return {
    completedNodeIds: Array.isArray(raw.completedNodeIds)
      ? raw.completedNodeIds.filter((id): id is string => typeof id === 'string')
      : [],
    unlockedUnitIndex: Math.max(0, Math.min(unlockedRaw, A1_UNIT_COUNT - 1)),
    checkpointBestByUnit:
      raw.checkpointBestByUnit &&
      typeof raw.checkpointBestByUnit === 'object'
        ? raw.checkpointBestByUnit
        : {},
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
    updatedAt: new Date().toISOString(),
  };
  try {
    await db.a1PathState.put(row);
  } catch (err) {
    console.warn('[a1Path] Dexie persist failed:', err);
  }
}

export interface A1PathContextValue extends A1PathState {
  userId: string;
  /** learn/practice node id marked complete on visit. */
  completeNode: (id: string) => void;
  /**
   * Record a checkpoint attempt result for a unit. Advances unlock forward only
   * when score >= threshold; always persists the best score seen so Retry has
   * history.
   */
  markCheckpointResult: (unitIndex: number, score: number) => void;
  /** Is this unit's checkpoint passed? */
  isCheckpointComplete: (unitIndex: number) => boolean;
  /** Is this unit unlocked for the user? (unitIndex <= unlockedUnitIndex) */
  isUnitUnlocked: (unitIndex: number) => boolean;
  isNodeUnlocked: (node: PathNode) => boolean;
  isNodeComplete: (node: PathNode) => boolean;
  /** First incomplete node within unlocked units (the "Push" target), or null. */
  getPushNode: () => PathNode | null;
  /** Unit display phase for the spine. */
  getUnitPhase: (unitIndex: number) => 'locked' | 'current' | 'done';
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
    (unitIndex: number, score: number) => {
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

        // unlock NEVER decreases; only advance forward.
        const unlockedUnitIndex = Math.min(
          passed ? Math.max(prev.unlockedUnitIndex, safeUnit + 1) : prev.unlockedUnitIndex,
          A1_UNIT_COUNT - 1
        );

        const next: A1PathState = {
          completedNodeIds,
          unlockedUnitIndex,
          checkpointBestByUnit: { ...prev.checkpointBestByUnit, [safeUnit]: best },
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
      // Passing unit `safe`'s checkpoint advanced unlockedUnitIndex to >= safe+1.
      return state.unlockedUnitIndex > safe;
    },
    [state.unlockedUnitIndex]
  );

  const isUnitUnlocked = useCallback(
    (unitIndex: number) => {
      const safe = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
      return safe <= state.unlockedUnitIndex;
    },
    [state.unlockedUnitIndex]
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
    for (const node of A1_LEARN_NODES) {
      if (node.unitIndex > state.unlockedUnitIndex) continue; // locked unit
      if (node.kind === 'checkpoint') {
        if (!isCheckpointComplete(node.unitIndex)) return node;
      } else if (node.kind === 'learn' || node.kind === 'practice') {
        if (!state.completedNodeIds.includes(node.id)) return node;
      }
    }
    return null;
  }, [state.unlockedUnitIndex, state.completedNodeIds, isCheckpointComplete]);

  const getUnitPhase = useCallback(
    (unitIndex: number): 'locked' | 'current' | 'done' => {
      const safe = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
      if (safe < state.unlockedUnitIndex) return 'done';
      if (safe === state.unlockedUnitIndex) return 'current';
      return 'locked';
    },
    [state.unlockedUnitIndex]
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