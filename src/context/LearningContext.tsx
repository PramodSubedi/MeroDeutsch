/**
 * src/context/LearningContext.tsx — ONE aggregated read of the learner's state.
 *
 * WHY A PROVIDER AND NOT A PROP DRILL
 * ----------------------------------
 * The companion needs XP, streak, review queue, skill accuracy, weak items,
 * path position, CEFR, identity and the current route — at once, and
 * re-rendering whenever any of them changes. Threading that through props
 * would mean every one of those hooks is called in the chat UI too.
 *
 * WHY THE SPLIT BETWEEN `snapshot` AND `actions`
 * ----------------------------------------------
 * `snapshot` is plain serializable data (see `types/chatbot.ts`) and is what
 * the prompt builder and the intent handlers read. `actions` are the only
 * functions. Keeping them apart means the prompt layer can never accidentally
 * depend on a React value, and a stale action can never inject stale data.
 *
 * MOUNTED IN `Layout`, NOT `main.tsx`
 * ----------------------------------
 * `main.tsx` sits ABOVE `BrowserRouter`, so a provider there could not call
 * `useLocation`/`useNavigate`. `Layout` is the first component that is inside
 * the Router AND inside `A1PathProvider`/`XpProvider` — exactly the conditions
 * this provider needs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';
import { useXp } from '../hooks/useXp';
import { useStreak } from '../hooks/useStreak';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useSkillAccuracy, useWeakestSkill, useWeakItems } from '../hooks/useSkillAccuracy';
import { useA1Path } from '../hooks/useA1Path';
import { useCefrLevel } from '../hooks/useCefrLevel';

import { A1_CURRICULUM, A1_LEARN_NODES, CHECKPOINT_PASS_THRESHOLD } from '../data/a1Path';
import { contextLabelFor } from '../config/routeLabels';
import { ANCHORS } from '../lib/anchors';
import { hydrateChat, persistChat, useChatStore } from '../lib/chatStore';
import type { ContextSnapshot, ReviewSnippet } from '../types/chatbot';

export interface LearningContextValue {
  snapshot: ContextSnapshot;
  /** Navigate the app from inside the companion. */
  navigateTo: (path: string) => void;
  /**
   * Open the existing Dashboard review session.
   *
   * Uses the real anchor rather than inventing a `/review` route
   * (`.clinerules` C19).
   */
  startReviewSession: () => void;
  /** The real identity the transcript is scoped to. */
  userId: string;
}

const LearningContext = createContext<LearningContextValue | undefined>(undefined);

