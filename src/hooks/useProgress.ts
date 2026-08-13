import { useCallback, useEffect, useState } from 'react';
import type { Progress } from '../types';
import { getItem, removeItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

const BASE_KEY = 'germanAlphabetProgress';
const DEBOUNCE_MS = 1000;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const EMPTY: Progress = { practiced: [], quizCorrect: 0, quizTotal: 0, spellCompleted: 0 };

function loadLocal(key: string): Progress {
  try {
    const raw = getItem(key);
    if (!raw) return EMPTY;
    return JSON.parse(raw) as Progress;
  } catch {
    return EMPTY;
  }
}

/** Progress / per-user localStorage + Supabase Sync */
export function useProgress() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;
  const key = scopedKey(BASE_KEY, userId);
  const [progress, setProgress] = useState<Progress>(() => loadLocal(key));

  // Reset in-memory state whenever the user changes (login/logout/switch).
  useEffect(() => {
    setProgress(loadLocal(key));
  }, [key]);

  // Fetch from Supabase on login.
  useEffect(() => {
    if (isAuthenticated && user) {
      const fetchRemoteProgress = async () => {
        const { data, error } = await supabase
          .from('user_progress')
          .select('practiced_ids, quiz_correct, quiz_total, spell_completed')
          .eq('user_id', user.userId)
          .single();

        if (!error && data) {
          const remote: Progress = {
            practiced: data.practiced_ids || [],
            quizCorrect: data.quiz_correct || 0,
            quizTotal: data.quiz_total || 0,
            spellCompleted: data.spell_completed || 0,
          };

          const local = loadLocal(key);
          const merged: Progress = {
            practiced: Array.from(new Set([...local.practiced, ...remote.practiced])),
            quizCorrect: Math.max(local.quizCorrect, remote.quizCorrect),
            quizTotal: Math.max(local.quizTotal, remote.quizTotal),
            spellCompleted: Math.max(local.spellCompleted, remote.spellCompleted),
          };

          setProgress(merged);
          setItem(key, JSON.stringify(merged));
        }
      };
      fetchRemoteProgress();
    }
  }, [isAuthenticated, user, key]);

  const save = useCallback(
    (next: Progress) => {
      setProgress(next);
      setItem(key, JSON.stringify(next));

      if (isAuthenticated && user) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await supabase.from('user_progress').upsert({
            user_id: user.userId,
            practiced_ids: next.practiced,
            quiz_correct: next.quizCorrect,
            quiz_total: next.quizTotal,
            spell_completed: next.spellCompleted,
            updated_at: new Date().toISOString(),
          });
        }, DEBOUNCE_MS);
      }
    },
    [isAuthenticated, user, key]
  );

  const markPracticed = useCallback(
    (id: string) => {
      setProgress((prev) => {
        if (prev.practiced.includes(id)) return prev;
        const next = { ...prev, practiced: [...prev.practiced, id] };
        save(next);
        return next;
      });
    },
    [save]
  );

  const reset = useCallback(async () => {
    removeItem(key);
    setProgress(EMPTY);

    if (isAuthenticated && user) {
      await supabase.from('user_progress').update({
        practiced_ids: [],
        quiz_correct: 0,
        quiz_total: 0,
        spell_completed: 0,
      }).eq('user_id', user.userId);
    }
  }, [isAuthenticated, user, key]);

  return { progress, save, markPracticed, reset };
}