/**
 * src/hooks/useSkillAccuracy.ts
 *
 * Analytics data layer for the SkillRadarChart.
 *
 * Computes per-skill ACCURACY (0-100) from the OFFLINE-FIRST Dexie
 * `userProgress` table (the same Leitner SRS rows every exercise writes to),
 * so the radar works fully offline and reflects real answer outcomes:
 *
 *   accuracy = lastResult === 'correct' rows / rows with a known lastResult
 *
 * Skill mapping (moduleType -> tactical category):
 *   Grammar    : grammar, roleplay
 *   Vocabulary : articles, greetings, calendar, numbers, a1-checkpoint,
 *                rapid-blitz, rapid-fire
 *   Listening  : dictation, pronunciation
 *   Spelling   : alphabet, spelling
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAuth } from './useAuth';

export type SkillCategory = 'grammar' | 'vocabulary' | 'listening' | 'spelling';

export interface SkillStat {
  category: SkillCategory;
  /** Human label (localized at render time). */
  correct: number;
  total: number;
  /** 0-100 accuracy; 0 when no data exists yet. */
  accuracy: number;
}

const SKILL_MODULES: Record<SkillCategory, string[]> = {
  grammar: ['grammar', 'roleplay'],
  vocabulary: [
    'articles',
    'greetings',
    'calendar',
    'numbers',
    'a1-checkpoint',
    'rapid-blitz',
    'rapid-fire',
  ],
  listening: ['dictation', 'pronunciation'],
  spelling: ['alphabet', 'spelling'],
};

export const SKILL_ORDER: SkillCategory[] = ['grammar', 'vocabulary', 'listening', 'spelling'];

export function useSkillAccuracy() {
  const { user } = useAuth();
  const userId = user?.userId ?? null;

  // Live query over the SRS rows — updates instantly as exercises are answered.
  const rows = useLiveQuery(() => {
    if (!db || !userId) return [];
    return db.userProgress.where('userId').equals(userId).toArray();
  }, [userId]) ?? [];

  const skills = useMemo<SkillStat[]>(() => {
    return SKILL_ORDER.map((category) => {
      const modules = new Set(SKILL_MODULES[category]);
      let correct = 0;
      let total = 0;
      for (const row of rows) {
        if (!modules.has(row.moduleType)) continue;
        // Only rows with a recorded outcome count toward accuracy.
        if (row.lastResult !== 'correct' && row.lastResult !== 'wrong') continue;
        total += 1;
        if (row.lastResult === 'correct') correct += 1;
      }
      return {
        category,
        correct,
        total,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });
  }, [rows]);

  const hasData = skills.some((s) => s.total > 0);

  return { skills, hasData };
}