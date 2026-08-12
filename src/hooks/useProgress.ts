import { useCallback, useState } from 'react';
import type { Progress } from '../types';
import { getItem, removeItem, setItem } from '../utils/safeStorage';

const KEY = 'germanAlphabetProgress';
const DEBOUNCE_MS = 300;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function load(): Progress {
  try {
    const raw = getItem(KEY);
    if (!raw) return { practiced: [], quizCorrect: 0, quizTotal: 0, spellCompleted: 0 };
    return JSON.parse(raw) as Progress;
  } catch {
    return { practiced: [], quizCorrect: 0, quizTotal: 0, spellCompleted: 0 };
  }
}

/** Progress / localStorage — edit only this file for progress logic */
export function useProgress() {
  const [progress, setProgress] = useState<Progress>(load);

  const save = useCallback((next: Progress) => {
    setProgress(next);
    // Debounce localStorage write to avoid expensive sync on every practice
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      setItem(KEY, JSON.stringify(next));
    }, DEBOUNCE_MS);
  }, []);

  const markPracticed = useCallback(
    (id: string) => {
      const p = load();
      if (!p.practiced.includes(id)) {
        p.practiced.push(id);
        save(p);
      }
    },
    [save]
  );

  const reset = useCallback(() => {
    removeItem(KEY);
    setProgress({ practiced: [], quizCorrect: 0, quizTotal: 0, spellCompleted: 0 });
  }, []);

  return { progress, save, markPracticed, reset };
}
