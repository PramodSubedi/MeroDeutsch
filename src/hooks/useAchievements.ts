import { useCallback, useState } from 'react';
import { getItem, setItem } from '../utils/safeStorage';

const DEBOUNCE_MS = 300;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
import type { Badge, Progress, UserAchievements } from '../types';

const KEY = 'meroDeutschAchievements';

export const ALL_BADGES: Badge[] = [
  {
    id: 'first_steps',
    label: 'First Steps',
    description: 'Practice your first German letter',
    icon: '👣',
    requirement: '1 letter practiced',
  },
  {
    id: 'alphabet_10',
    label: 'Alphabet Explorer',
    description: 'Practice 10 German letters',
    icon: '🔤',
    requirement: '10 letters practiced',
  },
  {
    id: 'alphabet_26',
    label: 'Alphabet Master',
    description: 'Practice all 26 standard German letters',
    icon: '🏆',
    requirement: '26 letters practiced',
  },
  {
    id: 'quiz_10',
    label: 'Quiz Rookie',
    description: 'Complete 10 quiz questions',
    icon: '📝',
    requirement: '10 quiz attempts',
  },
  {
    id: 'quiz_accuracy_80',
    label: 'Sharp Shooter',
    description: 'Reach 80%+ quiz accuracy (min 5 attempts)',
    icon: '🎯',
    requirement: '80%+ accuracy, 5+ attempts',
  },
  {
    id: 'spelling_10',
    label: 'Spelling Bee',
    description: 'Complete 10 spelling words',
    icon: '🐝',
    requirement: '10 spelling words',
  },
  {
    id: 'century_club',
    label: 'Century Club',
    description: 'Reach 100 total learning actions',
    icon: '💯',
    requirement: '100 combined actions',
  },
  {
    id: 'daily_challenger',
    label: 'Daily Challenger',
    description: 'Complete the daily challenge',
    icon: '🗓️',
    requirement: 'Complete the daily challenge all correct',
  },
];

function loadAchievements(): UserAchievements {
  try {
    const raw = getItem(KEY);
    if (!raw) return { badges: [] };
    return JSON.parse(raw) as UserAchievements;
  } catch {
    return { badges: [] };
  }
}

function saveAchievements(data: UserAchievements) {
  setItem(KEY, JSON.stringify(data));
}

/** Evaluate badge rules against current progress. Returns newly-unlocked badge ids. */
function evaluateRules(progress: Progress): string[] {
  const unlocked: string[] = [];
  const practicedCount = progress.practiced?.length ?? 0;
  const quizTotal = progress.quizTotal ?? 0;
  const quizCorrect = progress.quizCorrect ?? 0;
  const spellCompleted = progress.spellCompleted ?? 0;
  const quizAccuracy = quizTotal > 0 ? quizCorrect / quizTotal : 0;
  const totalActions = practicedCount + quizTotal + spellCompleted;

  if (practicedCount >= 1) unlocked.push('first_steps');
  if (practicedCount >= 10) unlocked.push('alphabet_10');
  if (practicedCount >= 26) unlocked.push('alphabet_26');
  if (quizTotal >= 10) unlocked.push('quiz_10');
  if (quizTotal >= 5 && quizAccuracy >= 0.8) unlocked.push('quiz_accuracy_80');
  if (spellCompleted >= 10) unlocked.push('spelling_10');
  if (totalActions >= 100) unlocked.push('century_club');

  return unlocked;
}

export function useAchievements() {
  const [achievements, setAchievements] = useState<UserAchievements>(loadAchievements);

  const unlockBadge = useCallback((badgeId: string) => {
    setAchievements((prev) => {
      if (prev.badges.some((b) => b.id === badgeId)) return prev;
      const next: UserAchievements = {
        badges: [...prev.badges, { id: badgeId, unlockedAt: new Date().toISOString() }],
      };
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        saveAchievements(next);
      }, DEBOUNCE_MS);
      return next;
    });
  }, []);

  /** Check all rules against progress and unlock any newly-earned badges. */
  const checkAndUnlock = useCallback(
    (progress: Progress) => {
      const earned = evaluateRules(progress);
      earned.forEach((id) => unlockBadge(id));
    },
    [unlockBadge]
  );

  const unlockedMap = new Map(achievements.badges.map((b) => [b.id, b.unlockedAt]));

  const unlockedBadges: Badge[] = ALL_BADGES.filter((b) => unlockedMap.has(b.id)).map((b) => ({
    ...b,
    unlockedAt: unlockedMap.get(b.id),
  }));

  const lockedBadges: Badge[] = ALL_BADGES.filter((b) => !unlockedMap.has(b.id));

  return {
    achievements,
    unlockedBadges,
    lockedBadges,
    unlockBadge,
    checkAndUnlock,
  };
}