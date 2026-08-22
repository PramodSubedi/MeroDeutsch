import { useLang } from '../hooks/useLang';
import { useXp } from '../hooks/useXp';

export function XpWidget() {
  const { langMode } = useLang();
  const { level, rank, totalXp, xpForNextLevel, xpProgress } = useXp();
  const isDE = langMode === 'german';

  return (
    <div className="rounded-[28px] bg-gradient-to-br from-purple-50 to-blue-50 p-6 shadow-sm transition duration-300 hover:shadow-xl dark:from-slate-900 dark:to-slate-950">
      <div className="flex items-center justify-between">
        <div className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
          {isDE ? 'Level & XP' : 'Level & XP'}
        </div>
        <span className="text-2xl" aria-hidden="true">⭐</span>
      </div>
      
      <div className="mt-4">
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-semibold text-slate-950 dark:text-white">
            {level}
          </div>
          <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
            {rank}
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
            <span>{totalXp} XP</span>
            <span>{xpForNextLevel} XP</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500" 
              style={{ width: `${xpProgress}%` }} 
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isDE 
              ? `${xpForNextLevel - totalXp} XP bis Level ${level + 1}` 
              : `${xpForNextLevel - totalXp} XP to Level ${level + 1}`}
          </p>
        </div>
      </div>
    </div>
  );
}
