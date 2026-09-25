/**
 * CompactAudioButton.tsx
 *
 * Minimal audio button for quiz/game scenarios where space is limited.
 * No speed toggle, just a speaker icon that plays audio on click.
 *
 * Compared to AudioButton:
 * - AudioButton: 44px × 44px + speed toggle below (takes ~60px vertical)
 * - CompactAudioButton: 40px × 40px, no toggle (takes ~40px vertical)
 */

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
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = `${lang}-DE`;
      utterance.rate = 0.85; // Standard quiz playback speed
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-accent-600 text-body font-semibold text-white shadow transition hover:bg-accent-700 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:outline-none focus-visible:ring-offset-2 ${className}`}
      aria-label={ariaLabel || `Play pronunciation for ${word}`}
    >
      🔊
    </button>
  );
}
