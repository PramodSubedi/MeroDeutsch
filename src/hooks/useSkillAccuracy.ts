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
 *   Grammar    : grammar, roleplay, sentence-builder, email-builder, games
 *   Vocabulary : articles, greetings, calendar, numbers, stories, glossary,
 *                article-sprint, vocab-trainer, daily-challenge, a1-checkpoint,
 *                rapid-blitz, rapid-fire
 *   Listening  : dictation, pronunciation
 *   Spelling   : alphabet, spelling
 *
 * WHY THE MAP USED TO BE INCOMPLETE
 * ---------------------------------
 * It originally covered 13 moduleTypes, but the app emits 21. Every answer
 * recorded by the 8 unmapped tools was therefore invisible to the radar — a
 * learner who did nothing but Article Sprint and Sentence Builder was told they
 * had "no data", and their real accuracy was never computed. Nothing in the UI
 * signalled the gap, because a category with zero matching rows simply renders
 * as 0%.
 *
 * `SKILL_ROUTES` also lives here rather than inside SkillRadarChart: the chart
 * hard-coded its drill-down links in a `switch`, so any consumer that wanted to
 * route a learner to the tool that fixes their weakest skill had to re-derive
 * the mapping. One table, two readers.
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAuth } from './useAuth';
import { useReviewQueue } from './useReviewQueue';

export type SkillCategory = 'grammar' | 'vocabulary' | 'listening' | 'spelling';

/** One skill's measured accuracy. */
export interface SkillStat {
  category: SkillCategory;
  /** Human label (localized at render time — see `skillLabel`). */
  correct: number;
  total: number;
  /** 0-100 accuracy; 0 when no data exists yet. */
  accuracy: number;
}

/** Every moduleType the app can record an answer under, mapped to its skill. */
const SKILL_MODULES: Record<SkillCategory, string[]> = {
  grammar: [
    'grammar',
    'roleplay',
    'sentence-builder',
    'email-builder',
    'games',
  ],
  vocabulary: [
    'articles',
    'greetings',
    'calendar',
    'numbers',
    'stories',
    'glossary',
    'article-sprint',
    'vocab-trainer',
    'daily-challenge',
    'a1-checkpoint',
    'rapid-blitz',
    'rapid-fire',
  ],
  listening: ['dictation', 'pronunciation'],
  spelling: ['alphabet', 'spelling'],
};

export const SKILL_ORDER: SkillCategory[] = ['grammar', 'vocabulary', 'listening', 'spelling'];

/** Flattened reverse index — moduleType -> skill, for O(1) lookup when ranking. */
const MODULE_TO_SKILL: Record<string, SkillCategory> = (() => {
  const map: Record<string, SkillCategory> = {};
  for (const category of SKILL_ORDER) {
    for (const moduleType of SKILL_MODULES[category]) map[moduleType] = category;
  }
  return map;
})();

/** Which skill does this moduleType feed? `undefined` for unmapped types. */
export function skillForModule(moduleType: string): SkillCategory | undefined {
  return MODULE_TO_SKILL[moduleType];
}

/**
 * The one practice tool that best trains each skill.
 *
 * These are the SAME links SkillRadarChart already offered in its drill-down
 * hints; they are now the single source so a new "recommended for you" surface
 * cannot route someone to a different tool than the chart does.
 */
export const SKILL_ROUTES: Record<SkillCategory, string> = {
  grammar: '/grammar',
  vocabulary: '/glossary',
  listening: '/dictation',
  spelling: '/alphabet',
};

/** Localized display label for a skill (shared by the chart and any new card). */
export function skillLabel(category: SkillCategory, isDE: boolean): string {
  if (isDE) {
    return {
      grammar: 'Grammatik',
      vocabulary: 'Wortschatz',
      listening: 'Hören',
      spelling: 'Rechtschreibung',
    }[category];
  }
  return { grammar: 'Grammar', vocabulary: 'Vocabulary', listening: 'Listening', spelling: 'Spelling' }[category];
}

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

/**
 * Minimum answered items before a skill is eligible to be called "weakest".
 *
 * One wrong answer in one module would otherwise make that skill read 0% and
 * dominate the recommendation — the learner would be told their grammar is the
 * problem when they had answered exactly one grammar question.
 */
export const WEAK_SKILL_MIN_SAMPLES = 8;

export interface WeakestSkill {
  category: SkillCategory;
  accuracy: number;
  /** Where the learner should go to fix it. */
  route: string;
  total: number;
}

/**
 * The learner's weakest measured skill, or `null` when nothing is eligible yet.
 *
 * Deliberately the LOWEST accuracy among skills that clear WEAK_SKILL_MIN_SAMPLES
 * — a learner who is at 40% listening and 95% grammar needs listening, not the
 * skill with no data at all.
 */
export function useWeakestSkill(): WeakestSkill | null {
  const { skills } = useSkillAccuracy();
  return useMemo(() => {
    const eligible = skills.filter((s) => s.total >= WEAK_SKILL_MIN_SAMPLES);
    if (eligible.length === 0) return null;
    const worst = eligible.reduce((acc, s) => (s.accuracy < acc.accuracy ? s : acc));
    return {
      category: worst.category,
      accuracy: worst.accuracy,
      total: worst.total,
      route: SKILL_ROUTES[worst.category],
    };
  }, [skills]);
}

export interface WeakItem {
  /** The SRS `itemKey` — the stable id a drill's deck keys on. */
  itemKey: string;
  moduleType: string;
  /** How many times this has been answered wrong. */
  errorCount: number;
  /** The correct answer text, when the queue recorded one. */
  correctAnswer: string;
}

/**
 * The learner's worst items across every tool, ranked for deck prioritisation.
 *
 * BACKED BY THE SAME ROWS the rest of the app already writes. Every drill calls
 * `addWrongAnswer`, which lands a row in Dexie `userProgress` with `lapses` and
 * `errorCount`. This hook only RANKS them — there is no new tracking, no new
 * table, and nothing to migrate.
 *
 * Consumed by `pickNUnique({ preferKeys })` so a drill re-tests what the learner
 * actually got wrong before sampling anything new.
 */
export function useWeakItems(limit = 40): WeakItem[] {
  const { queue } = useReviewQueue();
  return useMemo(() => {
    return queue
      .filter((item) => item.errorCount > 0)
      .map((item) => ({
        itemKey: item.itemKey,
        moduleType: item.moduleType,
        errorCount: item.errorCount,
        correctAnswer: item.correctAnswer,
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, limit);
  }, [queue, limit]);
}

/**
 * Weak item keys restricted to one module — the form a single tool's deck
 * builder needs, since its pool only contains its own items.
 *
 * The SRS `itemKey` for a drill is whatever that drill used as the question key
 * (a word, a noun, a sentence id), which is NOT necessarily the deck's own
 * `getKey` output — e.g. Dictation decks key on `w.word` while the queue stores
 * `w.word` too, but Article Sprint stores `a.noun` while the articles pool also
 * keys on `a.noun`, so those two line up. Where they don't, `pickNUnique` simply
 * finds no match and behaves exactly as it did before.
 */
export function useWeakKeysFor(moduleType: string, limit = 40): string[] {
  const weak = useWeakItems(limit);
  return useMemo(
    () => weak.filter((w) => w.moduleType === moduleType).map((w) => w.itemKey),
    [weak, moduleType]
  );
}