export function LearningContextProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { langMode } = useLang();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const xp = useXp();
  const { streakCount, longestStreak } = useStreak();
  const { queue, dueQueue } = useReviewQueue();
  const { skills } = useSkillAccuracy();
  const weakestSkill = useWeakestSkill();
  const weakItems = useWeakItems();
  const { level: cefrLevel } = useCefrLevel();
  const { completedNodeIds, unlockedUnitIndex, checkpointBestByUnit, getPushNode } = useA1Path();

  // Real identity, or the same 'guest' id the rest of the app uses.
  const userId = user?.userId ?? 'guest';

  /* ── chat transcript persistence, scoped to the real user ──────────────── */
  useEffect(() => {
    hydrateChat(userId);
    // Persist on ANY transcript/settings change, debounced — subscribing to
    // the store is what makes this correct. An effect keyed on `messages`
    // would either miss the store entirely or fire once per streamed token.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useChatStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => persistChat(userId), 400);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      persistChat(userId);
    };
  }, [userId]);

  const isDE = langMode === 'german';

  const snapshot = useMemo<ContextSnapshot>(() => {
    const unitIndex = Math.max(0, Math.min(unlockedUnitIndex, A1_CURRICULUM.units.length - 1));
    const unit = A1_CURRICULUM.units[unitIndex];

    // Only count ids that are still real nodes — migration markers live in the
    // same array and must not inflate "completed".
    const validIds = new Set(A1_LEARN_NODES.map((n) => n.id));
    const completedCount = completedNodeIds.filter((id) => validIds.has(id)).length;

    const passedCheckpoints = Object.values(checkpointBestByUnit).filter(
      (score) => typeof score === 'number' && score >= CHECKPOINT_PASS_THRESHOLD,
    ).length;

    const pushNode = getPushNode();

    // Worst-first: "why was I wrong" is about the thing they most often get
    // wrong, not the thing they most recently touched.
    const recent: ReviewSnippet[] = [...queue]
      .sort((a, b) => (b.errorCount ?? 0) - (a.errorCount ?? 0))
      .slice(0, 6)
      .map((item) => ({
        itemKey: item.itemKey,
        moduleType: item.moduleType,
        userAnswer: item.userAnswer ?? '',
        correctAnswer: item.correctAnswer ?? '',
        errorCount: item.errorCount ?? 0,
        errorTag: item.errorTag ?? null,
      }));

    return {
      userName: user?.username ?? null,
      isAuthenticated: Boolean(user),
      isDE,
      currentPathname: pathname,
      currentModuleLabel: contextLabelFor(pathname, isDE),
      xp: {
        totalXp: xp.totalXp,
        level: xp.level,
        rank: xp.rank,
        xpToNextLevel: xp.xpToNextLevel,
        xpProgress: xp.xpProgress,
      },
      streak: { current: streakCount, longest: longestStreak },
      review: { total: queue.length, due: dueQueue.length, recent },
      skills: skills.map((s) => ({
        category: s.category,
        accuracy: s.accuracy,
        correct: s.correct,
        total: s.total,
      })),
      weakestSkill: weakestSkill
        ? {
            category: weakestSkill.category,
            accuracy: weakestSkill.accuracy,
            total: weakestSkill.total,
            route: weakestSkill.route,
          }
        : null,
      weakItems: weakItems.map((w) => ({
        itemKey: w.itemKey,
        moduleType: w.moduleType,
        errorCount: w.errorCount,
        correctAnswer: w.correctAnswer,
        // Not on `WeakItem`; recovered from the queue by itemKey, and used
        // only as a distractor in in-chat drills.
        userAnswer:
          queue.find((q) => q.itemKey === w.itemKey)?.userAnswer ?? '',
      })),
      a1: {
        unitIndex,
        unitTitle: unit?.title.en ?? '',
        unitTitleDE: unit?.title.de ?? '',
        unlockedUnitIndex,
        completedCount,
        totalLearnNodes: A1_LEARN_NODES.length,
        checkpointBest: checkpointBestByUnit,
        passedCheckpoints,
        pushNode: pushNode
          ? { label: pushNode.label.en, labelDE: pushNode.label.de, to: pushNode.to }
          : null,
      },
      cefr: cefrLevel || 'A1',
    };
  }, [
    user,
    isDE,
    pathname,
    xp.totalXp,
    xp.level,
    xp.rank,
    xp.xpToNextLevel,
    xp.xpProgress,
    streakCount,
    longestStreak,
    queue,
    dueQueue,
    skills,
    weakestSkill,
    weakItems,
    completedNodeIds,
    unlockedUnitIndex,
    checkpointBestByUnit,
    getPushNode,
    cefrLevel,
  ]);

  const navigateTo = useCallback((path: string) => navigate(path), [navigate]);

  const startReviewSession = useCallback(
    () => navigate(`/dashboard#${ANCHORS.reviewQueue}`),
    [navigate],
  );

  const value = useMemo<LearningContextValue>(
    () => ({ snapshot, navigateTo, startReviewSession, userId }),
    [snapshot, navigateTo, startReviewSession, userId],
  );

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearningContext(): LearningContextValue {
  const context = useContext(LearningContext);
  if (!context) {
    throw new Error('useLearningContext must be used within LearningContextProvider');
  }
  return context;
}
