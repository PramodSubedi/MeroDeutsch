/**
 * src/components/dashboard/QueueBreakdown.tsx
 *
 * WHERE THE REVIEW DEBT ACTUALLY SITS.
 *
 * THE PROBLEM WITH "44 REVIEWS DUE"
 * --------------------------------
 * Forty-four is a number with no shape. It does not say whether the learner
 * has forty-four items they nearly know (box 4, one good session from
 * graduating) or forty-four they have never once got right (box 1, still not
 * learned). Those two learners need opposite things, and the dashboard gave
 * them the same information.
 *
 * The data to tell them apart has always been on screen and unused: every queue
 * item carries `boxLevel`, the Leitner box it currently occupies. Box 1 is a
 * new or repeatedly-failed item; box 5 has survived four promotions. The
 * distribution between them IS the diagnosis.
 *
 * WHY A SEGMENTED BAR AND NOT A PIE
 * ---------------------------------
 * The boxes are ORDERED (1..5), so the reader's eye should be able to follow
 * that order. A pie destroys it: five wedges must be read by hunting for the
 * legend, and adjacent similar sizes are impossible to compare. A single
 * horizontal bar preserves the left-to-right 1..5 ordering, reads as a
 * composition of one whole, and needs no interaction at all.
 *
 * COLOUR CARRIES THE MEANING
 * -------------------------
 * The bar is tinted along the project's own danger -> warning -> success ramp,
 * which is the site's fixed mapping (red needs work, amber attention, green
 * mastered). It is not decorative: a wide red run on the left is immediately
 * legible as "most of this is unlearned" before reading a single number.
 *
 * IT MATCHES THE FILTERS ABOVE IT
 * -------------------------------
 * `ReviewSessionManager`'s tabs split the queue at box <= 2 ("Focus") and
 * box >= 3 ("Mastery"). This chart splits at the same line, so the learner
 * sees the same two groups in the chart and in the filter tabs.
 */
import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import type { WrongAnswerItem } from '../../types';

const BOXES = [1, 2, 3, 4, 5] as const;

/** danger -> warning -> success, matching the sitewide colour-to-meaning map. */
const BOX_CLASS: Record<number, string> = {
  1: 'bg-danger-500 dark:bg-danger-500',
  2: 'bg-warning-500 dark:bg-warning-500',
  3: 'bg-accent-500 dark:bg-accent-400',
  4: 'bg-success-400 dark:bg-success-500',
  5: 'bg-success-600 dark:bg-success-300',
};

export function QueueBreakdown({ queue }: { queue: WrongAnswerItem[] }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const { counts, total, focus, mastery } = useMemo(() => {
    const acc: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of queue) {
      // `filterReviewQueue` treats a missing box as 1, so this must too —
      // otherwise an unboxed item would vanish from the bar entirely.
      const box = item.boxLevel ?? 1;
      if (box >= 1 && box <= 5) acc[box] += 1;
    }
    return {
      counts: acc,
      total: queue.length,
      // Same threshold as the session filter tabs: <= 2 focus, >= 3 mastery.
      focus: acc[1] + acc[2],
      mastery: acc[3] + acc[4] + acc[5],
    };
  }, [queue]);

  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  return (
    <section
      aria-labelledby="queue-breakdown-heading"
      className="overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-150 px-4 py-3 sm:px-5 dark:border-ink-850">
        <h2
          id="queue-breakdown-heading"
          className="flex items-center gap-2 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400"
        >
          <Layers className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
          {isDE ? 'Wiederholungsstapel' : 'Review debt'}
        </h2>
        {total > 0 && (
          /* Labelled per-figure, never as a bare "25 / 10". A slash between two
             counts reads as a RATIO — and 25/10 looks like an impossible or
             inverted score, when it actually means "25 new, 10 solid". The
             words have to sit under their own numbers, not after both. */
          <dl className="flex items-baseline gap-1.5 text-meta">
            <div className="text-right">
              <dt className="sr-only">{isDE ? 'Neu oder wiederholt gescheitert' : 'New or repeatedly missed'}</dt>
              <dd className="font-mono font-semibold tabular-nums text-ink-600 dark:text-ink-300">{focus}</dd>
              <dd className="text-micro font-normal text-ink-400 dark:text-ink-500">
                {isDE ? 'neu' : 'new'}
              </dd>
            </div>
            <span aria-hidden="true" className="text-ink-300 dark:text-ink-600">·</span>
            <div>
              <dt className="sr-only">{isDE ? 'Gefestigt' : 'Solid'}</dt>
              <dd className="font-mono font-semibold tabular-nums text-ink-600 dark:text-ink-300">{mastery}</dd>
              <dd className="text-micro font-normal text-ink-400 dark:text-ink-500">
                {isDE ? 'gefestigt' : 'solid'}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="px-4 py-4 sm:px-5">
        {total === 0 ? (
          <p className="rounded-md border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-body text-ink-500 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-400">
            {isDE
              ? 'Deine Wiederholungswarteschlange ist leer. Nichts zu verteilen.'
              : 'Your review queue is empty. Nothing to break down.'}
          </p>
        ) : (
          <>
            {/* One bar, five ordered segments. The accessible name states the
                whole composition, because five adjacent widths are unreadable
                as a screen-reader figure-by-figure. */}
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
              role="img"
              aria-label={
                isDE
                  ? `Verteilung der Wiederholungen: ${BOXES.map(
                      (b) => `Kasten ${b}: ${counts[b]}`,
                    ).join(', ')}`
                  : `Review distribution: ${BOXES.map(
                      (b) => `box ${b}: ${counts[b]}`,
                    ).join(', ')}`
              }
            >
              {BOXES.map((box) =>
                counts[box] > 0 ? (
                  <div
                    key={box}
                    className={`${BOX_CLASS[box]} first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${pct(counts[box])}%` }}
                  />
                ) : null,
              )}
            </div>

            {/* The per-box figures. A real list rather than a colour key,
                because "box 2: 31" is the number a learner acts on and a
                swatch alone would hide it. */}
            <dl className="mt-4 grid grid-cols-5 gap-1.5">
              {BOXES.map((box) => (
                <div key={box} className="min-w-0 text-center">
                  <dt className="text-micro font-semibold uppercase tracking-[0.1em] text-ink-500 dark:text-ink-400">
                    {isDE ? `K${box}` : `B${box}`}
                  </dt>
                  <dd
                    className={`mt-1 font-mono text-body font-bold tabular-nums ${
                      counts[box] === 0
                        ? 'text-ink-300 dark:text-ink-600'
                        : 'text-ink-900 dark:text-white'
                    }`}
                  >
                    {counts[box]}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">
              {isDE
                ? 'K1–K2 sind neu oder wiederholt gescheitert · K3–K5 sind gefestigt.'
                : 'B1–B2 are new or repeatedly missed · B3–B5 are solid.'}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
