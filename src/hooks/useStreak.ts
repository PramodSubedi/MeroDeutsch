import { useEffect, useState } from 'react';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

const BASE_KEY = 'germanDailyStreak';

interface StreakData {
  streakCount: number;
  lastVisit?: string;
}

function loadStreak(key: string): StreakData {
  try {
    const raw = getItem(key);
    if (!raw) return { streakCount: 0 };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { streakCount: 0 };
  }
}

function saveStreak(key: string, data: StreakData) {
  setItem(key, JSON.stringify(data));
}

/** Compute the streak for a visit today, given the previous streak state. */
function computeStreak(previous: StreakData): StreakData {
  const today = new Date().toDateString();
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

  return { streakCount: nextStreak, lastVisit: today };
}

export function useStreak() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;
  const key = scopedKey(BASE_KEY, userId);
  const [streakCount, setStreakCount] = useState<number>(0);

  // Reset in-memory state when the user changes (login/logout/switch).
  useEffect(() => {
    setStreakCount(loadStreak(key).streakCount);
  }, [key]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      let previous = loadStreak(key);
      let longestStreak = 0;

      // For authenticated users, use the cloud baseline (if any) as the starting point.
      if (isAuthenticated && user) {
        const { data, error } = await supabase
          .from('user_streaks')
          .select('current_streak, longest_streak, last_activity_date')
          .eq('user_id', user.userId)
          .maybeSingle();

        if (!error && data) {
          previous = {
            streakCount: data.current_streak ?? 0,
            lastVisit: data.last_activity_date ?? undefined,
          };
          longestStreak = data.longest_streak ?? 0;
        }
      }

      const next = computeStreak(previous);
      if (cancelled) return;

      saveStreak(key, next);
      setStreakCount(next.streakCount);

      // Push to Supabase for authenticated users.
      if (isAuthenticated && user) {
        void supabase.from('user_streaks').upsert({
          user_id: user.userId,
          current_streak: next.streakCount,
          longest_streak: Math.max(next.streakCount, longestStreak),
          last_activity_date: new Date().toDateString(),
          updated_at: new Date().toISOString(),
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, key]);

  return { streakCount };
}