/**
 * src/components/chat/payloads/RulesCard.tsx
 *
 * Wraps the app's own `GrammarRuleTable` rather than re-rendering rules. That
 * table already handles Nur-DE (it drops the helper column and collapses to
 * form + example), so this component only supplies the rows the CURRENT module
 * actually teaches — the same rows the lesson page shows.
 */

import { GrammarRuleTable } from '../../grammar/GrammarRuleTable';
import type { ChatPayload } from '../../../types/chatbot';

export type RulesPayload = Extract<ChatPayload, { kind: 'rules' }>;

export function RulesCard({ payload }: { payload: RulesPayload }) {
  if (!payload.rows.length) return null;
  return (
    <div className="mt-1 overflow-hidden rounded-md [&>div]:mt-0 [&>div]:rounded-md [&>div]:border [&>div]:border-ink-200 [&>div]:bg-transparent [&>div]:p-0 [&>div]:shadow-none dark:[&>div]:border-ink-700 dark:[&>div]:bg-transparent">
      <GrammarRuleTable title={payload.title} rows={payload.rows} />
    </div>
  );
}
