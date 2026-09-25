import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { useLang } from '../hooks/useLang';
import { theme } from '../config/theme';
import { ANCHORS, scrollToAnchor } from '../lib/anchors';

/**
 * DailyQuestsWidget — gamified daily objective tracker for the Dashboard.
 *
 * Reads the auto-resetting 3-quest set from `useDailyQuests()` (Speed Demon,
 * SRS Scholar, Accuracy Master), renders progress bars per quest, and lets
 * the user claim the bonus XP for each completed quest (one-time per day).
 */
export function DailyQuestsWidget() {
  const { quests, claimReward, totalRewardXp, completedCount } = useDailyQuests();
  const { langMode } = useLang();
  const navigate = useNavigate();
  const isDE = langMode === 'german';

  const handleQuestAction = (questId: string) => {
    if (questId === 'speed-demon') {
      navigate('/rapid-fire');
      return;
    }
    if (questId === 'srs-scholar') {
      scrollToAnchor(ANCHORS.reviewQueue);
      return;
    }
    navigate('/practice');
  };

  if (quests.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-accent-200 bg-accent-50 p-4 dark:border-accent-800 dark:bg-accent-950/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-body font-bold text-accent-800 dark:text-accent-200">
          🏆 {isDE ? 'Tägliche Ziele' : 'Daily Quests'} — {completedCount}/{quests.length}
        </div>
        {totalRewardXp > 0 && (
          <div className="text-meta font-semibold text-success-600">
            +{totalRewardXp} XP {isDE ? 'eingelöst' : 'claimed'}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {quests.map((quest) => {
          const pct = quest.maxProgress
            ? Math.min(100, Math.round(((quest.progress ?? 0) / quest.maxProgress) * 100))
            : quest.completed
              ? 100
              : 0;
          const label = isDE ? quest.titleDE : quest.title;
          const desc = isDE ? quest.descriptionDE : quest.description;

          // Completed quests shift to the emerald "done" family
          // (21st.dev "Activity Card" pattern); active stays violet.
          return (
            <div
              key={quest.id}
              className={`rounded-md border p-3 transition-colors ${
                quest.completed
                  ? 'border-success-200 bg-success-50/60 hover:border-success-300 dark:border-success-800 dark:bg-success-950/20 dark:hover:border-success-700'
                  : 'border-accent-200 bg-white hover:border-accent-300 dark:border-accent-800 dark:bg-ink-800 dark:hover:border-accent-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-body font-bold text-ink-900 dark:text-white">
                {quest.completed && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" aria-hidden="true" />
                )}
                <span>{label}</span>
              </div>
              <div className="mt-1 text-meta text-ink-500 dark:text-ink-400">{desc}</div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${quest.completed ? 'bg-success-500' : 'bg-accent-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-meta font-semibold text-ink-500 dark:text-ink-400">
                <span>{quest.progress ?? 0}/{quest.maxProgress ?? 1}</span>
                <span>+{quest.rewardXp} XP</span>
              </div>

              {/* Action */}
              <div className="mt-2">
                {quest.completed ? (
                  quest.claimed ? (
                    <span className="inline-flex w-full items-center justify-center rounded-sm bg-success-100 px-3 py-1.5 text-meta font-bold text-success-700 dark:bg-success-900/40 dark:text-success-300">
                      ✓ {isDE ? 'Eingelöst' : 'Claimed'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => claimReward(quest.id)}
                      className={`w-full ${theme.button.primarySmall}`}
                    >
                      {isDE ? 'XP einlösen' : 'Claim XP'} 🎁
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuestAction(quest.id)}
                    className={`w-full ${theme.button.secondarySmall}`}
                  >
                    {quest.id === 'speed-demon'
                      ? isDE ? 'Blitz starten' : 'Start Blitz'
                      : quest.id === 'srs-scholar'
                        ? isDE ? 'Review starten' : 'Start review'
                        : isDE ? 'Übung starten' : 'Start practice'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}