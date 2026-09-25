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
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-body font-semibold text-success-800 dark:border-success-800 dark:bg-success-950/40 dark:text-success-200">
        <span>✅ {isDE ? 'Keine fälligen Wiederholungen!' : 'No due reviews — all caught up!'}</span>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-950/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-body font-bold text-warning-800 dark:text-warning-200">
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
            className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-white px-2.5 py-1 text-meta font-semibold text-ink-700 dark:border-warning-700 dark:bg-ink-800 dark:text-ink-200"
          >
            <span className="font-bold text-warning-600">{item.moduleType}</span>
            <span>{item.itemKey}</span>
            <MasteryIndicator boxLevel={item.boxLevel} />
          </span>
        ))}
      </div>
    </div>
  );
}