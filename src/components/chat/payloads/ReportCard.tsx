/**
 * src/components/chat/payloads/ReportCard.tsx
 *
 * The weekly report. Every row is a number from the live snapshot, assembled by
 * `lib/weeklyReport.ts` — the model supplies one sentence of commentary around
 * these rows, never the numbers themselves.
 */

import type { ChatPayload } from '../../../types/chatbot';

export type ReportPayload = Extract<ChatPayload, { kind: 'report' }>;

export function ReportCard({ payload }: { payload: ReportPayload }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <dl className="space-y-1.5">
        {payload.summary.map((row) => (
          <div key={row.title} className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-micro uppercase tracking-wider text-ink-500 dark:text-ink-400">
              {row.title}
            </dt>
            <dd className="text-body font-medium text-ink-900 dark:text-ink-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
