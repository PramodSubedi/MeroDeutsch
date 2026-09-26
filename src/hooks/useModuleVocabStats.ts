/**
 * src/hooks/useModuleVocabStats.ts
 *
 * Per-module AND per-category vocabulary learning signal for the A1 spine.
 *
 * WHY THIS EXISTS
 * ---------------
 * A module's checkpoint samples 12 items, but the module's vocabulary pool is
 * far larger (`getVocabularyByCategories(..., 60)`). So passing a gate is weak
 * evidence the module was actually learned, and /learn had no way to show the
 * difference. This hook supplies that signal so a module card can say
 * "24 words · 9 new · 3 due · 12 mastered" instead of only Done/Locked.
 *
 * It is also the PRECONDITION for self-guided mode: in guided mode the app
 * always answers "what next", so a weak signal is survivable. In self mode
 * every module is open and "what next" is the entire problem — a list of 15
 * unlocked cards with no state is worse than a gate.
 *
 * DESIGN: CATEGORY-LEVEL, NOT MODULE-LEVEL
 * ----------------------------------------
 * Several modules declare overlapping categories (`food` is in M10 and M11;
 * `travel` in M12), so per-module fetching would re-fetch the same cards. This
 * hook resolves every tracked category ONCE, buckets cards by tag, and lets each
 * module sum the buckets it declares. It also yields the per-category
 * "Review N due" breakdown for free.
 *
 * DATA SOURCES (all read-only; NO new storage)
 * ---------------------------------------------
 *   curriculumService.getVocabularyByCategories  → the cards in each category
 *   useVocabularyStatus().statsByWord             → new/learning/known/mastered
 *   useReviewQueue().dueQueue                     → due-for-review counts
 *
 * Both joins key on `VocabCard.id`. `getVocabularyByCategories` returns
 * `VocabEntry`, whose `id` is assigned from `VocabCard.id` in
 * `cardToLegacyEntry`, and `VocabStatusRow.wordId` / `UserProgress.cardId` both
 * reference `VocabCard.id` — so the three sets are directly comparable.
 *
 * ATTRIBUTION OF DUE ITEMS
 * -----------------------
 * `useReviewQueue.rowToItem` sets `itemKey = row.cardId`, so for SRS rows the
 * key IS the card id and attribution is a map lookup. Other surfaces write other
 * key shapes, so `resolveCardId` tries a small ladder of prefixes/suffixes and
 * returns null when nothing matches. An unattributable item (e.g. an `articles`
 * or `alphabet` miss) is NOT counted anywhere rather than guessed into a module.
 */
import { useEffect, useMemo, useState } from 'react';
import { curriculumService } from '../services';
import { useVocabularyStatus } from './useVocabularyStatus';
import { useReviewQueue } from './useReviewQueue';
import { A1_UNITS } from '../data/a1Path';
import type { VocabEntry, VocabStatusValue } from '../types';

/**
 * Upper bound on cards pulled from `getVocabularyByCategories`.
 *
 * A SAFETY BOUND, not a tuning knob. The loader's first pass stops adding once
 * `out.size` reaches this limit, so a limit below the number of matching cards
 * does not "fetch less" — it silently DROPS cards, and which ones get dropped
 * depends on row order. Measured against the fully-offline cache the tracked
 * categories match 631 of ~2240 cards, so the previous 500 sat INSIDE that set
 * and could truncate on a first-ever offline run.
 *
 * Keeping it well above the whole vocabulary table means pass 1 always completes.
 * Pass 3 ("A1 fill") then also runs, but the cards it adds carry other tags, so
 * they land in no category bucket and cannot affect any module's counts —
 * bucketing happens in `useModuleVocabStats`, not in the loader.
 *
 * HONEST NOTE ON THE NUMBERS YOU SEE
 * -----------------------------------
 * The per-module totals are whatever the live `vocabulary` table actually holds
 * for those tags — they are NOT guaranteed to equal a count taken from the
 * offline Dexie seed, because the Supabase path is authoritative when reachable
 * and its tag distribution differs. Observed totals also drift by a word or two
 * between loads, which is the source query's ordering, not this hook. Both are
 * properties of the underlying data; the aggregation here is deterministic given
 * the card set it is handed.
 */
const CARD_FETCH_LIMIT = 2000;

/** One category's learning signal. */
export interface CategoryStats {
  category: string;
  total: number;
  isNew: number;
  learning: number;
  known: number;
  mastered: number;
  /** Review-queue items due now that resolve to a card in this category. */
  due: number;
}

/** One module's learning signal, plus its per-category breakdown. */
export interface ModuleVocabStats {
  total: number;
  isNew: number;
  learning: number;
  known: number;
  mastered: number;
  due: number;
  /** Only categories that actually resolved to at least one card. */
  categories: CategoryStats[];
  loading: boolean;
}

/**
 * Every distinct category declared by any module, computed once from the
 * curriculum config so adding a module never needs a second edit here.
 */
