import { useState } from 'react';
import { speakWord } from '../hooks/useSpeech';

interface FlipCardProps {
  front: string;
  /** Hidden entirely in German-only mode. */
  back?: string;
  badge: string | number;
  langMode: 'normal' | 'german';
}

export function FlipCard({ front, back, badge, langMode }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const isDE = langMode === 'german';
  const showBack = !isDE && Boolean(back);

  return (
    <div className="group relative" style={{ perspective: '1000px' }}>
      <button
        type="button"
        onClick={() => showBack && setFlipped((f) => !f)}
        className="relative block w-full text-left"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none', transition: 'transform 0.4s' }}
        aria-pressed={showBack ? flipped : undefined}
        aria-label={flipped ? 'Show front' : 'Show back'}
      >
        <div
          className="rounded-2xl bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-8 shrink-0 text-center text-lg font-bold text-blue-600 dark:text-blue-400">{badge}</div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold text-slate-950 dark:text-white">{front}</div>
              {!flipped && showBack && (
                <div className="mt-1 text-xs text-slate-400">{isDE ? '' : '👆 Tap to reveal'}</div>
              )}
            </div>
          </div>
        </div>
        {showBack && (
          <div
            className="absolute inset-0 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-800 dark:bg-blue-950/40"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="flex h-full items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
                <div className="text-base font-semibold">{back}</div>
              </div>
            </div>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => speakWord(front)}
        className="absolute bottom-2 right-2 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-700"
        aria-label={`Speak ${front}`}
      >
        🔊
      </button>
    </div>
  );
}