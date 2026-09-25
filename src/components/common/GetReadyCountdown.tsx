/**
 * components/common/GetReadyCountdown.tsx
 *
 * Shared "Get Ready" countdown overlay used by RapidBlitzPage. Shows a
 * consistent 3 → 2 → 1 → GO! animation so every quiz
 * type in the app has the same pre-game experience.
 *
 * Usage:
 *   <GetReadyCountdown onDone={startPlaying} title="Mixed Challenge" />
 */

import { useEffect, useState } from 'react';

interface GetReadyCountdownProps {
  /** Called after the GO! animation finishes (transitions to playing). */
  onDone: () => void;
  /** Title shown below the number (e.g. "Mixed Challenge"). */
  title: string;
  /** Optional subtitle shown below the title. */
  subtitle?: string;
}

export function GetReadyCountdown({ onDone, title, subtitle }: GetReadyCountdownProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      // Show "GO!" for 800ms, then hand control back.
      const timer = setTimeout(() => {
        onDone();
      }, 800);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onDone]);

  const display = count === 0 ? 'GO!' : String(count);
  const label = count === 0 ? 'Get ready!' : 'Get ready...';

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="text-xl font-medium text-ink-500 dark:text-ink-400">{label}</div>
      <div className="text-8xl font-extrabold drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-r from-accent-500 to-accent-600 dark:from-accent-400 dark:to-accent-400">
        {display}
      </div>
      {title && (
        <div className="text-body text-ink-500 dark:text-ink-500">Get ready to play {title}</div>
      )}
      {subtitle && <div className="text-body text-ink-500 dark:text-ink-400">{subtitle}</div>}
    </div>
  );
}
