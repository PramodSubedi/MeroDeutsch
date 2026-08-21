import { supabase } from '../lib/supabase';
import type { Progress, UserAchievements, WrongAnswerItem } from '../types';

/**
 * Service for syncing user data between localStorage and Supabase.
 * This allows offline-first behavior with cloud sync.
 */

const PROGRESS_KEY = 'germanAlphabetProgress';
const STREAK_KEY = 'germanDailyStreak';
const ACHIEVEMENTS_KEY = 'meroDeutschAchievements';
const REVIEW_QUEUE_KEY = 'meroDeutschWrongAnswers';

export const userDataService = {
  // --- Progress ---
  async getProgress(userId: string): Promise<Progress> {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return { practiced: [], quizCorrect: 0, quizTotal: 0, spellCompleted: 0 };
    }
    
    return {
      practiced: data.practiced_ids || [],
      quizCorrect: data.quiz_correct || 0,
      quizTotal: data.quiz_total || 0,
      spellCompleted: data.spell_completed || 0,
    };
  },

  async saveProgress(userId: string, progress: Progress): Promise<void> {
    const { error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        practiced_ids: progress.practiced,
        quiz_correct: progress.quizCorrect,
        quiz_total: progress.quizTotal,
        spell_completed: progress.spellCompleted,
        updated_at: new Date().toISOString(),
      });
    
    if (error) throw error;
  },

  // --- Streaks ---
  async getStreak(userId: string): Promise<{ current_streak: number; longest_streak: number; last_activity_date: string | null }> {
    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return { current_streak: 0, longest_streak: 0, last_activity_date: null };
    }
    
    return {
      current_streak: data.current_streak || 0,
      longest_streak: data.longest_streak || 0,
      last_activity_date: data.last_activity_date,
    };
  },

  async saveStreak(userId: string, streak: { current_streak: number; longest_streak: number; last_activity_date: string }): Promise<void> {
    const { error } = await supabase
      .from('user_streaks')
      .upsert({
        user_id: userId,
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        last_activity_date: streak.last_activity_date,
        updated_at: new Date().toISOString(),
      });
    
    if (error) throw error;
  },

  // --- Achievements ---
  async getAchievements(userId: string): Promise<UserAchievements> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('badge_id, unlocked_at')
      .eq('user_id', userId);
    
    if (error || !data) {
      return { badges: [] };
    }
    
    return {
      badges: data.map(d => ({
        id: d.badge_id,
        unlockedAt: d.unlocked_at,
      })),
    };
  },

  async unlockAchievement(userId: string, badgeId: string): Promise<void> {
    const { error } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        badge_id: badgeId,
        unlocked_at: new Date().toISOString(),
      }, { onConflict: 'user_id,badge_id' });
    
    if (error) throw error;
  },

  // --- Review Queue ---
  async getReviewQueue(userId: string): Promise<WrongAnswerItem[]> {
    const { data, error } = await supabase
      .from('review_queue')
      .select('*')
      .eq('user_id', userId)
      .order('due_at', { ascending: true });
    
    if (error || !data) return [];
    
    return data.map(d => ({
      id: d.id,
      moduleType: d.module_type,
      itemKey: d.item_key,
      userAnswer: d.user_answer,
      correctAnswer: d.correct_answer,
      errorCount: d.error_count,
      timestamp: d.created_at,
      ease: d.ease,
      intervalDays: d.interval_days,
      repetitions: d.repetitions,
      dueAt: d.due_at,
      lastResult: d.last_result,
      boxLevel: d.box_level,
    }));
  },

  async saveReviewQueue(userId: string, items: WrongAnswerItem[]): Promise<void> {
    // Upsert by primary key (id) — never delete-all + insert, so a failed
    // write cannot wipe the cloud queue.
    if (items.length === 0) return;

    const { error } = await supabase
      .from('review_queue')
      .upsert(items.map(item => ({
        id: item.id,
        user_id: userId,
        module_type: item.moduleType,
        item_key: item.itemKey,
        user_answer: item.userAnswer,
        correct_answer: item.correctAnswer,
        error_count: item.errorCount,
        created_at: item.timestamp,
        ease: item.ease,
        interval_days: item.intervalDays,
        repetitions: item.repetitions,
        due_at: item.dueAt,
        last_result: item.lastResult,
        box_level: item.boxLevel,
        updated_at: new Date().toISOString(),
      })), { onConflict: 'id' });

    if (error) throw error;
  },

  // --- Activity ---
  async getActivityDays(userId: string, daysBack: number = 90): Promise<{ date: string; count: number }[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('user_activity_days')
      .select('activity_date, event_count')
      .eq('user_id', userId)
      .gte('activity_date', cutoffStr);

    if (error || !data) return [];

    return (data as { activity_date: string; event_count: number }[]).map((d) => ({
      date: d.activity_date,
      count: d.event_count,
    }));
  },

  /**
   * Upsert today's activity row. The `delta` is added to the existing
   * event_count (or starts at `delta` if no row exists yet). For
   * authenticated users only — guests never touch Supabase.
   */
  async upsertActivityDay(userId: string, dateStr: string, delta: number = 1): Promise<void> {
    // Try UPDATE first (increment), fall back to INSERT.
    const { data: existing, error: selectError } = await supabase
      .from('user_activity_days')
      .select('event_count')
      .eq('user_id', userId)
      .eq('activity_date', dateStr)
      .maybeSingle();

    if (selectError) {
      console.warn('Failed to check existing activity row:', selectError);
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_activity_days')
        .update({ event_count: existing.event_count + delta, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('activity_date', dateStr);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('user_activity_days')
        .insert({
          user_id: userId,
          activity_date: dateStr,
          event_count: delta,
          updated_at: new Date().toISOString(),
        });
      if (insertError) throw insertError;
    }
  },

  // --- Migration Helpers ---
  async migrateLocalToCloud(userId: string): Promise<void> {
    // This would be called once after first login to migrate localStorage data
    const { getItem } = await import('../utils/safeStorage');

    // Progress
    const localProgress = getItem(PROGRESS_KEY);
    if (localProgress) {
      const progress = JSON.parse(localProgress) as Progress;
      await userDataService.saveProgress(userId, progress);
    }

    // Streak
    const localStreak = getItem(STREAK_KEY);
    if (localStreak) {
      const streak = JSON.parse(localStreak);
      await userDataService.saveStreak(userId, {
        current_streak: streak.streakCount || 0,
        longest_streak: streak.longestStreak || 0,
        last_activity_date: streak.lastVisit || new Date().toISOString().slice(0, 10),
      });
    }

    // Achievements
    const localAchievements = getItem(ACHIEVEMENTS_KEY);
    if (localAchievements) {
      const achievements = JSON.parse(localAchievements) as UserAchievements;
      for (const badge of achievements.badges) {
        await userDataService.unlockAchievement(userId, badge.id);
      }
    }

    // Review Queue
    const localQueue = getItem(REVIEW_QUEUE_KEY);
    if (localQueue) {
      const queue = JSON.parse(localQueue) as WrongAnswerItem[];
      await userDataService.saveReviewQueue(userId, queue);
    }
  },
};
