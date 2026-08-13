import { useState, useEffect, useCallback } from 'react';
import type { DailyQuest, DailyQuestState } from '../types/quests';
import { getItem, setItem } from '../utils/safeStorage';

const QUEST_STORAGE_KEY = 'meroDeutschDailyQuests';

// Default quest templates
const QUEST_TEMPLATES: Omit<DailyQuest, 'completed'>[] = [
  {
    id: 'review-master',
    title: 'Review Master',
    titleDE: 'Review-Meister',
    description: 'Complete 10 SRS reviews',
    descriptionDE: 'Schließe 10 SRS-Wiederholungen ab',
    requirement: '10 reviews',
    requirementDE: '10 Wiederholungen',
    rewardXp: 50,
  },
  {
    id: 'story-teller',
    title: 'Story Teller',
    titleDE: 'Geschichtenerzähler',
    description: 'Finish reading 1 micro-story',
    descriptionDE: 'Schließe 1 Mikrogeschichte ab',
    requirement: '1 story',
    requirementDE: '1 Geschichte',
    rewardXp: 30,
  },
  {
    id: 'sharp-shooter',
    title: 'Sharp Shooter',
    titleDE: 'Scharfschütze',
    description: 'Score 100% on any practice quiz',
    descriptionDE: 'Erreiche 100% auf einem Übungsquiz',
    requirement: '100% quiz',
    requirementDE: '100% Quiz',
    rewardXp: 75,
  },
];

// Check if day has changed (for quest reset)
function hasDayChanged(lastReset: string): boolean {
  const lastDate = new Date(lastReset);
  const today = new Date();
  return (
    lastDate.getFullYear() !== today.getFullYear() ||
    lastDate.getMonth() !== today.getMonth() ||
    lastDate.getDate() !== today.getDate()
  );
}

// Generate daily quests
function generateDailyQuests(): DailyQuest[] {
  // Shuffle and take 3 quests
  const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(quest => ({
    ...quest,
    completed: false,
  }));
}

// Load quests from storage
function loadQuests(): DailyQuestState {
  const stored = getItem(QUEST_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DailyQuestState;
      if (hasDayChanged(parsed.lastReset)) {
        // Day changed, generate new quests
        const newQuests = generateDailyQuests();
        const newState: DailyQuestState = { quests: newQuests, lastReset: new Date().toISOString() };
        setItem(QUEST_STORAGE_KEY, JSON.stringify(newState));
        return newState;
      }
      return parsed;
    } catch {
      // Invalid stored data, generate new
      const newQuests = generateDailyQuests();
      const newState: DailyQuestState = { quests: newQuests, lastReset: new Date().toISOString() };
      setItem(QUEST_STORAGE_KEY, JSON.stringify(newState));
      return newState;
    }
  }
  
  // No stored data, generate new
  const newQuests = generateDailyQuests();
  const newState: DailyQuestState = { quests: newQuests, lastReset: new Date().toISOString() };
  setItem(QUEST_STORAGE_KEY, JSON.stringify(newState));
  return newState;
}

export function useDailyQuests() {
  const [state, setState] = useState<DailyQuestState | null>(null);

  useEffect(() => {
    setState(loadQuests());
  }, []);

  // Mark quest as completed
  const completeQuest = useCallback((questId: string) => {
    if (!state) return;
    
    const updatedQuests = state.quests.map((quest: DailyQuest) =>
      quest.id === questId ? { ...quest, completed: true } : quest
    );
    
    const newState: DailyQuestState = { ...state, quests: updatedQuests };
    setState(newState);
    setItem(QUEST_STORAGE_KEY, JSON.stringify(newState));
  }, [state]);

  // Get total XP from completed quests
  const totalRewardXp = state?.quests
    .filter((q: DailyQuest) => q.completed)
    .reduce((sum: number, q: DailyQuest) => sum + q.rewardXp, 0) || 0;

  return {
    quests: state?.quests ?? [],
    completeQuest,
    totalRewardXp,
    isLoading: state === null,
  };
}