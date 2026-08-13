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