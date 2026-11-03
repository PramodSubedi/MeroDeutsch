import type { LearnerMemory, Recommendation } from '../types/chatbot';

/** Compute the primary recommendation from learner memory. */
export function computePrimaryRecommendation(
  memory: LearnerMemory,
  _recentIntents: string[] = []
): Recommendation | null {
  const { checkpointPercent, dueReviewCount, weakSkills, streak } = memory;

  // 1. Due reviews take highest priority
  if (dueReviewCount > 0) {
    return {
      id: 'due_reviews',
      title: 'Clear Reviews',
      reason: `${dueReviewCount} review${
        dueReviewCount !== 1 ? 's' : ''
      } due now`,
      action: { type: 'open_reviews', limit: Math.min(dueReviewCount, 10) },
      priority: 10,
    };
  }

  // 2. Checkpoint in the 70–95% range → finish unit practice
  if (checkpointPercent >= 70 && checkpointPercent <= 95) {
    return {
      id: 'finish_unit',
      title: 'Finish Unit',
      reason: `You're ${checkpointPercent}% through the unit – almost ready for the checkpoint!`,
      action: { type: 'continue_unit' },
      priority: 9,
    };
  }

  // 3. Streak at risk (>18h idle)
  if (streak > 0) {
    return {
      id: 'streak_save',
      title: 'Save Your Streak',
      reason: `${streak}-day streak in danger – a 2-min drill can save it!`,
      action: { type: 'start_quiz', skill: weakSkills[0]?.skill, size: 2 },
      priority: 8,
    };
  }

  // 4. Dominant weak skill → skill-specific drill
  if (weakSkills.length > 0 && weakSkills[0].score < 70) {
    const topSkill = weakSkills[0];
    return {
      id: 'skill_drill',
      title: `${topSkill.skill} Drill`,
      reason: `Your ${topSkill.skill} accuracy is ${topSkill.score}% – let's practise.`,
      action: { type: 'start_quiz', skill: topSkill.skill, size: 5 },
      priority: 7,
    };
  }

  // 5. Default: light practice suggestion
  return {
    id: 'light_practice',
    title: 'Light Practice',
    reason: 'Keep your German warm with a quick drill.',
    action: { type: 'start_quiz', skill: weakSkills[0]?.skill || 'vocabulary', size: 3 },
    priority: 5,
  };
}

/** Compute up to 2 alternative recommendations. */
export function computeAlternatives(
  memory: LearnerMemory,
  primary: Recommendation
): Recommendation[] {
  const alternatives: Recommendation[] = [];
  const { checkpointPercent, dueReviewCount, weakSkills } = memory;

  // If primary is not about reviews, add a reviews alternative if due > 0
  if (primary.action.type !== 'open_reviews' && dueReviewCount > 0) {
    alternatives.push({
      id: 'alt_reviews',
      title: 'Clear Reviews',
      reason: `${dueReviewCount} review${
        dueReviewCount !== 1 ? 's' : ''
      } are waiting`,
      action: { type: 'open_reviews', limit: Math.min(dueReviewCount, 5) },
      priority: 8,
    });
  }

  // If primary is not about checkpoints, add a checkpoint alternative
  if (
    primary.action.type !== 'continue_unit' &&
    checkpointPercent >= 70 &&
    checkpointPercent <= 95
  ) {
    alternatives.push({
      id: 'alt_unit',
      title: 'Finish Unit',
      reason: `You're ${checkpointPercent}% through – finish the unit!`,
      action: { type: 'continue_unit' },
      priority: 7,
    });
  }

  // If primary is not about skill drill, add a skill drill alternative
  if (
    primary.action.type !== 'start_quiz' &&
    weakSkills.length > 0 &&
    weakSkills[0].score < 70
  ) {
    const topSkill = weakSkills[0];
    alternatives.push({
      id: 'alt_skill',
      title: `${topSkill.skill} Drill`,
      reason: `Strengthen your ${topSkill.skill} with targeted practise.`,
      action: { type: 'start_quiz', skill: topSkill.skill, size: 5 },
      priority: 6,
    });
  }

  // Sort by priority and limit to 2
  return alternatives
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .filter((r) => r.id !== primary.id);
}

/** Generate the full recommendation set (primary + alternatives). */
export function generateRecommendations(
  memory: LearnerMemory,
  _recentIntents: string[] = []
): { primary: Recommendation; alternatives: Recommendation[] } {
  const primary = computePrimaryRecommendation(memory, _recentIntents) ?? {
    id: 'light_practice',
    title: 'Practice',
    reason: 'Keep your German warm.',
    action: { type: 'start_quiz', skill: 'vocabulary', size: 3 },
    priority: 5,
  };
  const alternatives = computeAlternatives(memory, primary);

  return { primary, alternatives };
}