const TRACKED_CATEGORIES: readonly string[] = Array.from(
  new Set(A1_UNITS.flatMap((u) => u.vocabCategories ?? [])),
);

/** Exposed for diagnostics/tests. */
export const TRACKED_VOCAB_CATEGORIES = TRACKED_CATEGORIES;

const EMPTY_COUNTS = {
  total: 0,
  isNew: 0,
  learning: 0,
  known: 0,
  mastered: 0,
  due: 0,
};

/**
 * Resolve a review-queue `itemKey` to a vocab card id, or null when the item is
 * not vocab-attributable.
 *
 * Tried in order, cheapest first:
 *  1. exact card id                      (SRS rows: `itemKey = cardId`)
 *  2. before a `|` suffix                (`${card.id}|${partOfSpeech}`)
 *  3. after a `vocab:` prefix            (checkpoint vocab questions)
 *
 * `grammar:<unitIndex>:<prompt>` items deliberately fall through to null: they
 * are grammar, not vocabulary, so counting them in a word count would be a lie.
 */
function resolveCardId(
  itemKey: string,
  byId: ReadonlyMap<string, VocabEntry>,
): string | null {
  if (byId.has(itemKey)) return itemKey;

  const pipe = itemKey.indexOf('|');
  if (pipe > 0) {
    const head = itemKey.slice(0, pipe);
    if (byId.has(head)) return head;
  }

  if (itemKey.startsWith('vocab:')) {
    const rest = itemKey.slice('vocab:'.length);
    if (byId.has(rest)) return rest;
  }

  return null;
}

/**
 * Learning signal for every A1 module, keyed by unit index.
 *
 * Loads all tracked categories in ONE request, then derives per-category and
 * per-module numbers from the same card set. `statsByWord` and `dueQueue` are
 * both reactive (Dexie `useLiveQuery`), so the numbers update live as the
 * learner practises with no extra wiring on the caller's side.
 */
export function useModuleVocabStats(): Map<number, ModuleVocabStats> {
  const { statsByWord } = useVocabularyStatus();
  const { dueQueue } = useReviewQueue();
  const [cards, setCards] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getVocabularyByCategories([...TRACKED_CATEGORIES], undefined, CARD_FETCH_LIMIT)
      .then((entries) => {
        if (!cancelled) setCards(entries ?? []);
      })
      .catch(() => {
        // Offline / empty cache: leave `cards` empty so every card renders a
        // zeroed, still-meaningful bar rather than an error or a blank space.
        if (!cancelled) setCards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const byId = new Map(cards.map((c) => [c.id, c]));

    // Bucket card ids by the tracked tags each card actually carries.
    //
    // A card may legitimately sit in several buckets (`food` + `taste`); the
    // per-category numbers are independent views of that one card, which is
    // correct. The per-MODULE total de-duplicates below, so a word tagged with
    // two of a module's categories is still counted once there.
    const idsByCategory = new Map<string, string[]>();
    for (const cat of TRACKED_CATEGORIES) idsByCategory.set(cat, []);
    for (const card of cards) {
      for (const tag of card.tags ?? []) {
        const bucket = idsByCategory.get(tag);
        if (bucket) bucket.push(card.id);
      }
    }

    const dueByCardId = new Map<string, number>();
    for (const item of dueQueue ?? []) {
      const cardId = resolveCardId(item.itemKey, byId);
      if (cardId) dueByCardId.set(cardId, (dueByCardId.get(cardId) ?? 0) + 1);
    }

    const statusOf = (cardId: string): VocabStatusValue =>
      statsByWord[cardId]?.status ?? 'new';

    /** Build counts from an iterable of card ids, de-duplicated. */
    const build = (ids: Iterable<string>) => {
      const acc = { ...EMPTY_COUNTS };
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        acc.total += 1;
        switch (statusOf(id)) {
          case 'mastered': acc.mastered += 1; break;
          case 'known': acc.known += 1; break;
          case 'learning': acc.learning += 1; break;
          default: acc.isNew += 1; break;
        }
        acc.due += dueByCardId.get(id) ?? 0;
      }
      return acc;
    };

    const out = new Map<number, ModuleVocabStats>();
    for (const unit of A1_UNITS) {
      const categories: CategoryStats[] = [];
      const moduleIds: string[] = [];

      for (const cat of unit.vocabCategories ?? []) {
        const ids = idsByCategory.get(cat);
        if (!ids || ids.length === 0) continue;
        categories.push({ category: cat, ...build(ids) });
        moduleIds.push(...ids);
      }

      // `build` de-duplicates, so a card tagged with two of THIS module's
      // categories is counted once in the module total even though it appears in
      // both per-topic breakdowns.
      const total = build(moduleIds);
      out.set(unit.index, { ...total, categories, loading });
    }

    return out;
  }, [cards, statsByWord, dueQueue, loading]);
}

