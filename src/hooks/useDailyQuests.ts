import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DailyQuest, DailyQuestState } from '../types/quests';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { useAuth } from './useAuth';
import { useXp } from './useXp';

const QUEST_STORAGE_KEY = 'meroDeutschDailyQuests';

/** Quest archetypes — randomized 3-per-day, resetting at local midnight. */
const QUEST_TEMPLATES: Omit<DailyQuest, 'completed' | 'progress' | 'maxProgress' | 'claimed'>[] = [
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    titleDE: 'Schnellfeuer-Ass',
    description: 'Play 1 Rapid-Fire Blitz round',
    descriptionDE: 'Spiele 1 Schnellfeuer-Blitz-Runde',
    requirement: '1 blitz round',
    requirementDE: '1 Runde Blitz',
    rewardXp: 50,
  },
  {
    id: 'srs-scholar',
    title: 'SRS Scholar',
    titleDE: 'SRS-Gelehrter',
    description: 'Review 5 due items in the SRS queue',
    descriptionDE: 'Wiederhole 5 fällige Einträge in der SRS-Warteschlange',
    requirement: '5 reviews',
    requirementDE: '5 Wiederholungen',
    rewardXp: 40,
  },
  {
    id: 'accuracy-master',
    title: 'Accuracy Master',
    titleDE: 'Präzisions-Meister',
    description: 'Score ≥ 80% accuracy in any exercise',
    descriptionDE: 'Erreiche ≥ 80% Genauigkeit in einer Übung',
    requirement: '≥ 80% accuracy',
    requirementDE: '≥ 80% Genauigkeit',
    rewardXp: 30,
  },
];

/** Completion target per quest id. */
function questMax(id: string): number {
  switch (id) {
    case 'speed-demon':
      return 1;
    case 'srs-scholar':
      return 5;
    default:
      return 1;
  }
}

/** Build a fresh daily quest set with progress counters reset. */
function buildQuests(): DailyQuest[] {
  return QUEST_TEMPLATES.map((q) => ({
    ...q,
    completed: false,
    progress: 0,
    maxProgress: questMax(q.id),
    claimed: false,
  }));
}

/** True when the stored reset date is not today (needs a new set). */
function hasDayChanged(lastReset: string): boolean {
  const last = new Date(lastReset);
  const today = new Date();
  return (
    last.getFullYear() !== today.getFullYear() ||
    last.getMonth() !== today.getMonth() ||
    last.getDate() !== today.getDate()
  );
}

function loadQuests(key: string): DailyQuestState {
  const stored = getItem(key);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DailyQuestState;
      if (hasDayChanged(parsed.lastReset)) {
        return { quests: buildQuests(), lastReset: new Date().toISOString() };
      }
      return parsed;
    } catch {
      return { quests: buildQuests(), lastReset: new Date().toISOString() };
    }
  }
  return { quests: buildQuests(), lastReset: new Date().toISOString() };
}

/**
 * useDailyQuests — auto-resetting gamified daily objectives.
 *
 * Three randomized archetypes ("Speed Demon", "SRS Scholar", "Accuracy
 * Master") that refresh at local midnight. Progress is persisted per-user
 * via `safeStorage` + `scopedKey`. Completed quests award bonus XP through
 * the shared `useXp` context (`awardXp`).
 */
export function useDailyQuests() {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const key = scopedKey(QUEST_STORAGE_KEY, userId);
  const { awardXp } = useXp();
  const claimingRef = useRef(new Set<string>());

  const [state, setState] = useState<DailyQuestState>(() => loadQuests(key));

  // Reload (and auto-reset at midnight) whenever the user scoped key changes.
  useEffect(() => {
    setState(loadQuests(key));
    claimingRef.current.clear();
  }, [key]);

  // Persist on any state change.
  useEffect(() => {
    setItem(key, JSON.stringify(state));
  }, [key, state]);

  /**
   * Update a quest's progress without affecting others' claimed state.
   * Marks the quest completed when `progress >= maxProgress`.
   */
  const updateProgress = useCallback((questId: string, delta = 1) => {
    setState((prev) => {
      const quest = prev.quests.find((q) => q.id === questId);
      if (!quest || quest.completed) return prev;
      const next = {
        ...quest,
        progress: Math.min((quest.progress ?? 0) + delta, quest.maxProgress ?? questMax(questId)),
      };
      const completed = next.maxProgress ? next.progress >= next.maxProgress : false;
      return {
        quests: prev.quests.map((q) => (q.id === questId ? { ...next, completed } : q)),
        lastReset: prev.lastReset,
      };
    });
  }, []);

  /** Speed Demon: +1 per blitz round finished. */
  const reportBlitzPlayed = useCallback(() => {
    updateProgress('speed-demon');
  }, [updateProgress]);

  /** SRS Scholar: add `count` completed review actions. */
  const reportReview = useCallback(
    (count = 1) => {
      updateProgress('srs-scholar', count);
    },
    [updateProgress]
  );

  /** Accuracy Master: instant-complete when an exercise hits ≥ 80%. */
  const reportAccuracy = useCallback((accuracy: number) => {
    if (accuracy >= 80) {
      setState((prev) => {
        const quest = prev.quests.find((q) => q.id === 'accuracy-master');
        if (!quest || quest.completed) return prev;
        return {
          quests: prev.quests.map((q) =>
            q.id === 'accuracy-master'
              ? { ...q, progress: q.maxProgress ?? 1, completed: true }
              : q
          ),
          lastReset: prev.lastReset,
        };
      });
    }
  }, []);

  /** Claim the bonus XP for a completed quest (one-time per quest per day). */
  const claimReward = useCallback(
    (questId: string) => {
      const quest = state.quests.find((candidate) => candidate.id === questId);
      if (!quest || !quest.completed || quest.claimed || claimingRef.current.has(questId)) return;

      // Claiming is guarded synchronously so a double click cannot award twice
      // before React commits the state update.
      claimingRef.current.add(questId);
      setState((prev) => ({
        quests: prev.quests.map((candidate) =>
          candidate.id === questId ? { ...candidate, claimed: true } : candidate
        ),
        lastReset: prev.lastReset,
      }));
      void awardXp(quest.rewardXp, `quest:${questId}`);
    },
    [awardXp, state]
  );

  const totalRewardXp = useMemo(
    () => state.quests.filter((q) => q.claimed).reduce((sum, q) => sum + q.rewardXp, 0),
    [state]
  );

  const completedCount = state.quests.filter((q) => q.completed).length;

  return {
    quests: state.quests,
    totalRewardXp,
    completedCount,
    reportBlitzPlayed,
    reportReview,
    reportAccuracy,
    claimReward,
    isLoading: false,
  };
}