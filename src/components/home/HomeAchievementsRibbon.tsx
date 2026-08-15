import { useLang } from '../../hooks/useLang';

/**
 * Horizontal scroll ribbon of achievement chips for the Home page.
 * Shows unlocked achievements as glowing chips + a few locked ones with progress tooltips.
 * Scrollable to save vertical space.
 */
export function HomeAchievementsRibbon() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Sample achievement data — in production this would come from a hook or context
  const achievements = [
    { id: 'first_steps', label: isDE ? 'Erste Schritte' : 'First Steps', unlocked: true, requirement: isDE ? '10 Lektionen abgeschlossen' : '10 lessons completed', icon: '🌱' },
    { id: 'alphabet_explorer', label: isDE ? 'Alphabet-Explorer' : 'Alphabet Explorer', unlocked: true, requirement: isDE ? 'Alle 26 Buchstaben beherrscht' : 'Master all 26 letters', icon: '🔤' },
    { id: 'daily_streak_3', label: isDE ? '3-Tage Serie' : '3-Day Streak', unlocked: false, requirement: isDE ? '3 Tage am Stück gelernt' : '3 days in a row', icon: '🔥', current: 2, total: 7 },
    { id: 'quiz_master', label: isDE ? 'Quiz-Meister' : 'Quiz Master', unlocked: false, requirement: isDE ? '50 Quizfragen richtig' : '50 quiz questions correct', icon: '📊', current: 38, total: 50 },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {achievements.map((badge) => {
        const isUnlocked = badge.unlocked;
        const progressDisplay = badge.current !== undefined && !isUnlocked
          ? `${badge.current}/${badge.total}`
          : null;

        return (
          <div
            key={badge.id}
            className={`
              rounded-full px-3 py-1.5 text-xs font-medium transition-all
              ${isUnlocked
                ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300 shadow-glow'
                : 'bg-slate-600/30 border border-slate-500/30 text-slate-400 dark:border-slate-400/50 dark:text-slate-300'}
            `}
            aria-label={isUnlocked
              ? badge.label
              : `${badge.label} — ${badge.requirement}`}
          >
            {badge.icon}
            {isUnlocked ? (
              <span className="opacity-100">{badge.label}</span>
            ) : (
              <>
                <span className="opacity-80">{badge.label}</span>
                <span className="text-[9px] opacity-70 ml-1">{progressDisplay}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}