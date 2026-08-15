import { useNavigate } from 'react-router-dom';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { useLang } from '../hooks/useLang';
import { theme } from '../config/theme';

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
      document.getElementById('review-queue-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    navigate('/practice');
  };

  if (quests.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-violet-800 dark:text-violet-200">
          🏆 {isDE ? 'Tägliche Ziele' : 'Daily Quests'} — {completedCount}/{quests.length}
        </div>
        {totalRewardXp > 0 && (
          <div className="text-xs font-semibold text-emerald-600">
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

          return (
            <div
              key={quest.id}
              className="rounded-xl border border-violet-200 bg-white p-3 dark:border-violet-800 dark:bg-slate-800"
            >
              <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{desc}</div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${quest.completed ? 'bg-emerald-500' : 'bg-violet-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>{quest.progress ?? 0}/{quest.maxProgress ?? 1}</span>
                <span>+{quest.rewardXp} XP</span>
              </div>

              {/* Action */}
              <div className="mt-2">
                {quest.completed ? (
                  quest.claimed ? (
                    <span className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      ✓ {isDE ? 'Eingelöst' : 'Claimed'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => claimReward(quest.id)}
                      className={`w-full ${theme.button.primary} !px-3 !py-1.5 text-xs`}
                    >
                      {isDE ? 'XP einlösen' : 'Claim XP'} 🎁
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuestAction(quest.id)}
                    className={`w-full ${theme.button.secondary} !px-3 !py-1.5 text-xs`}
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