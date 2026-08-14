import { useState } from 'react';

interface AudioButtonProps {
  word: string;
  className?: string;
  lang?: string; // Language code for screen readers (e.g., 'de', 'ne')
  showSpeedToggle?: boolean; // Enable playback speed control
}

/**
 * Play audio with variable speech rate using Web Speech API
 */
function playAudioWithSpeed(text: string, speed: number = 1.0) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = speed; // 0.75 for slow, 1.0 for normal
    window.speechSynthesis.speak(utterance);
  }
}

/**
 * Reusable audio button component for pronunciation.
 * Positioned consistently in the top-right corner of study cards.
 * Includes proper ARIA labels and language tags for screen reader accessibility.
 * Supports variable playback speed (0.75x for slow articulation, 1.0x for normal).
 */
export function AudioButton({ word, className = '', lang = 'de', showSpeedToggle = true }: AudioButtonProps) {
  const [speed, setSpeed] = useState<number>(1.0);

  const toggleSpeed = () => {
    setSpeed((current) => (current === 1.0 ? 0.75 : 1.0));
  };

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          playAudioWithSpeed(word, speed);
        }}
        onDoubleClick={(e) => {
          if (showSpeedToggle) {
            e.stopPropagation();
            toggleSpeed();
          }
        }}
        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-blue-600 text-base font-semibold text-white shadow transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none focus-visible:ring-offset-2 ${className}`}
        aria-label={`Play German audio pronunciation for ${word} at ${speed === 1.0 ? 'normal' : 'slow'} speed`}
      >
        <span aria-hidden="true">🔊</span>
        <span className="sr-only" lang={lang}>
          {word}
        </span>
      </button>
      {showSpeedToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSpeed();
          }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[10px] font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
          aria-label={`Toggle playback speed. Current: ${speed === 1.0 ? 'Normal' : 'Slow'}`}
        >
          {speed === 1.0 ? '1.0x' : '0.75x'}
        </button>
      )}
    </div>
  );
}
