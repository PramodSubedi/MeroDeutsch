import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useLang } from '../hooks/useLang';

interface LevelUpModalProps {
  isOpen: boolean;
  level: number;
  rank: string;
  onClose: () => void;
}

/**
 * Level-up toast notification (non-blocking, auto-dismisses).
 * Replaces the intrusive modal with a subtle toast banner.
 */
export function LevelUpModal({ isOpen, level, rank, onClose }: LevelUpModalProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  // Fire confetti effect (subtle, doesn't block interaction)
  useEffect(() => {
    if (!isOpen) return;

    const duration = 2500;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 20, spread: 360, ticks: 60, zIndex: 60 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 30 * (timeLeft / duration);
      
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
      className="fixed top-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 p-4 shadow-lg dark:border-blue-800 dark:from-blue-950/60 dark:to-blue-900/40 animate-in fade-in slide-in-from-top-4 duration-300"
      role="status"
      aria-live="polite"
      aria-label={isDE ? `Level aufgestiegen! Stufe ${level}` : `Level up! Level ${level}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl" aria-hidden="true">🎉</div>
        <div className="flex-1">
          <h3 className="font-bold text-blue-900 dark:text-blue-100">
            {isDE ? 'Level Up! Stufe ' : 'Level Up! Level '} <span className="text-2xl">{level}</span>
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
            {rank}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 font-semibold text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
