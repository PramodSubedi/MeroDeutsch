import type { WrongAnswerItem } from '../types';

interface MasteryIndicatorProps {
  boxLevel?: number;
  className?: string;
}

/**
 * Visual indicator for Leitner 4-Box SRS mastery level.
 * Displays 4 small dots/segments representing boxes 1-4.
 * Filled dots represent the current mastery level.
 */
export function MasteryIndicator({ boxLevel = 1, className = '' }: MasteryIndicatorProps) {
  const level = Math.max(1, Math.min(4, boxLevel)); // Clamp between 1-4

  return (
    <div className={`flex items-center gap-0.5 ${className}`} title={`Mastery Level: Box ${level}/4`}>
      {[1, 2, 3, 4].map((box) => (
        <div
          key={box}
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
            box <= level
              ? 'bg-accent-500 dark:bg-accent-400'
              : 'bg-ink-300 dark:bg-ink-600'
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
  const level = Math.max(1, Math.min(4, boxLevel));
  const percentage = (level / 4) * 100;

  return (
    <div className={`relative h-1 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700 ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-300 dark:from-accent-500 dark:to-accent-700"
        style={{ width: `${percentage}%` }}
        title={`Mastery Level: Box ${level}/4`}
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