/** src/lib/learnerMemory.ts – Compact, always-fresh learner profile snapshot.
 * 
 * PURPOSE
 * -------
 * Give every reply access to a compact snapshot of the learner so Mero can
 * personalize without an LLM.  Updated on chat open and after quiz /
 * review / unit progress events.
 * 
 * KEEP WEAK LISTS CAPS
 * -------------------
 *   weakSkills:  capped at 5 entries
 *   weakWords:   capped at 20 entries
 * 
 * PERSISTENCE
 * ------------
 *  Stored in Zustand + Dexie where appropriate; raw chat text is NOT synced.
 *  The snapshot is rebuilt from `ctx.xp`, `ctx.skills`, `ctx.review`, and
 *  the A1 curriculum – never from untrusted chat text.
 */

/** CEFR progress level. */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** The structured learner memory snapshot. */
export interface LearnerMemory {
  // Progress
  cefr: CefrLevel;
  userLevel: 'A1.1' | 'A1.2' | 'A2.1';
  unitId: string | null;          // e.g. 'm07'
  unitIndex: number;
  checkpointPercent: number;      // 0–100
  xp: number;
  level: number;
  streak: number;
  lastActiveAt: number;           // epoch ms

  // Weakness
  weakSkills: { skill: string; score: number }[];   // top 3–5
  weakWords: { id: string; lemma: string; article?: string; dueAt?: number }[];  // top 10–20
  dueReviewCount: number;

  // Recent signals
  recentMistakes: { type: string; count: number; lastAt: number }[];  // e.g. articles, word-order
  recentIntents: string[];        // last 5–8 intents for follow-up awareness
  lastTopic?: { type: 'vocab' | 'grammar' | 'quiz' | 'unit'; key: string };

  // Preferences (inferred or explicit)
  preferredPractice?: 'quiz' | 'vocab' | 'grammar';
  languageMode: 'de' | 'de_en' | 'de_en_ne' | 'nur_deutsch';
  nudgesPausedUntil?: number;

  // Wins
  winsThisWeek: { quizzes: number; cardsReviewed: number; checkpointsPassed: number };
}

/** Default empty memory for a brand-new learner. */
export const emptyLearnerMemory: LearnerMemory = {
  cefr: 'A1',
  userLevel: 'A1.1',
  unitId: null,
  unitIndex: 0,
  checkpointPercent: 0,
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveAt: Date.now(),
  weakSkills: [],
  weakWords: [],
  dueReviewCount: 0,
  recentMistakes: [],
  recentIntents: [],
  languageMode: 'de',
  winsThisWeek: { quizzes: 0, cardsReviewed: 0, checkpointsPassed: 0 },
};

/** Rebuild a LearnerMemory snapshot from a ContextSnapshot. */
export function rebuildLearnerMemory(
  ctx: {
    xp: { totalXp: number; level: number; xpToNextLevel: number; rank: string };
    skills: { category: string; accuracy: number; correct: number; total: number }[];
    review: { due: number; recent: { errorTag: string; timestamp: number }[] };
    streak: { current: number };
    a1: { unitIndex: number; unitTitle: string; completedCount: number; totalLearnNodes: number };
    cefr: CefrLevel;
    languageMode: 'de' | 'de_en' | 'de_en_ne' | 'nur_deutsch';
    winsThisWeek: { quizzes: number; cardsReviewed: number; checkpointsPassed: number };
  }
): LearnerMemory {
  // Derive userLevel from CEFR + unit index (same logic as conversationManager)
  const userLevel = ctx.a1.unitIndex >= 3 ? 'A1.2' : 'A1.1';

  // Build weakSkills from skills with lowest accuracy
  const skillScores = ctx.skills
    .filter((s) => s.total >= 3)  // only skills with enough data
    .map((s) => ({
      skill: s.category,
      score: s.accuracy,
    }))
    .sort((a, b) => a.score - b.score);

  const weakSkills: { skill: string; score: number }[] = skillScores.length
    ? skillScores.slice(0, 5).map(s => ({ ...s, score: Math.round(s.score * 100) }))
    : [];

  // Build weakWords from review recent errors
  const weakWords: { id: string; lemma: string; article?: string; dueAt?: number }[] = [];
  // ... would be populated from review data when available

  // Recent mistakes from review queue
  const recentMistakes: { type: string; count: number; lastAt: number }[] = [];
  // ... populated from review.recent errorTags

  // Deduce lastTopic from the most recent intent or review
  const lastTopic: { type: 'vocab' | 'grammar' | 'quiz' | 'unit'; key: string } | undefined =
    ctx.review.recent.length > 0
      ? { type: 'vocab', key: ctx.review.recent[0].errorTag || 'unknown' }
      : undefined;

  return {
    cefr: ctx.cefr,
    userLevel,
    unitId: null,
    unitIndex: ctx.a1.unitIndex,
    checkpointPercent: ctx.a1.completedCount > 0
      ? Math.round((ctx.a1.completedCount / Math.max(ctx.a1.totalLearnNodes, 1)) * 100)
      : 0,
    xp: ctx.xp.totalXp,
    level: ctx.xp.level,
    streak: ctx.streak.current,
    lastActiveAt: Date.now(),
    weakSkills,
    weakWords,
    dueReviewCount: ctx.review.due,
    recentMistakes,
    recentIntents: [], // would be populated from chat history
    lastTopic,
    preferredPractice: undefined,
    languageMode: ctx.languageMode,
    nudgesPausedUntil: undefined,
    winsThisWeek: ctx.winsThisWeek,
  };
};

/** Flag if nudges are currently paused. */
export function shouldPauseNudge(memory: LearnerMemory, cooldownMs: number): boolean {
  if (!memory.nudgesPausedUntil) return false;
  return Date.now() < memory.nudgesPausedUntil + cooldownMs;
}

/** Mark nudges as paused for a duration. */
export function pauseNudges(memory: LearnerMemory, durationMs: number): LearnerMemory {
  return {
    ...memory,
    nudgesPausedUntil: Date.now() + durationMs,
  };
}