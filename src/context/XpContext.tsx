import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { scopedKey } from '../utils/userStorage';
import { getItem, setItem } from '../utils/safeStorage';
import { useActivityLog } from '../hooks/useActivityLog';
import type { UserXP } from '../types';

const XP_STORAGE_KEY = 'mero_deutsch_xp';

/**
 * Stable XP reward amounts, awarded from ONE place (reportAnswer / awardXp).
 * - quiz: small reward for a single correct quiz item
 * - drill: medium reward for completing a practice drill
 * - dictation: large reward for a dictation word (kept from original system)
 */
export const XP_REWARDS = {
  quiz: 10,
  drill: 25,
  dictation: 50,
} as const;

/**
 * Calculate level and rank from total XP
 * Formula: level = Math.floor(totalXp / 250) + 1
 */
function calculateLevel(totalXp: number): { level: number; rank: string; xpToNextLevel: number } {
  const level = Math.floor(totalXp / 250) + 1;
  const xpInCurrentLevel = totalXp % 250;
  const xpToNextLevel = 250 - xpInCurrentLevel;

  let rank = 'Sprachnovize'; // Beginner
  if (level >= 8) {
    rank = 'Germanier Profi'; // Expert
  } else if (level >= 4) {
    rank = 'Fortgeschrittener Sprachschüler'; // Advanced Student
  }

  return { level, rank, xpToNextLevel };
}

/**
 * Load XP from storage (per-user scoped)
 * Uses safeStorage for consistency with other hooks
 */
function loadLocalXp(key: string): number {
  try {
    const stored = getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Save XP to storage (per-user scoped)
 * Uses safeStorage for consistency with other hooks
 */
function saveLocalXp(key: string, xp: number): void {
  try {
    setItem(key, xp.toString());
  } catch (error) {
    console.warn('Failed to save XP to storage:', error);
  }
}

export interface ReportAnswerOptions {
  correct: boolean;
  module: string;
  amount?: number;
}

interface XpContextValue extends UserXP {
  awardXp: (amount: number, source?: string) => Promise<void>;
  onLevelUp: (callback: (newLevel: number) => void) => void;
  resetXp: () => Promise<void>;
  /** Shared single-place award for quiz/drill/dictation correct answers. */
  reportAnswer: (result: ReportAnswerOptions) => void;
}

const XpContext = createContext<XpContextValue | undefined>(undefined);

/**
 * RPG-Style XP & Leveling System — shared context provider.
 *
 * Rewards:
 * - +10 XP for correct quiz answers (XP_REWARDS.quiz)
 * - +25 XP for completing a drill (XP_REWARDS.drill)
 * - +50 XP for a Dictation word (XP_REWARDS.dictation)
 *
 * Cloud synced via Supabase when user is authenticated.
 * Mounted once in main.tsx so XpWidget, quiz pages, and the global
 * LevelUpModal all read the SAME state.
 */
export function XpProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;
  const key = scopedKey(XP_STORAGE_KEY, userId);
  const [totalXp, setTotalXp] = useState<number>(() => loadLocalXp(key));
  const [levelUpCallback, setLevelUpCallback] = useState<((newLevel: number) => void) | null>(null);
  const { recordActivity } = useActivityLog();

  // Reset in-memory state whenever the user changes (login/logout/switch).
  useEffect(() => {
    setTotalXp(loadLocalXp(key));
  }, [key]);

  const userXp = useMemo<UserXP>(() => {
    const levelInfo = calculateLevel(totalXp);
    const xpProgress = totalXp > 0 ? Math.round((totalXp % 250) / 250 * 100) : 0;
    return {
      totalXp,
      ...levelInfo,
      xpForNextLevel: levelInfo.xpToNextLevel,
      xpProgress,
    };
  }, [totalXp]);

  // Fetch XP from Supabase on mount (if authenticated)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchRemoteXp = async () => {
      try {
        const { data, error } = await supabase
          .from('user_xp')
          .select('total_xp')
          .eq('user_id', user.userId)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') { // Not found is OK
            console.warn('Failed to fetch XP from Supabase:', error);
          }
          return;
        }

        if (data && data.total_xp !== undefined) {
          setTotalXp(data.total_xp);
          saveLocalXp(key, data.total_xp);
        }
      } catch (error) {
        console.warn('Error fetching remote XP:', error);
      }
    };

    void fetchRemoteXp();
  }, [isAuthenticated, user, key]);

  /**
   * Award XP to the user
   * Automatically syncs to Supabase if authenticated
   */
  const awardXp = useCallback(
    async (amount: number, _source: string = 'activity') => {
      const oldLevel = calculateLevel(totalXp).level;
      const newTotalXp = totalXp + amount;
      const newLevel = calculateLevel(newTotalXp).level;

      setTotalXp(newTotalXp);
      saveLocalXp(key, newTotalXp);

      // Trigger level-up callback if level increased
      if (newLevel > oldLevel && levelUpCallback) {
        levelUpCallback(newLevel);
      }

      // Sync to Supabase
      if (isAuthenticated && user) {
        try {
          await supabase.from('user_xp').upsert({
            user_id: user.userId,
            total_xp: newTotalXp,
            last_updated: new Date().toISOString(),
          });
        } catch (error) {
          console.warn('Failed to sync XP to Supabase:', error);
        }
      }
    },
    [totalXp, isAuthenticated, user, levelUpCallback, key]
  );

  /**
   * Register a callback to be called when user levels up
   */
  const onLevelUp = useCallback((callback: (newLevel: number) => void) => {
    setLevelUpCallback(() => callback);
  }, []);

  /**
   * Single shared award point for correct learning results.
   * Also records an engagement event for the activity heatmap.
   * Wrong answers still record activity (via useReviewQueue.addWrongAnswer),
   * so every answer attempt is counted — correct and wrong alike.
   */
  const reportAnswer = useCallback(
    ({ correct, module, amount }: ReportAnswerOptions) => {
      if (correct) {
        void awardXp(amount ?? XP_REWARDS.quiz, module);
      }
      // Record engagement activity for every answer attempt
      void recordActivity(1);
    },
    [awardXp, recordActivity]
  );

  /**
   * Reset XP (for testing or admin purposes)
   */
  const resetXp = useCallback(async () => {
    setTotalXp(0);
    saveLocalXp(key, 0);

    if (isAuthenticated && user) {
      try {
        await supabase.from('user_xp').delete().eq('user_id', user.userId);
      } catch (error) {
        console.warn('Failed to reset XP in Supabase:', error);
      }
    }
  }, [isAuthenticated, user, key]);

  const value = useMemo<XpContextValue>(
    () => ({
      ...userXp,
      awardXp,
      onLevelUp,
      resetXp,
      reportAnswer,
    }),
    [userXp, awardXp, onLevelUp, resetXp, reportAnswer]
  );

  return <XpContext.Provider value={value}>{children}</XpContext.Provider>;
}

export function useXpContext() {
  const context = useContext(XpContext);
  if (!context) {
    throw new Error('useXp must be used within XpProvider');
  }
  return context;
}
