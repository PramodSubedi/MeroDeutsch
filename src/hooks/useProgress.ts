import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Progress } from '../types';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

const EMPTY_PROGRESS: Progress = { practiced: [], quizCorrect: 0, quizTotal: 0, spellCompleted: 0 };

export function useProgress() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;

  // Live query for moduleProgress rows for this user, safe fallback to empty array
  const rows = useLiveQuery(() => {
    if (!db) return [];
    return db.moduleProgress.where('userId').equals(userId ?? '').toArray();
  }, [userId]) ?? [];

  const moduleProgressRow = useMemo(() => rows.find(row => row.module === 'alphabet'), [rows]);

  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);

  // Sync state when database row is loaded asynchronously
  useEffect(() => {
    if (moduleProgressRow) {
      setProgress({
        practiced: moduleProgressRow.practiced ?? [],
        quizCorrect: moduleProgressRow.quizCorrect ?? 0,
        quizTotal: moduleProgressRow.quizTotal ?? 0,
        spellCompleted: moduleProgressRow.spellCompleted ?? 0,
      });
    }
  }, [moduleProgressRow]);

  // Sync with Supabase on login (once)
  useEffect(() => {
    if (isAuthenticated && user && userId) {
      supabase
        .from('user_progress')
        .select('practiced_ids, quiz_correct, quiz_total, spell_completed')
        .eq('user_id', user.userId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            const remote: Progress = {
              practiced: data.practiced_ids ?? [],
              quizCorrect: data.quiz_correct ?? 0,
              quizTotal: data.quiz_total ?? 0,
              spellCompleted: data.spell_completed ?? 0,
            };
            const merged: Progress = {
              practiced: Array.from(new Set([...progress.practiced, ...remote.practiced])),
              quizCorrect: Math.max(progress.quizCorrect, remote.quizCorrect),
              quizTotal: Math.max(progress.quizTotal, remote.quizTotal),
              spellCompleted: Math.max(progress.spellCompleted, remote.spellCompleted),
            };
            setProgress(merged);
            // Persist merged state to Dexie
            if (db) {
              db.moduleProgress.put({
                id: `${userId}:alphabet`,
                userId: userId,
                module: 'alphabet',
                practiced: merged.practiced,
                quizCorrect: merged.quizCorrect,
                quizTotal: merged.quizTotal,
                spellCompleted: merged.spellCompleted,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        });
    }
  }, [isAuthenticated, userId]); // Keep deps clean of progress to avoid loop

  // Save function that persists to Dexie and Supabase
  const save = useCallback(async (next: Progress) => {
    if (!userId) return;
    setProgress(next);
    // Persist to Dexie
    if (db) {
      await db.moduleProgress.put({
        id: `${userId}:alphabet`,
        userId: userId,
        module: 'alphabet',
        practiced: next.practiced,
        quizCorrect: next.quizCorrect,
        quizTotal: next.quizTotal,
        spellCompleted: next.spellCompleted,
        updatedAt: new Date().toISOString(),
      });
    }
    // Remote sync (simple upsert)
    if (isAuthenticated) {
      await supabase.from('user_progress').upsert({
        user_id: userId,
        practiced_ids: next.practiced,
        quiz_correct: next.quizCorrect,
        quiz_total: next.quizTotal,
        spell_completed: next.spellCompleted,
        updated_at: new Date().toISOString(),
      });
    }
  }, [userId, isAuthenticated]);

  const markPracticed = useCallback((id: string) => {
    setProgress((prev) => {
      if (prev.practiced.includes(id)) return prev;
      return { ...prev, practiced: [...prev.practiced, id] };
    });
    // Persist after state update — never inside the updater (avoids
    // StrictMode double-invoke and unordered async writes).
    void save({ ...progress, practiced: [...progress.practiced, id] });
  }, [save, progress]);

  const reset = useCallback(async () => {
    if (!userId) return;
    if (db) {
      await db.moduleProgress.delete(`${userId}:alphabet`);
    }
    setProgress(EMPTY_PROGRESS);
    if (isAuthenticated && user) {
      await supabase.from('user_progress')
        .update({
          practiced_ids: [],
          quiz_correct: 0,
          quiz_total: 0,
          spell_completed: 0,
        })
        .eq('user_id', user.userId);
    }
  }, [isAuthenticated, user, userId]);

  return { progress, save, markPracticed, reset };
}
