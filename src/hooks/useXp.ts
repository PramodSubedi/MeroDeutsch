import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { UserXP } from '../types';

const XP_STORAGE_KEY = 'mero_deutsch_xp';

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
 * Load XP from localStorage
 */
function loadLocalXp(): number {
  try {
    const stored = localStorage.getItem(XP_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Save XP to localStorage
 */
function saveLocalXp(xp: number): void {
  try {
    localStorage.setItem(XP_STORAGE_KEY, xp.toString());
  } catch (error) {
    console.warn('Failed to save XP to localStorage:', error);
  }
}

/**
 * RPG-Style XP & Leveling System
 * 
 * Rewards:
 * - +10 XP for correct quiz answers
 * - +25 XP for completing an SRS review session
 * - +50 XP for completing a Dictation drill or reading a Micro-Story
 * 
 * Cloud synced via Supabase when user is authenticated
 */
export function useXp() {
  const { user, isAuthenticated } = useAuth();
  const [totalXp, setTotalXp] = useState<number>(loadLocalXp);
  const [levelUpCallback, setLevelUpCallback] = useState<((newLevel: number) => void) | null>(null);

  const levelInfo = calculateLevel(totalXp);
  const xpProgress = totalXp > 0 ? Math.round((totalXp % 250) / 250 * 100) : 0;

  const userXp: UserXP = {
    totalXp,
    ...levelInfo,
    xpForNextLevel: levelInfo.xpToNextLevel,
    xpProgress,
  };

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
          saveLocalXp(data.total_xp);
        }
      } catch (error) {
        console.warn('Error fetching remote XP:', error);
      }
    };

    void fetchRemoteXp();
  }, [isAuthenticated, user]);

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
      saveLocalXp(newTotalXp);

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
    [totalXp, isAuthenticated, user, levelUpCallback]
  );

  /**
   * Register a callback to be called when user levels up
   */
  const onLevelUp = useCallback((callback: (newLevel: number) => void) => {
    setLevelUpCallback(() => callback);
  }, []);

  /**
   * Reset XP (for testing or admin purposes)
   */
  const resetXp = useCallback(async () => {
    setTotalXp(0);
    saveLocalXp(0);

    if (isAuthenticated && user) {
      try {
        await supabase.from('user_xp').delete().eq('user_id', user.userId);
      } catch (error) {
        console.warn('Failed to reset XP in Supabase:', error);
      }
    }
  }, [isAuthenticated, user]);

  return {
    ...userXp,
    awardXp,
    onLevelUp,
    resetXp,
  };
}
