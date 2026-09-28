/**
 * CompactAudioButton.tsx
 *
 * Minimal audio button for quiz/game scenarios where space is limited.
 * No speed toggle, just a speaker icon that plays audio on click.
 *
 * Compared to AudioButton:
 * - AudioButton: 44px × 44px + speed toggle below (takes ~60px vertical)
 * - CompactAudioButton: 40px × 40px on sm+ (no toggle), 44px × 44px on a phone
 *
 * The size difference is the touch-target floor, not a design choice: this
 * button is how a learner HEARS a word, so it is one of the most-used controls
 * in the app, and 40px misses the 44px minimum on exactly the device class that
 * needs it most. The extra 4px costs nothing here because the button sits
 * inline beside a word, not in a fixed-height toolbar.
 *
 * Playback routes through `useSpeech.speakWord` so a word with a bundled
 * `/audio/anki/` recording plays the natural clip instead of synthesized
 * speech, and so the global header mute actually silences this button.
 */

import { speakWord } from '../hooks/useSpeech';

interface CompactAudioButtonProps {
  word: string;
  className?: string;
  lang?: string;
  ariaLabel?: string;
}

export function CompactAudioButton({
  word,
  className = '',
  lang = 'de',
  ariaLabel
}: CompactAudioButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    speakWord(word);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-accent-600 text-body font-semibold text-white shadow transition hover:bg-accent-700 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:outline-none focus-visible:ring-offset-2 sm:min-h-10 sm:min-w-10 ${className}`}
      aria-label={ariaLabel || `Play pronunciation for ${word}`}
      lang={lang}
    >
      🔊
    </button>
  );
}
