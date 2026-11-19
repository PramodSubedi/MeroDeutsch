/** Identity and controls for Mero. */

import { HelpCircle, Minus, Trash2 } from 'lucide-react';
import type { ChatMode } from '../../types/chatbot';
import { MeroAvatar } from './MeroAvatar';

export interface ChatHeaderProps {
  isDE: boolean;
  mood: Parameters<typeof MeroAvatar>[0]['mood'];
  mode: ChatMode;
  onToggleMode: () => void;
  onPet: () => void;
  /** One-tap grounding in whatever the learner is looking at right now. */
  onExplainPage: () => void;
  /** Active style preferences, shown as a compact count. */
  preferenceCount: number;
  onClose: () => void;
  onClear: () => void;
}

export function ChatHeader({
  isDE,
  mood,
  mode,
  onToggleMode,
  onPet,
  onExplainPage,
  preferenceCount,
  onClose,
  onClear,
}: ChatHeaderProps) {
  const practice = mode === 'practice';
  return (
    <div className="flex items-center gap-2.5 border-b border-ink-200 px-3 py-2.5 dark:border-ink-800">
      <button type="button" onClick={onPet} aria-label={isDE ? 'Mero streicheln' : 'Pet Mero'} className="rounded-full p-1 transition active:scale-90">
        <MeroAvatar mood={mood} size={38} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-ink-950 dark:text-white">
          Mero
          {practice && (
            <span className="ml-1.5 rounded-sm bg-accent-100 px-1.5 py-0.5 text-micro font-semibold text-accent-700 dark:bg-accent-950/60 dark:text-accent-300">
              {isDE ? 'Sprechen' : 'Practice'}
            </span>
          )}
          {preferenceCount > 0 && (
            <span
              className="ml-1 rounded-sm bg-ink-100 px-1.5 py-0.5 text-micro font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300"
              title={isDE ? 'Aktive Stil-Vorlieben' : 'Active style preferences'}
            >
              {preferenceCount}
            </span>
          )}
        </p>
        <p className="text-meta text-ink-500 dark:text-ink-400">
          {isDE ? 'Deine Lerneule' : 'Your study owl'}
        </p>
      </div>

      <button
        type="button"
        onClick={onExplainPage}
        aria-label={isDE ? 'Diese Seite erklären' : 'Explain this page'}
        title={isDE ? 'Diese Seite erklären' : 'Explain this page'}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 active:scale-95 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onToggleMode}
        aria-pressed={practice}
        aria-label={practice ? (isDE ? 'Coach-Modus' : 'Switch to coach mode') : (isDE ? 'Sprechmodus' : 'Switch to German practice')}
        title={
          practice
            ? (isDE ? 'Zurück zum Coach-Modus' : 'Back to coach mode')
            : (isDE ? 'Auf Deutsch üben' : 'Practise German')
        }
        className={`inline-flex h-9 items-center rounded-md px-2 text-meta font-semibold transition active:scale-95 ${
          practice
            ? 'bg-accent-100 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300'
            : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100'
        }`}
      >
        {isDE ? 'Deutsch' : 'Deutsch'}
      </button>

      <button
        type="button"
        onClick={onClear}
        aria-label={isDE ? 'Chatverlauf löschen' : 'Clear chat history'}
        title={isDE ? 'Verlauf löschen' : 'Clear history'}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 active:scale-95 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label={isDE ? 'Mero schließen' : 'Close Mero'}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 active:scale-95 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
