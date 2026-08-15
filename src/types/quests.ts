export interface DailyQuest {
  id: string;
  title: string;
  titleDE: string;
  description: string;
  descriptionDE: string;
  requirement: string;
  requirementDE: string;
  completed: boolean;
  rewardXp: number;
  /** Current progress toward completion (e.g. 3/5 due reviews). */
  progress?: number;
  /** Completion threshold for `progress`. */
  maxProgress?: number;
  /** Whether the bonus XP for this quest has already been claimed. */
  claimed?: boolean;
}

export interface DailyQuestState {
  quests: DailyQuest[];
  lastReset: string; // ISO date string
}

export interface BadgeData {
  id: string;
  title: string;
  titleDE: string;
  description: string;
  descriptionDE: string;
  icon: string;
  requirement: string;
  requirementDE: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

export interface UserBadges {
  unlocked: string[];
  inProgress: BadgeData[];
}