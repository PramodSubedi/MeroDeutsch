import { useCallback, useEffect, useRef, useState } from 'react';
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

  // ── Debounced cloud flush ──────────────────────────────────────────────
  // Activity events fire per quiz answer (XP + review queue + trainer). The
  // old code sent one SELECT + UPDATE/INSERT pair per event — ~2 round trips
  // per answer. Accumulate per-day deltas and send ONE request 900ms after
  // the last event, so a 15-question session costs 1 network call.
  const ACTIVITY_FLUSH_DEBOUNCE_MS = 900;
  const pendingActivityRef = useRef(new Map<string, number>());
  const activityFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const isAuthedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const flushPendingActivity = useCallback(async () => {
    const activeUser = userRef.current;
    if (!isAuthedRef.current || !activeUser) return;
    const pending = pendingActivityRef.current;
    if (pending.size === 0) return;
    pendingActivityRef.current = new Map<string, number>();
    for (const [date, count] of Array.from(pending.entries())) {
      try {
        await userDataService.upsertActivityDay(activeUser.userId, date, count);
      } catch (error) {
        console.warn('Failed to sync activity to Supabase:', error);
      }
    }
  }, []);

  const scheduleActivityFlush = useCallback(() => {
    if (!isAuthedRef.current || !userRef.current) return;
    if (activityFlushTimerRef.current) clearTimeout(activityFlushTimerRef.current);
    activityFlushTimerRef.current = setTimeout(
      () => void flushPendingActivity(),
      ACTIVITY_FLUSH_DEBOUNCE_MS
    );
  }, [flushPendingActivity]);

  // Drop pending writes on user switch / unmount (never flush to another user).
  useEffect(() => {
    if (activityFlushTimerRef.current) {
      clearTimeout(activityFlushTimerRef.current);
      activityFlushTimerRef.current = null;
    }
    pendingActivityRef.current.clear();
  }, [key]);
  useEffect(
    () => () => {
      if (activityFlushTimerRef.current) clearTimeout(activityFlushTimerRef.current);
    },
    []
  );

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

      // Cloud: coalesce per-day deltas and flush once after the burst (single
      // atomic RPC call instead of SELECT + UPDATE/INSERT per answer).
      if (isAuthenticated && user) {
        pendingActivityRef.current.set(
          today,
          (pendingActivityRef.current.get(today) ?? 0) + delta
        );
        scheduleActivityFlush();
      }
    },
    [isAuthenticated, user, key, scheduleActivityFlush],
  );

  return { activities, recordActivity };
}
