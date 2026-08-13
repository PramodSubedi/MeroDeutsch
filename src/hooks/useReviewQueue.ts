import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WrongAnswerItem } from '../types';
import { getItem, removeItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

const DEBOUNCE_MS = 300;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const BASE_KEY = 'meroDeutschWrongAnswers';

/** SM-2–style interval ladder for v1 (days). */
const INTERVAL_LADDER = [1, 3, 7];

/** Leitner 5-Box System: Review intervals in days for each box level */
const LEITNER_INTERVALS = [1, 3, 7, 14, 30]; // Box 1-5 intervals

interface ReviewRow {
  id: string;
  module_type: string;
  item_key: string;
  user_answer?: string;
  correct_answer?: string;
  error_count: number;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  updated_at: string;
}

function loadQueue(key: string): WrongAnswerItem[] {
  try {
    const raw = getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as WrongAnswerItem[];
  } catch {
    return [];
  }
}

function saveQueue(key: string, items: WrongAnswerItem[]) {
  setItem(key, JSON.stringify(items));
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function rowToItem(row: ReviewRow): WrongAnswerItem {
  return {
    id: row.id,
    moduleType: row.module_type,
    itemKey: row.item_key,
    userAnswer: row.user_answer ?? '',
    correctAnswer: row.correct_answer ?? '',
    errorCount: row.error_count,
    timestamp: row.updated_at,
    ease: row.ease,
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    dueAt: row.due_at,
  };
}

function itemToRow(item: WrongAnswerItem): Omit<ReviewRow, 'updated_at'> {
  return {
    id: item.id,
    module_type: item.moduleType,
    item_key: item.itemKey,
    user_answer: item.userAnswer,
    correct_answer: item.correctAnswer,
    error_count: item.errorCount,
    ease: item.ease ?? 2.5,
    interval_days: item.intervalDays ?? 1,
    repetitions: item.repetitions ?? 0,
    due_at: item.dueAt ?? new Date().toISOString(),
  };
}

export function useReviewQueue() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;
  const key = scopedKey(BASE_KEY, userId);
  const [queue, setQueue] = useState<WrongAnswerItem[]>(() => loadQueue(key));

  // Reset in-memory state when the user changes (login/logout/switch).
  useEffect(() => {
    setQueue(loadQueue(key));
  }, [key]);

  // Fetch queue from Supabase on login.
  useEffect(() => {
    if (isAuthenticated && user) {
      const fetchRemoteQueue = async () => {
        const { data, error } = await supabase
          .from('review_queue')
          .select('id, module_type, item_key, user_answer, correct_answer, error_count, ease, interval_days, repetitions, due_at, updated_at')
          .eq('user_id', user.userId);

        if (!error && data) {
          const remote = (data as ReviewRow[]).map(rowToItem);
          const local = loadQueue(key);
          const mergedMap = new Map<string, WrongAnswerItem>();
          [...local, ...remote].forEach((item) => {
            if (item.id) mergedMap.set(item.id, item);
          });
          const merged = Array.from(mergedMap.values());
          setQueue(merged);
          saveQueue(key, merged);
        }
      };
      fetchRemoteQueue();
    }
  }, [isAuthenticated, user, key]);

  // Debounced local save + full sync to Supabase (delete + re-insert).
  useEffect(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveQueue(key, queue);
      if (isAuthenticated && user) {
        void (async () => {
          const userIdValue = user.userId;
          await supabase.from('review_queue').delete().eq('user_id', userIdValue);
          if (queue.length > 0) {
            await supabase.from('review_queue').insert(
              queue.map((item) => ({
                user_id: userIdValue,
                ...itemToRow(item),
                updated_at: new Date().toISOString(),
              }))
            );
          }
        })();
      }
    }, DEBOUNCE_MS);
  }, [queue, key, isAuthenticated, user]);

  const addWrongAnswer = useCallback((item: Omit<WrongAnswerItem, 'id' | 'timestamp' | 'errorCount'>) => {
    setQueue((current) => {
      const existing = current.find((entry) => entry.moduleType === item.moduleType && entry.itemKey === item.itemKey);
      if (existing) {
        // Wrong again → demote back to Box 1 (Leitner System)
        const updated: WrongAnswerItem = {
          ...existing,
          errorCount: existing.errorCount + 1,
          userAnswer: item.userAnswer,
          correctAnswer: item.correctAnswer,
          timestamp: new Date().toISOString(),
          boxLevel: 1, // Reset to Box 1 on mistake
          ease: 2.5,
          intervalDays: LEITNER_INTERVALS[0],
          repetitions: 0,
          dueAt: daysFromNow(0), // due immediately for practice
          lastResult: 'wrong',
        };
        return current.map((entry) => (entry.id === existing.id ? updated : entry));
      }
      return [
        ...current,
        {
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `wrong-${Date.now()}`,
          moduleType: item.moduleType,
          itemKey: item.itemKey,
          userAnswer: item.userAnswer,
          correctAnswer: item.correctAnswer,
          errorCount: 1,
          timestamp: new Date().toISOString(),
          boxLevel: 1, // Start at Box 1
          ease: 2.5,
          intervalDays: LEITNER_INTERVALS[0],
          repetitions: 0,
          dueAt: daysFromNow(0),
          lastResult: 'wrong',
        },
      ];
    });
  }, []);

  /** Mark an item as correctly recalled → promote to next Leitner box (1-5). */
  const markCorrect = useCallback((id: string) => {
    setQueue((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const currentBox = entry.boxLevel ?? 1;
        const nextBox = Math.min(currentBox + 1, 5); // Max box is 5
        const reps = (entry.repetitions ?? 0) + 1;
        const newInterval = LEITNER_INTERVALS[nextBox - 1]; // Box 1-5 maps to index 0-4
        return {
          ...entry,
          boxLevel: nextBox,
          repetitions: reps,
          intervalDays: newInterval,
          dueAt: daysFromNow(newInterval),
          lastResult: 'correct',
        };
      })
    );
  }, []);

  const markResolved = useCallback((id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    removeItem(key);
    setQueue([]);

    if (isAuthenticated && user) {
      void supabase.from('review_queue').delete().eq('user_id', user.userId);
    }
  }, [key, isAuthenticated, user]);

  // Due items first (dueAt <= now), then by error count desc, then by timestamp.
  const sortedQueue = useMemo(() => {
    const now = new Date().toISOString();
    return [...queue].sort((a, b) => {
      const aDue = a.dueAt ? a.dueAt <= now : true;
      const bDue = b.dueAt ? b.dueAt <= now : true;
      if (aDue !== bDue) return aDue ? -1 : 1;
      if (a.errorCount !== b.errorCount) return b.errorCount - a.errorCount;
      return a.timestamp.localeCompare(b.timestamp);
    });
  }, [queue]);

  return {
    queue: sortedQueue,
    addWrongAnswer,
    markCorrect,
    markResolved,
    clearQueue,
  };
}