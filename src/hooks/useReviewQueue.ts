import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { WrongAnswerItem } from '../types';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { useActivityLog } from './useActivityLog';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { LEITNER_INTERVALS } from '../lib/db';

/** Local Dexie row shape for the review queue. */
interface LocalReviewRow {
  id: string;
  userId: string;
  cardId: string;
  moduleType: string;
  box?: number;
  dueAt?: string;
  intervalDays?: number;
  lapses?: number;
  lastReviewedAt?: string;
  ease?: number;
  repetitions?: number;
  lastResult?: string;
  userAnswer?: string;
  correctAnswer?: string;
  updatedAt?: string;
  errorTag?: string;
}

/** Remote Supabase row shape for the review queue. */
interface RemoteReviewRow {
  id: string;
  module_type: string;
  item_key: string;
  user_answer: string | null;
  correct_answer: string | null;
  error_count: number | null;
  ease: number | null;
  interval_days: number | null;
  repetitions: number | null;
  due_at: string | null;
  updated_at: string | null;
  last_result: string | null;
  box_level: number | null;
  error_tag?: string | null;
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function rowToItem(row: LocalReviewRow): WrongAnswerItem {
  return {
    id: row.id,
    moduleType: row.moduleType,
    itemKey: row.cardId,
    userAnswer: row.userAnswer ?? '',
    correctAnswer: row.correctAnswer ?? '',
    errorCount: row.lapses ?? 0,
    timestamp: row.updatedAt ?? '',
    ease: row.ease,
    intervalDays: row.intervalDays ?? 1,
    repetitions: row.repetitions ?? 0,
    dueAt: row.dueAt,
    lastResult: (row.lastResult as WrongAnswerItem['lastResult']) ?? undefined,
    boxLevel: row.box,
    errorTag: row.errorTag as WrongAnswerItem['errorTag'],
  };
}

function remoteToItem(row: RemoteReviewRow): WrongAnswerItem {
  return {
    id: row.id,
    moduleType: row.module_type,
    itemKey: row.item_key,
    userAnswer: row.user_answer ?? '',
    correctAnswer: row.correct_answer ?? '',
    errorCount: row.error_count ?? 0,
    timestamp: row.updated_at ?? '',
    ease: row.ease ?? undefined,
    intervalDays: row.interval_days ?? 1,
    repetitions: row.repetitions ?? 0,
    dueAt: row.due_at ?? undefined,
    lastResult: (row.last_result as WrongAnswerItem['lastResult']) ?? undefined,
    boxLevel: row.box_level ?? undefined,
    errorTag: row.error_tag as WrongAnswerItem['errorTag'],
  };
}

function itemToRow(item: WrongAnswerItem): Omit<RemoteReviewRow, 'id'> {
  return {
    module_type: item.moduleType,
    item_key: item.itemKey,
    user_answer: item.userAnswer,
    correct_answer: item.correctAnswer,
    error_count: item.errorCount,
    ease: item.ease ?? 2.5,
    interval_days: item.intervalDays ?? 1,
    repetitions: item.repetitions ?? 0,
    due_at: item.dueAt ?? new Date().toISOString(),
    last_result: item.lastResult ?? null,
    box_level: item.boxLevel ?? null,
    error_tag: item.errorTag ?? null,
    updated_at: new Date().toISOString(),
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

  // Ref mirroring the latest queue so the remote-merge effect can read the
  // current local items without depending on `queue` (which would loop).
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const DEBOUNCE_MS = 300;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from Supabase on login (once). Merges remote rows with the *latest*
  // local queue (via queueRef) so newer local items are never dropped.
  useEffect(() => {
    if (isAuthenticated && user && userId) {
      supabase
        .from('review_queue')
        .select('id, module_type, item_key, user_answer, correct_answer, error_count, ease, interval_days, repetitions, due_at, updated_at, last_result, box_level')
        .eq('user_id', user.userId)
        .then(({ data, error }) => {
          if (!error && data && db) {
            const remote = data.map((row) => remoteToItem(row as RemoteReviewRow));

            const mergedMap = new Map<string, WrongAnswerItem>();
            [...queueRef.current, ...remote].forEach(item => {
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
  }, [isAuthenticated, userId]); // queue intentionally read via queueRef to avoid loops

  // Debounced persist to remote Supabase (only when queue changes).
  // Uses upsert-by-id (never delete-all + insert) so a failed write cannot
  // wipe the cloud queue. Local queue is never destroyed on remote failure.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      const current = queueRef.current;
      if (current.length === 0) return;

      const { error } = await supabase.from('review_queue').upsert(
        current.map(item => ({
          id: item.id,
          user_id: userId,
          ...itemToRow(item),
        })),
        { onConflict: 'id' }
      );
      if (error) {
        console.warn('Failed to sync review queue to Supabase:', error);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [queue, userId, isAuthenticated]);

const addWrongAnswer = useCallback((item: Omit<WrongAnswerItem, 'id' | 'timestamp' | 'errorCount'>) => {
    if (!db) return;

    const effectiveUserId = userId ?? 'guest';
    const existing = queue.find((entry) => entry.moduleType === item.moduleType && entry.itemKey === item.itemKey);
    const id = existing?.id ?? `${effectiveUserId}:${item.moduleType}|${item.itemKey}`;
    const errorCount = (existing?.errorCount ?? 0) + 1;

    // Phase C: Infer error tag
    let inferredTag: WrongAnswerItem['errorTag'] = 'other';
    const m = (item.moduleType ?? '').toLowerCase();
    if (m === 'articles' || m === 'blitz' || m === 'rapid-fire' || m === 'rapid-blitz' || m === 'pronoun-traps') inferredTag = 'article';
    else if (m === 'grammar' || m === 'verb-tictactoe' || m === 'verb-dice') inferredTag = 'verb';
    else if (m === 'alphabet' || m === 'spelling' || m === 'email-builder' || m === 'email-evaluator') inferredTag = 'spelling';
    else if (m === 'dictation' || m === 'pronunciation' || m === 'phonetic-traps') inferredTag = 'listening';

    db.userProgress.put({
      id,
      userId: effectiveUserId,
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
      // Store dynamic custom field on Dexie row
      errorTag: inferredTag,
    } as any);

    void recordActivity(1);
  }, [db, userId, queue, recordActivity]);

const markCorrect = useCallback((id: string) => {
    const localDb = db;
    if (!localDb) return;

    const effectiveUserId = userId ?? 'guest';
    localDb.userProgress.get(id).then((row) => {
      // Only mutate rows belonging to the current user.
      if (!row || row.userId !== effectiveUserId) return;

      const currentBox = row.box ?? 1;

// TRUE 4-BOX LEITNER: a correct answer at box 4 GRADUATES the card —
      // it is retired from the queue entirely instead of advancing to an
      // out-of-range box 5 (which would produce LEITNER_INTERVALS[4] === undefined
      // → Invalid Date → silent put failure, so mastered items could never leave the queue).
      // Cap advancement at box 4; a correct answer at box 4 graduates (removes from queue).
            if (currentBox >= LEITNER_INTERVALS.length) {
        // Graduation: delete remotely first, then locally. If the remote
        // delete fails (offline / 401 / …), keep the local row so a later
        // sync can retry it — otherwise the login-merge bulk-upsert would
        // resurrect the item (same "Bug B" ordering used by clearQueue below).
        if (isAuthenticated) {
          supabase
            .from('review_queue')
            .delete()
            .eq('id', id)
            .eq('user_id', effectiveUserId)
            .then(({ error }) => {
              if (error) {
                console.warn('Failed to retire graduated review item remotely:', error.message);
                return; // keep local row; retry on next sync
              }
              localDb.userProgress.delete(id);
            });
        } else {
          localDb.userProgress.delete(id);
        }
        return;
      }

// Advance one box, never exceeding box 4 (the graduation threshold).
      const nextBox = Math.min(currentBox + 1, LEITNER_INTERVALS.length);
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
  }, [db, userId, isAuthenticated, recordActivity]);

const markResolved = useCallback((id: string) => {
    const localDb = db;
    if (!localDb) return;
    const effectiveUserId = userId ?? 'guest';
    localDb.userProgress.get(id).then((row) => {
      // Only delete rows belonging to the current user.
            if (row && row.userId === effectiveUserId) {
        // Delete remotely first; only drop locally on success. If the cloud
        // delete fails, keep the local row so the next sync retries it and the
        // login-merge cannot resurrect a "resolved" item (Bug B ordering).
        if (isAuthenticated) {
          supabase
            .from('review_queue')
            .delete()
            .eq('id', id)
            .eq('user_id', effectiveUserId)
            .then(({ error }) => {
              if (error) {
                console.warn('Failed to delete review item remotely:', error.message);
                return; // keep local row; retry on next sync
              }
              localDb.userProgress.delete(id);
            });
        } else {
          localDb.userProgress.delete(id);
        }
      }
    });
  }, [db, userId, isAuthenticated]);

  /** Clear ALL review items. Cloud delete is AWAITED first so a subsequent
   *  login-merge cannot bulkPut the just-deleted remote rows back (Bug B).
   *  Local Dexie rows are cleared for the current user only.
   *  Resolves false when the cloud delete failed (caller should surface it). */
  const clearQueue = useCallback(async (): Promise<boolean> => {
    const effectiveUserId = userId ?? 'guest';
    if (isAuthenticated) {
      const { error } = await supabase.from('review_queue').delete().eq('user_id', effectiveUserId);
      if (error) {
        console.warn('Failed to clear review queue in Supabase:', error.message);
        return false;
      }
    }
    if (!db) return true;
    db.userProgress.where('userId').equals(effectiveUserId).delete();
    return true;
  }, [db, isAuthenticated, userId]);

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
