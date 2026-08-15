import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { WrongAnswerItem } from '../types';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { useActivityLog } from './useActivityLog';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { LEITNER_INTERVALS } from '../lib/db';

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function rowToItem(row: any): WrongAnswerItem {
  return {
    id: row.id,
    moduleType: row.moduleType,
    itemKey: row.cardId,
    userAnswer: row.userAnswer ?? '',
    correctAnswer: row.correctAnswer ?? '',
    errorCount: row.lapses ?? 0,
    timestamp: row.updatedAt,
    ease: row.ease,
    intervalDays: row.intervalDays ?? 1,
    repetitions: row.repetitions ?? 0,
    dueAt: row.dueAt,
    lastResult: row.lastResult,
    boxLevel: row.box,
  };
}

function itemToRow(item: WrongAnswerItem): any {
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
    last_result: item.lastResult,
    box_level: item.boxLevel,
  };
}

export function useReviewQueue() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;
  const { recordActivity } = useActivityLog();

  // Live query for all userProgress rows for this user, with safe fallback to empty array
  const rows = useLiveQuery(() => {
    if (!db) return [];
    return db.userProgress.where('userId').equals(userId ?? '').toArray();
  }, [userId]) ?? [];

  const queue = useMemo(() => rows.map(rowToItem), [rows]);

  const DEBOUNCE_MS = 300;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from Supabase on login (once)
  useEffect(() => {
    if (isAuthenticated && user && userId) {
      supabase
        .from('review_queue')
        .select('id, module_type, item_key, user_answer, correct_answer, error_count, ease, interval_days, repetitions, due_at, updated_at, last_result, box_level')
        .eq('user_id', user.userId)
        .then(({ data, error }) => {
          if (!error && data && db) {
            const remote = data.map((row: any) => rowToItem({
              id: row.id,
              moduleType: row.module_type,
              cardId: row.item_key,
              userAnswer: row.user_answer,
              correctAnswer: row.correct_answer,
              lapses: row.error_count,
              updatedAt: row.updated_at,
              ease: row.ease,
              intervalDays: row.interval_days,
              repetitions: row.repetitions,
              dueAt: row.due_at,
              lastResult: row.last_result,
              box: row.box_level,
            }));

            const mergedMap = new Map<string, WrongAnswerItem>();
            [...queue, ...remote].forEach(item => {
              if (item.id) mergedMap.set(item.id, item);
            });
            const merged = Array.from(mergedMap.values());

            db.userProgress.bulkPut(
              merged.map(item => ({
                id: item.id,
                userId: userId,
                cardId: item.itemKey,
                moduleType: item.moduleType,
                box: item.boxLevel ?? 1,
                dueAt: item.dueAt ?? new Date().toISOString(),
                intervalDays: item.intervalDays ?? 1,
                lapses: item.errorCount,
                lastReviewedAt: item.timestamp ?? new Date().toISOString(),
                ease: item.ease ?? 2.5,
                repetitions: item.repetitions ?? 0,
                lastResult: item.lastResult,
                userAnswer: item.userAnswer,
                correctAnswer: item.correctAnswer,
                updatedAt: new Date().toISOString(),
              }))
            );
          }
        });
    }
  }, [isAuthenticated, userId]); // Note: removing queue from deps list to prevent loops

  // Debounced persist to remote Supabase (only when queue changes)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      // Full sync (delete + insert)
      await supabase.from('review_queue').delete().eq('user_id', userId);
      if (queue.length > 0) {
        await supabase.from('review_queue').insert(
          queue.map(item => ({
            user_id: userId,
            ...itemToRow(item),
            updated_at: new Date().toISOString(),
          }))
        );
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [queue, userId, isAuthenticated]);

  const addWrongAnswer = useCallback((item: Omit<WrongAnswerItem, 'id' | 'timestamp' | 'errorCount'>) => {
    if (!db || !userId) return;

    const existing = queue.find((entry) => entry.moduleType === item.moduleType && entry.itemKey === item.itemKey);
    const id = existing?.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `wrong-${Date.now()}`);
    const errorCount = (existing?.errorCount ?? 0) + 1;

    db.userProgress.put({
      id,
      userId,
      cardId: item.itemKey,
      moduleType: item.moduleType,
      box: 1, // Start/reset to box 1 on wrong answer
      dueAt: daysFromNow(0),
      intervalDays: LEITNER_INTERVALS[0],
      lapses: errorCount,
      lastReviewedAt: new Date().toISOString(),
      ease: 2.5,
      repetitions: 0,
      lastResult: 'wrong',
      userAnswer: item.userAnswer,
      correctAnswer: item.correctAnswer,
      updatedAt: new Date().toISOString(),
    });

    void recordActivity(1);
  }, [userId, queue, recordActivity]);

  const markCorrect = useCallback((id: string) => {
    const localDb = db;
    if (!localDb) return;

    localDb.userProgress.get(id).then((row) => {
      if (!row) return;
      const nextBox = Math.min((row.box ?? 1) + 1, 5);
      const reps = (row.repetitions ?? 0) + 1;
      const interval = LEITNER_INTERVALS[nextBox - 1];

      localDb.userProgress.put({
        ...row,
        box: nextBox,
        repetitions: reps,
        intervalDays: interval,
        dueAt: daysFromNow(interval),
        lastResult: 'correct',
        updatedAt: new Date().toISOString(),
      });
    });

    void recordActivity(1);
  }, [recordActivity]);

  const markResolved = useCallback((id: string) => {
    if (!db) return;
    db.userProgress.delete(id);
  }, []);

  const clearQueue = useCallback(() => {
    if (!db || !userId) return;
    db.userProgress.where('userId').equals(userId).delete();
    if (isAuthenticated) {
      void supabase.from('review_queue').delete().eq('user_id', userId);
    }
  }, [userId, isAuthenticated]);

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

  const dueQueue = useMemo(() => {
    const now = new Date().toISOString();
    return sortedQueue.filter((item) => !item.dueAt || item.dueAt <= now);
  }, [sortedQueue]);

  return {
    queue: sortedQueue,
    dueQueue,
    addWrongAnswer,
    markCorrect,
    markResolved,
    clearQueue,
  };
}
