/**
 * Reusable audio button for study cards.
 * Positioned consistently in the top-right corner of study cards.
 * Includes proper ARIA labels and language tags for screen reader accessibility.
 *
 * Playback routes through `useSpeech.speakWord`, so it gets a bundled
 * `/audio/anki/` recording whenever the word has one, honors the global header
 * mute, and follows the Settings speed control. The previous local
 * `speechSynthesis` call did none of those three things, which is why the
 * header mute button did not silence this control and every card here used a
 * different voice from the rest of the app.
 *
 * `showSpeedToggle` now cycles the GLOBAL speed setting (Settings → Speech
 * speed) rather than a private 1.0x/0.75x pair that only affected this button.
 */

import { speakWord, useSpeechSpeed } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';

interface AudioButtonProps {
  word: string;
  className?: string;
  lang?: string; // Language code for screen readers (e.g., 'de', 'ne')
  showSpeedToggle?: boolean; // Enable playback speed control
}

export function AudioButton({ word, className = '', lang = 'de', showSpeedToggle = true }: AudioButtonProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { speed, setNextSpeed } = useSpeechSpeed();

  const rateLabel = speed === 'slow' ? '0.6x' : speed === 'normal' ? '0.85x' : '1.05x';
  const speedLabel = speed === 'slow' ? (isDE ? 'Langsam' : 'Slow') : isDE ? 'Normal' : 'Normal';

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          speakWord(word);
        }}
        onDoubleClick={(e) => {
          if (showSpeedToggle) {
            e.stopPropagation();
            setNextSpeed();
          }
        }}
        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-accent-600 text-body font-semibold text-white shadow transition hover:bg-accent-700 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:outline-none focus-visible:ring-offset-2 ${className}`}
        aria-label={`Play German audio pronunciation for ${word}`}
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
            setNextSpeed();
          }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[10px] font-medium text-ink-600 hover:text-accent-600 dark:text-ink-400 dark:hover:text-accent-400 transition-colors"
          aria-label={`Speech speed. Current: ${speedLabel}. Applies to all pronunciation audio.`}
        >
          {rateLabel}
        </button>
      )}
    </div>
  );
}
