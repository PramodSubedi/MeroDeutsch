/**
 * src/hooks/useA1Path.tsx
 *
 * A1 learning-path state — single source of truth for the linear campaign.
 *
 * Persisted per-user under the NEW, isolated storage key:
 *   `meroDeutschA1Path:<userId>`   (guest -> `meroDeutschA1Path:guest`)
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
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import {
  A1_CURRICULUM,
  A1_LEARN_NODES,
  A1_UNIT_COUNT,
  CHECKPOINT_PASS_THRESHOLD,
  type PathNode,
} from '../data/a1Path';

const STORAGE_BASE = 'meroDeutschA1Path';
const DEBOUNCE_MS = 400;

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

function loadState(key: string): A1PathState {
  try {
    const raw = getItem(key);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<A1PathState>;
    const unlocked = Math.max(
      0,
      Math.min(
        typeof parsed.unlockedUnitIndex === 'number' ? parsed.unlockedUnitIndex : 0,
        A1_UNIT_COUNT - 1
      )
    );
    const completed = Array.isArray(parsed.completedNodeIds) ? parsed.completedNodeIds : [];
    const best = parsed.checkpointBestByUnit ?? {};
    return {
      completedNodeIds: completed,
      unlockedUnitIndex: unlocked,
      checkpointBestByUnit: best,
    };
  } catch {
    return DEFAULT_STATE;
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
  const { user } = useAuth();
  const userId = user?.userId ?? 'guest';
  const key = useMemo(() => scopedKey(STORAGE_BASE, userId), [userId]);

  const [state, setState] = useState<A1PathState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load per-user state when the user/identity changes.
  useEffect(() => {
    setState(loadState(key));
    setHydrated(true);
  }, [key]);

  // Cross-tab sync: if another tab writes, reload this user's state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as A1PathState);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key]);

  const clearPendingSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  };

  // Debounced persist to localStorage.
  const persist = useCallback(
    (next: A1PathState) => {
      clearPendingSave();
      saveTimeoutRef.current = setTimeout(() => {
        try {
          setItem(key, JSON.stringify(next));
        } catch (err) {
          console.warn('[a1Path] persist failed:', err);
        }
      }, DEBOUNCE_MS);
    },
    [key]
  );

  // Clear pending debounced save on unmount.
  useEffect(() => {
    return () => clearPendingSave();
  }, []);

  const completeNode = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.completedNodeIds.includes(id)) return prev;
        const next: A1PathState = { ...prev, completedNodeIds: [...prev.completedNodeIds, id] };
        persist(next);
        return next;
      });
    },
    [persist]
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
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetPath = useCallback(() => {
    setState(DEFAULT_STATE);
    persist(DEFAULT_STATE);
  }, [persist]);

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

  // Persist any state change (debounced). hydrated guards against writing the
  // pre-load default on first render.
  useEffect(() => {
    if (!hydrated) return;
    persist(state);
  }, [state, hydrated, persist]);

  return <A1PathContext.Provider value={value}>{children}</A1PathContext.Provider>;
}

export function useA1Path() {
  const context = useContext(A1PathContext);
  if (!context) {
    throw new Error('useA1Path must be used within an A1PathProvider');
  }
  return context;
}