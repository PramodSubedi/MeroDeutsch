import { useMemo, useState } from 'react';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useLang } from '../hooks/useLang';
import { MasteryIndicator } from './MasteryIndicator';
import { theme } from '../config/theme';

/**
 * SRSReviewWidget — compact "due now" summary for the Dashboard.
 *
 * Reads the live Leitner 4-box review queue via `useReviewQueue()` and
 * surfaces only items whose `dueAt` has passed (or is missing), letting
 * users resolve/mark-correct inline without scrolling to the full queue.
 */
export function SRSReviewWidget() {
  const { queue, markCorrect, markResolved } = useReviewQueue();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  /** Items eligible for review right now (due or no dueAt). */
  const dueItems = useMemo(() => {
    const now = new Date().toISOString();
    return queue.filter((item) => !item.dueAt || item.dueAt <= now);
  }, [queue]);

  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? dueItems : dueItems.slice(0, 4);

  if (dueItems.length === 0) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        <span>✅ {isDE ? 'Keine fälligen Wiederholungen!' : 'No due reviews — all caught up!'}</span>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-amber-800 dark:text-amber-200">
          {isDE ? '🔔 Fällige Wiederholungen' : '🔔 Due Now'} — {dueItems.length}{' '}
          {isDE ? 'Eintrag' : 'item'}
          {dueItems.length === 1 ? '' : 's'}
        </div>
        <div className="flex gap-2">
          {dueItems.length > 4 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className={theme.button.secondary}>
              {showAll ? (isDE ? 'Weniger' : 'Less') : (isDE ? 'Alle anzeigen' : 'Show all')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              document.getElementById('review-queue-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={theme.button.icon}
          >
            {isDE ? 'Volle Warteschlange ↓' : 'Full queue ↓'}
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 dark:border-amber-800 dark:bg-slate-800"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  item.moduleType === 'rapid'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                    : item.moduleType === 'articles'
                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {item.moduleType}
              </span>
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.itemKey}
              </span>
              <MasteryIndicator boxLevel={item.boxLevel} />
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => markCorrect(item.id)}
                className={`${theme.button.primary} !px-2 !py-1 text-xs`}
              >
                ✓ {isDE ? 'Verstanden' : 'Got it'}
              </button>
              <button
                type="button"
                onClick={() => markResolved(item.id)}
                className={`${theme.button.secondary} !px-2 !py-1 text-xs`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}