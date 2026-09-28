/**
 * CompactAudioButton.tsx
 *
 * Minimal audio button for quiz/game scenarios where space is limited.
 * No speed toggle, just a speaker icon that plays audio on click.
 *
 * Compared to AudioButton:
 * - AudioButton: 44px × 44px + speed toggle below (takes ~60px vertical)
 * - CompactAudioButton: 40px × 40px, no toggle (takes ~40px vertical)
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
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-accent-600 text-body font-semibold text-white shadow transition hover:bg-accent-700 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:outline-none focus-visible:ring-offset-2 ${className}`}
      aria-label={ariaLabel || `Play pronunciation for ${word}`}
      lang={lang}
    >
      🔊
    </button>
  );
}
