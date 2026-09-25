import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onAudioPlay?: () => void;
  onSelectOption?: (index: number) => void;
  onSubmit?: () => void;
  onNext?: () => void;
  enabled?: boolean; // Allow disabling shortcuts when needed
}

/**
 * Custom hook for desktop keyboard shortcuts in quiz/drill screens.
 * 
 * Shortcuts:
 * - Spacebar: Trigger audio playback
 * - Keys 1-4: Select corresponding quiz option
 * - Enter: Submit answer or proceed to next question
 * 
 * Automatically ignores shortcuts when user is typing in input fields.
 */
export function useKeyboardShortcuts({
  onAudioPlay,
  onSelectOption,
  onSubmit,
  onNext,
  enabled = true,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field or textarea
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // Spacebar: Play audio
      if (e.code === 'Space') {
        e.preventDefault();
        onAudioPlay?.();
        return;
      }

      // Keys 1-4 or Numpad 1-4: Select quiz option
      if (
        ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].includes(e.code)
      ) {
        e.preventDefault();
        const index = parseInt(e.code.replace(/^(Digit|Numpad)/, '')) - 1;
        onSelectOption?.(index);
        return;
      }

      // Enter: Submit answer or go to next
      if (e.code === 'Enter') {
        e.preventDefault();
        if (onSubmit) {
          onSubmit();
        } else if (onNext) {
          onNext();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAudioPlay, onSelectOption, onSubmit, onNext, enabled]);
}

/**
 * Visual keyboard hint badge component for desktop users.
 * Shows subtle hints like [1], [2], [Space], [Enter] next to interactive elements.
 */
export function KeyboardHint({ shortcut, className = '' }: { shortcut: string; className?: string }) {
  const classes = [
    'hidden',
    'md:inline-flex',
    'items-center',
    'justify-center',
    'min-w-[20px]',
    'h-5',
    'px-1.5',
    'text-[10px]',
    'font-medium',
    'text-ink-500',
    'bg-ink-100',
    'border',
    'border-ink-300',
    'rounded-sm',
    'shadow-sm',
    'dark:text-ink-400',
    'dark:bg-ink-800',
    'dark:border-ink-600',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} aria-hidden="true">
      {shortcut}
    </span>
  );
}
