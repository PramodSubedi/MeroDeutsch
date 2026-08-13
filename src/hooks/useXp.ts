import { useXpContext, XP_REWARDS } from '../context/XpContext';

export { XP_REWARDS };

/**
 * Thick API adapter over the shared XpContext.
 *
 * Previously this hook maintained its own per-component state, so `XpWidget`
 * and `DictationPage` each read different XP numbers. Now the state lives in
 * the single `XpProvider` mounted in main.tsx; `useXp()` simply re-exports it.
 *
 * Public API (unchanged surface):
 *   const { totalXp, level, rank, xpForNextLevel, xpProgress, awardXp, onLevelUp, resetXp, reportAnswer } = useXp();
 */
export function useXp() {
  return useXpContext();
}