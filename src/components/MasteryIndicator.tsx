import type { WrongAnswerItem } from '../types';

interface MasteryIndicatorProps {
  boxLevel?: number;
  className?: string;
}

/**
 * Visual indicator for Leitner 5-Box SRS mastery level.
 * Displays 5 small dots/segments representing boxes 1-5.
 * Filled dots represent the current mastery level.
 */
export function MasteryIndicator({ boxLevel = 1, className = '' }: MasteryIndicatorProps) {
  const level = Math.max(1, Math.min(5, boxLevel)); // Clamp between 1-5

  return (
    <div className={`flex items-center gap-0.5 ${className}`} title={`Mastery Level: Box ${level}/5`}>
      {[1, 2, 3, 4, 5].map((box) => (
        <div
          key={box}
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
            box <= level
              ? 'bg-blue-500 dark:bg-blue-400'
              : 'bg-slate-300 dark:bg-slate-600'
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/**
 * Alternative bar-style mastery indicator for compact layouts
 */
export function MasteryBar({ boxLevel = 1, className = '' }: MasteryIndicatorProps) {
  const level = Math.max(1, Math.min(5, boxLevel));
  const percentage = (level / 5) * 100;

  return (
    <div className={`relative h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300 dark:from-blue-500 dark:to-blue-700"
        style={{ width: `${percentage}%` }}
        title={`Mastery Level: Box ${level}/5`}
      />
    </div>
  );
}

/**
 * Get the item's box level from review queue data
 */
export function getBoxLevel(item: Pick<WrongAnswerItem, 'boxLevel'>): number {
  return item.boxLevel ?? 1;
}
