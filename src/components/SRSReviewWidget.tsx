import { useReviewQueue } from '../hooks/useReviewQueue';
import { useLang } from '../hooks/useLang';
import { MasteryIndicator } from './MasteryIndicator';
import { theme } from '../config/theme';
import { ANCHORS, scrollToAnchor } from '../lib/anchors';

/**
 * SRSReviewWidget — compact "due now" summary for the Dashboard.
 *
 * Reads the live Leitner 4-box review queue via `useReviewQueue()` and
 * surfaces only items whose `dueAt` has passed (or is missing), letting
 * users resolve/mark-correct inline without scrolling to the full queue.
 */
export function SRSReviewWidget() {
  const { dueQueue } = useReviewQueue();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  if (dueQueue.length === 0) {
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
          {isDE ? '🔔 Fällige Wiederholungen' : '🔔 Due Now'} — {dueQueue.length}{' '}
          {isDE ? 'Eintrag' : 'item'}
          {dueQueue.length === 1 ? '' : 's'}
        </div>
        <button
          type="button"
          onClick={() => {
            scrollToAnchor(ANCHORS.reviewQueue);
          }}
          className={theme.button.icon}
        >
          {isDE ? 'Warteschlange ↓' : 'Queue ↓'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {dueQueue.slice(0, 4).map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-amber-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span className="font-bold text-amber-600">{item.moduleType}</span>
            <span>{item.itemKey}</span>
            <MasteryIndicator boxLevel={item.boxLevel} />
          </span>
        ))}
      </div>
    </div>
  );
}