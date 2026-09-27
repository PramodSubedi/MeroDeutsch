/**
 * src/components/chat/payloads/ErrorCard.tsx
 *
 * The actual mistake, side by side. "Why was I wrong" is a bad question to
 * answer in prose; showing `die ✗ → der Hund ✓` is the answer, and the rule
 * beneath it is what Mero adds in words.
 */

import { getHint } from '../../../data/hints';
import type { ChatPayload } from '../../../types/chatbot';

export type ErrorPayload = Extract<ChatPayload, { kind: 'error' }>;

export function ErrorCard({
  payload,
  isDE,
  onAction,
}: {
  payload: ErrorPayload;
  isDE: boolean;
  onAction: (to: string) => void;
}) {
  const hint = getHint(payload.errorTag === 'article' ? 'articles' : (payload.moduleType ?? ''));

  return (
    <div className="rounded-md border border-danger-200 bg-danger-50/60 p-3 dark:border-danger-900/50 dark:bg-danger-950/30">
      <p className="text-body font-semibold text-ink-900 dark:text-ink-100">
        {payload.itemKey}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-body">
        {payload.userAnswer && (
          <>
            <span className="rounded-sm bg-danger-100 px-1.5 py-0.5 line-through text-danger-700 dark:bg-danger-900/50 dark:text-danger-300">
              {payload.userAnswer}
            </span>
            <span aria-hidden="true" className="text-ink-400">→</span>
          </>
        )}
        <span className="rounded-sm bg-success-100 px-1.5 py-0.5 font-semibold text-success-800 dark:bg-success-900/40 dark:text-success-300">
          {payload.correctAnswer}
        </span>
      </div>

      {payload.errorCount > 1 && (
        <p className="mt-1.5 text-meta text-ink-500 dark:text-ink-400">
          {isDE
            ? `${payload.errorCount}× falsch`
            : `Missed ${payload.errorCount}×`}
        </p>
      )}

      {!isDE && <p className="mt-1.5 text-meta text-ink-600 dark:text-ink-300">{hint.en}</p>}

      {payload.route && (
        <button
          type="button"
          onClick={() => onAction(payload.route as string)}
          className="mt-2 inline-flex min-h-[32px] items-center rounded-md border border-accent-300 bg-white px-2.5 py-1 text-meta font-semibold text-accent-700 transition hover:bg-accent-50 active:scale-[0.98] dark:border-accent-800 dark:bg-ink-900 dark:text-accent-300"
        >
          → {isDE ? 'Übung öffnen' : 'Practise this'}
        </button>
      )}
    </div>
  );
}
