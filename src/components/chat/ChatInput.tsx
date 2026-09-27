/**
 * src/components/chat/ChatInput.tsx — composer.
 *
 * Enter sends, Shift+Enter inserts a newline. The textarea auto-grows to its
 * content up to a cap so a long question does not push the transcript off
 * screen, and `Enter` is only intercepted when a send is actually possible —
 * hijacking Enter while the input is empty or disabled produces the classic
 * "the keyboard did nothing" bug.
 */

import { useEffect, useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';

const MAX_HEIGHT = 120;

export interface ChatInputProps {
  isDE: boolean;
  isStreaming: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function ChatInput({ isDE, isStreaming, disabled, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow, reset on every content change.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = !disabled && !isStreaming && value.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <div className="flex items-end gap-2 border-t border-ink-200 p-3 dark:border-ink-800">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={
          disabled
            ? isDE
              ? 'Einstellungen prüfen …'
              : 'Check Settings first …'
            : isDE
              ? 'Frag Mero etwas …'
              : 'Ask Mero something …'
        }
        aria-label={isDE ? 'Nachricht an Mero' : 'Message Mero'}
        className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-md border border-ink-200 bg-white px-3 py-2.5 text-body text-ink-900 placeholder:text-ink-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 disabled:opacity-60 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500"
      />

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          aria-label={isDE ? 'Antwort stoppen' : 'Stop generating'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 transition hover:bg-ink-50 active:scale-95 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <Square className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={isDE ? 'Senden' : 'Send'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-600 text-white transition hover:bg-accent-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
