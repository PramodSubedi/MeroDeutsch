import { useCallback, useEffect, useState } from 'react';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { useAuth } from './useAuth';
import { userDataService } from '../services/userDataService';

const BASE_KEY = 'meroDeutschActivity';
const MAX_LOCAL_DAYS = 120;
const REMOTE_FETCH_DAYS = 90;

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Days-ago cutoff string for localStorage filtering. */
function cutoffStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function loadLocal(key: string): ActivityDay[] {
  try {
    const raw = getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityDay[];
    const cutoff = cutoffStr(MAX_LOCAL_DAYS);
    return parsed.filter((d) => d.date >= cutoff);
  } catch {
    return [];
  }
}

function saveLocal(key: string, activities: ActivityDay[]) {
  setItem(key, JSON.stringify(activities));
}

/**
 * Activity log hook — tracks real daily engagement (quiz answers, spelling,
 * dictation, review resolves) for both guests (local only) and authenticated
 * users (local cache + Supabase upsert).
 *
 * Merge rule on login: for each date, take the **max** count between local
 * and remote. This prevents double-counting when an action was recorded in
 * both stores but ensures the cloud value wins if a session on another device
 * produced a higher count.
 */
export function useActivityLog() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;
  const key = scopedKey(BASE_KEY, userId);
  const [activities, setActivities] = useState<ActivityDay[]>(() => loadLocal(key));

  // Reset in-memory state when the user changes (login/logout/switch).
  useEffect(() => {
    setActivities(loadLocal(key));
  }, [key]);

  // On login: fetch last 90 days from Supabase, merge with local (max), re-cache.
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let cancelled = false;
    const mergeRemote = async () => {
      try {
        const remote = await userDataService.getActivityDays(user.userId, REMOTE_FETCH_DAYS);

        if (cancelled) return;

        const local = loadLocal(key);
        // Merge rule: max count per day
        const mergedMap = new Map<string, number>();
        [...local, ...remote].forEach((d) => {
          const existing = mergedMap.get(d.date) ?? 0;
          mergedMap.set(d.date, Math.max(existing, d.count));
        });
        const merged: ActivityDay[] = Array.from(mergedMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        saveLocal(key, merged);
        setActivities(merged);
      } catch (error) {
        console.warn('Failed to fetch activity days from Supabase:', error);
      }
    };

    void mergeRemote();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, key]);

  /**
   * Record one or more engagement events for today.
   * - Guests: local storage only.
   * - Authenticated: upsert today's row in Supabase `user_activity_days`.
   */
  const recordActivity = useCallback(
    async (delta: number = 1) => {
      if (delta <= 0) return;
      const today = todayStr();

      // Local update
      setActivities((prev) => {
        const cutoff = cutoffStr(MAX_LOCAL_DAYS);
        let filtered = prev.filter((d) => d.date >= cutoff);

        const existing = filtered.find((d) => d.date === today);
        if (existing) {
          filtered = filtered.map((d) =>
            d.date === today ? { ...d, count: d.count + delta } : d,
          );
        } else {
          filtered = [...filtered, { date: today, count: delta }];
        }

        // Keep at most MAX_LOCAL_DAYS entries
        if (filtered.length > MAX_LOCAL_DAYS) {
          filtered = filtered.slice(filtered.length - MAX_LOCAL_DAYS);
        }

        saveLocal(key, filtered);
        return filtered;
      });

      // Supabase upsert for authenticated users
      if (isAuthenticated && user) {
        try {
          await userDataService.upsertActivityDay(user.userId, today, delta);
        } catch (error) {
          console.warn('Failed to sync activity to Supabase:', error);
        }
      }
    },
    [isAuthenticated, user, key],
  );

  return { activities, recordActivity };
}
