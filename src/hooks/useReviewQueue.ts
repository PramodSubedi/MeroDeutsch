import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WrongAnswerItem } from '../types';
import { getItem, removeItem, setItem } from '../utils/safeStorage';

const DEBOUNCE_MS = 300;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const KEY = 'meroDeutschWrongAnswers';

/** SM-2–style interval ladder for v1 (days). */
const INTERVAL_LADDER = [1, 3, 7];

function loadQueue(): WrongAnswerItem[] {
  try {
    const raw = getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WrongAnswerItem[];
  } catch {
    return [];
  }
}

function saveQueue(items: WrongAnswerItem[]) {
  setItem(KEY, JSON.stringify(items));
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function useReviewQueue() {
  const [queue, setQueue] = useState<WrongAnswerItem[]>(loadQueue);

  useEffect(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveQueue(queue);
    }, DEBOUNCE_MS);
  }, [queue]);

  const addWrongAnswer = useCallback((item: Omit<WrongAnswerItem, 'id' | 'timestamp' | 'errorCount'>) => {
    setQueue((current) => {
      const existing = current.find((entry) => entry.moduleType === item.moduleType && entry.itemKey === item.itemKey);
      if (existing) {
        // Wrong again → reset to a short interval, due very soon.
        const updated: WrongAnswerItem = {
          ...existing,
          errorCount: existing.errorCount + 1,
          userAnswer: item.userAnswer,
          correctAnswer: item.correctAnswer,
          timestamp: new Date().toISOString(),
          ease: 2.5,
          intervalDays: 1,
          repetitions: 0,
          dueAt: daysFromNow(0), // due today for practice
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
          ease: 2.5,
          intervalDays: 1,
          repetitions: 0,
          dueAt: daysFromNow(0),
          lastResult: 'wrong',
        },
      ];
    });
  }, []);

  /** Mark an item as correctly recalled → push the interval out (SM-2 ladder). */
  const markCorrect = useCallback((id: string) => {
    setQueue((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const reps = (entry.repetitions ?? 0) + 1;
        const intervalIndex = Math.min(reps - 1, INTERVAL_LADDER.length - 1);
        return {
          ...entry,
          repetitions: reps,
          intervalDays: INTERVAL_LADDER[intervalIndex],
          dueAt: daysFromNow(INTERVAL_LADDER[intervalIndex]),
          lastResult: 'correct',
        };
      })
    );
  }, []);

  const markResolved = useCallback((id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    removeItem(KEY);
    setQueue([]);
  }, []);

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