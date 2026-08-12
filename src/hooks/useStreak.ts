import { useEffect, useState } from 'react';
import { getItem, setItem } from '../utils/safeStorage';

const KEY = 'germanDailyStreak';

interface StreakData {
  streakCount: number;
  lastVisit?: string;
}

function loadStreak(): StreakData {
  try {
    const raw = getItem(KEY);
    if (!raw) return { streakCount: 0 };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { streakCount: 0 };
  }
}

function saveStreak(data: StreakData) {
  setItem(KEY, JSON.stringify(data));
}

export function useStreak() {
  const [streakCount, setStreakCount] = useState<number>(0);

  useEffect(() => {
    const today = new Date().toDateString();
    const previous = loadStreak();
    let nextStreak = 1;

    if (previous.lastVisit === today) {
      nextStreak = previous.streakCount || 0;
    } else {
      const lastDate = previous.lastVisit ? new Date(previous.lastVisit) : null;
      if (lastDate) {
        const diff = Math.round((new Date(today).getTime() - lastDate.getTime()) / 86400000);
        if (diff === 1) {
          nextStreak = (previous.streakCount || 0) + 1;
        }
      }
    }

    const next = { streakCount: nextStreak, lastVisit: today };
    saveStreak(next);
    setStreakCount(nextStreak);
  }, []);

  return { streakCount };
}
