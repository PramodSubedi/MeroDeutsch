import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';

interface LevelUpModalProps {
  isOpen: boolean;
  level: number;
  rank: string;
  onClose: () => void;
}

/**
 * Level-up celebration modal with confetti effect
 */
export function LevelUpModal({ isOpen, level, rank, onClose }: LevelUpModalProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  useEffect(() => {
    if (!isOpen) return;

    // Fire confetti cannon
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Fire from left
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      
      // Fire from right
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={theme.modal.overlay}
      onClick={onClose}
      role="dialog"
      aria-labelledby="level-up-title"
      aria-modal="true"
    >
      <div
        className={theme.modal.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className={theme.modal.close}
          aria-label="Close"
        >
          ×
        </button>

        <div className="text-center">
          <div className="mb-4 text-6xl" aria-hidden="true">
            🎉
          </div>

          <h2
            id="level-up-title"
            className="text-3xl font-bold text-slate-900 dark:text-slate-100"
          >
            {isDE ? 'Level Up!' : 'Level Up!'}
          </h2>

          <div className="mt-4">
            <div className="text-5xl font-black text-blue-600 dark:text-blue-400">
              {isDE ? 'Stufe' : 'Level'} {level}
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-600 dark:text-slate-400">
              {rank}
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
            {isDE
              ? 'Gratulation! Du machst großartige Fortschritte beim Deutschlernen!'
              : 'Congratulations! You are making amazing progress in your German learning journey!'}
          </p>

          <button
            type="button"
            onClick={onClose}
            className={`${theme.button.primary} mt-6 w-full`}
          >
            {isDE ? 'Weiter!' : 'Continue!'}
          </button>
        </div>
      </div>
    </div>
  );
}
