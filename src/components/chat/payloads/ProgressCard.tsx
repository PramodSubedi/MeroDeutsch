/**
 * src/components/chat/payloads/ProgressCard.tsx
 *
 * Progress as a chart instead of a sentence. "You're level 4 with 320 XP" is a
 * wall of text that scrolled away; a ring plus four bars tells the same story
 * at a glance and costs the model zero tokens.
 *
 * Bars are coloured by value, not by a categorical palette, so a weak skill is
 * obviously weak. The accent is the app's token; the rest is the neutral ramp.
 */

import type { ChatPayload } from '../../../types/chatbot';

export type ProgressPayload = Extract<ChatPayload, { kind: 'progress' }>;

const SKILL_LABEL: Record<string, { en: string; de: string }> = {
  grammar: { en: 'Grammar', de: 'Grammatik' },
  vocabulary: { en: 'Vocabulary', de: 'Wortschatz' },
  listening: { en: 'Listening', de: 'Hören' },
  spelling: { en: 'Spelling', de: 'Rechtschreibung' },
};

export function ProgressCard({ payload, isDE }: { payload: ProgressPayload; isDE: boolean }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-baseline gap-2">
        <span className="text-h2 font-bold text-accent-700 dark:text-accent-300">
          {payload.level}
        </span>
        <span className="text-body font-semibold text-ink-900 dark:text-ink-100">
          {payload.rank}
        </span>
        <span className="ml-auto text-meta text-ink-500 dark:text-ink-400">
          {payload.totalXp} XP
        </span>
      </div>

      <div className="mt-1 flex gap-2 text-meta text-ink-600 dark:text-ink-300">
        <span>
          {payload.streak} {isDE ? (payload.streak === 1 ? 'Tag' : 'Tage') : payload.streak === 1 ? 'day' : 'days'}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {payload.dueCount} {isDE ? 'fällig' : 'due'}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {payload.skills.map((s) => {
          const label = SKILL_LABEL[s.category];
          const value = Math.round(s.accuracy);
          // 60%+ is healthy, below that needs attention. Neutral→accent ramp
          // so a weak skill reads as weak without introducing a second hue.
          const bar = value >= 60 ? 'bg-accent-600' : 'bg-warning-500';
          return (
            <li key={s.category}>
              <div className="flex items-center justify-between text-meta">
                <span className="text-ink-600 dark:text-ink-300">
                  {label ? (isDE ? label.de : label.en) : s.category}
                </span>
                <span className="text-ink-500 dark:text-ink-400">
                  {value}% · {s.total}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${value}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
