import { useMemo } from 'react';
import { useLang } from '../hooks/useLang';
import type { BadgeData } from '../types/quests';
import { theme } from '../config/theme';

interface BadgeShowcaseProps {
  badges: BadgeData[];
  unlockedIds: string[];
}

// Badge icons (emoji-based for simplicity)
const BADGE_ICONS: Record<string, string> = {
  'first-review': '📚',
  'ten-reviews': '🔟',
  'fifty-reviews': '5️⃣',
  'hundred-reviews': '100️⃣',
  'daily-streak-3': '🌕',
  'daily-streak-7': '🌙',
  'daily-streak-30': '⭐',
  'perfect-score': '🎯',
  'story-complete': '📖',
  'grammar-master': '⚙️',
};

export function BadgeShowcase({ badges, unlockedIds }: BadgeShowcaseProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const unlockedCount = useMemo(() => unlockedIds.length, [unlockedIds]);
  const totalBadges = badges.length;

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? 'Auszeichnungen' : 'Achievement Badges'}
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {unlockedCount} / {totalBadges} {isDE ? 'freigeschaltet' : 'unlocked'}
        </span>
      </div>

      {unlockedCount === 0 ? (
        <div className="py-8 text-center">
          <div className="mb-2 text-3xl">🏆</div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isDE 
              ? 'Schalte deine ersten Auszeichnungen frei!'
              : 'Unlock your first achievements!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {badges.map((badge) => {
            const isUnlocked = unlockedIds.includes(badge.id);
            const icon = BADGE_ICONS[badge.id] || '🏅';
            
            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="text-2xl">{icon}</div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {isDE ? badge.titleDE : badge.title}
                </div>
                {!isUnlocked && badge.maxProgress && badge.progress && (
                  <div className="w-16 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div 
                      className="rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(badge.progress / badge.maxProgress) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {unlockedCount > 0 && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {isDE ? 'Kürzliche Erfolge' : 'Recent Achievements'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isDE 
              ? 'Du hast Auszeichnungen für deine Fortschritte freigeschaltet.'
              : 'You have unlocked achievements for your progress.'}
          </p>
        </div>
      )}
    </div>
  );
}