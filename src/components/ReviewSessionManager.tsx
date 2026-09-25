import { useEffect, useMemo, useState } from 'react';
import { Filter, Target, Award } from 'lucide-react';
import { triggerConfetti } from '../utils/confetti';
import { useLang } from '../hooks/useLang';
import { useXp } from '../hooks/useXp';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { TabGroup, type Tab } from './TabGroup';
import type { WrongAnswerItem } from '../types';

/** Apply the review filter rules (all / focus box≤2 / mastery box≥3 / moduleType).
 *  Exported so the Dashboard list can filter with IDENTICAL rules to the
 *  session pool — one source of truth for filtering (Bug A fix). */
export function filterReviewQueue(items: WrongAnswerItem[], filter: string): WrongAnswerItem[] {
  return items.filter((item) => {
    const box = item.boxLevel ?? 1;
    if (filter === 'focus') return box <= 2;
    if (filter === 'mastery') return box >= 3;
    if (filter !== 'all') return item.moduleType === filter;
    return true;
  });
}

interface ReviewSessionManagerProps {
  queue: WrongAnswerItem[];
  dueQueue?: WrongAnswerItem[];
  onMarkCorrect: (id: string) => void;
  onCompleteSession?: () => void;
  /** When true, renders without its own card shell (for embedding inside a parent card). */
  embedded?: boolean;
  /** Cap the number of items drawn for a short, high-retention study sprint. */
  limit?: number;
  /** Automatically trigger study session upon mount (used for quick-starts). */
  autoStart?: boolean;
  /** Controlled active filter (lifted state — lets the parent list share it). */
  activeFilter?: FilterId;
  /** Called when the user picks a different filter tab. */
  onActiveFilterChange?: (filter: FilterId) => void;
  /** Label for the summary screen's primary button (e.g. DailySession: "Continue"). */
  completeLabel?: string;
  /** Fired when a correct answer graduates a box-4 item out of the queue
   *  (true 4-box Leitner retirement). Parents use it for the 🎓 payoff. */
  onGraduate?: () => void;
}

type FilterId = 'all' | 'focus' | 'mastery' | string;

interface SessionStats {
  reviewed: number;
  promoted: number;
  demoted: number;
  xp: number;
}

const EMPTY_STATS: SessionStats = { reviewed: 0, promoted: 0, demoted: 0, xp: 0 };

/** Fisher-Yates shuffle (in place, on a copy owned by the caller). */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Interleaved practice ordering (cognitive-science backed): round-robin
 * through module-type groups so similar items are NOT clustered back-to-back.
 * Mixing related-but-distinct skills within one session improves long-term
 * retention vs. blocked practice — especially for confusable material
 * (der/die/das genders, similar vocabulary).
 */
function interleaveByModule(items: WrongAnswerItem[]): WrongAnswerItem[] {
  const groups = new Map<string, WrongAnswerItem[]>();
  for (const item of items) {
    const list = groups.get(item.moduleType);
    if (list) list.push(item);
    else groups.set(item.moduleType, [item]);
  }
  // Randomize order WITHIN each module group first.
  const queues = Array.from(groups.values()).map((g) => shuffleInPlace([...g]));
  // Round-robin across groups → adjacent items differ in moduleType whenever possible.
  const out: WrongAnswerItem[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

export function ReviewSessionManager({
  queue,
  dueQueue,
  onMarkCorrect,
  onCompleteSession,
  embedded = false,
  limit,
  autoStart = false,
  activeFilter: activeFilterProp,
  onActiveFilterChange,
  completeLabel,
  onGraduate,
}: ReviewSessionManagerProps) {
  const { langMode } = useLang();
  const { reportAnswer } = useXp();
  // Quest accounting lives in THE grading path (single call site): every
  // correct recall in any embedded session (Dashboard, DailySession) counts
  // toward the SRS quest — previously only the Dashboard list's "Got it"
  // button reported, so session reviews never advanced the quest.
  const { reportReview } = useDailyQuests();
  const isDE = langMode === 'german';

  const [internalFilter, setInternalFilter] = useState<FilterId>('all');
  const activeFilter = activeFilterProp ?? internalFilter;
  const setActiveFilter = (next: FilterId) => {
    setInternalFilter(next);
    onActiveFilterChange?.(next);
  };
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionItems, setSessionItems] = useState<WrongAnswerItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats>(EMPTY_STATS);
  const [showSummary, setShowSummary] = useState(false);
  /** Spoiler guard: correct answer hidden until the user answers (Bug C). */
  const [revealed, setRevealed] = useState(false);

  const isDueNow = (item: WrongAnswerItem) => !item.dueAt || new Date(item.dueAt).getTime() <= Date.now();

  // Single source of truth for due items across the dashboard and session manager.
  const effectiveDueQueue = useMemo(() => {
    if (dueQueue) return dueQueue;
    return queue.filter(isDueNow);
  }, [dueQueue, queue]);

  // Unique module types present in the queue (for dynamic filter tabs).
  const moduleTypes = useMemo(() => {
    const seen = new Set<string>();
    queue.forEach((item) => seen.add(item.moduleType));
    return Array.from(seen);
  }, [queue]);

  // Filter items based on the selected tab (shared rule via filterReviewQueue).
  const filteredQueue = useMemo(
    () => filterReviewQueue(effectiveDueQueue, activeFilter),
    [effectiveDueQueue, activeFilter]
  );

  const handleAnswerResult = (isCorrect: boolean) => {
    const currentItem = sessionItems[currentIndex];
    if (!currentItem || revealed) return;

    // Reveal the correct answer BEFORE advancing so a wrong answer can be read.
    setRevealed(true);

    if (isCorrect) {
      // Promote in Leitner system + award real XP (10 per correctly recalled item).
      onMarkCorrect(currentItem.id);
      // Daily quest progress (SRS Scholar) — reported here so BOTH embedded
      // managers count, not just the Dashboard's inline list.
      reportReview(1);
      // 🎓 True 4-box graduation: a correct answer while already at box 4
      // retires the card — notify the parent so it can celebrate.
      if ((currentItem.boxLevel ?? 1) >= 4) onGraduate?.();
      setSessionStats((prev) => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        promoted: prev.promoted + 1,
        xp: prev.xp + 10,
      }));
      reportAnswer({ correct: true, module: currentItem.moduleType || 'review', amount: 10 });
    } else {
      // Keep item in queue for future review (no promotion, no XP).
      setSessionStats((prev) => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        demoted: prev.demoted + 1,
        xp: prev.xp + 0,
      }));
      reportAnswer({ correct: false, module: currentItem.moduleType || 'review' });
    }

    // Brief pause so the revealed answer is readable (longer after a miss),
    // then advance or finish the session.
    const pauseMs = isCorrect ? 700 : 1800;
    setTimeout(() => {
      if (currentIndex + 1 < sessionItems.length) {
        setCurrentIndex(currentIndex + 1);
        setRevealed(false);
      } else {
        // Session finished! Trigger confetti.
        triggerConfetti();
        setShowSummary(true);
        setSessionActive(false);
      }
    }, pauseMs);
  };

  const startSession = () => {
    if (filteredQueue.length === 0) return;
    // Stratify-shuffle by moduleType BEFORE slicing: round-robin across groups
    // preserves due-date priority within each module while guaranteeing a capped
    // session samples across types (improves retention vs. blocked practice).
    const shuffled = interleaveByModule(filteredQueue);
    // Cap the pool if limit is set (Phase B short daily refresh/3-minute sprint).
    const pool = limit && limit > 0 ? shuffled.slice(0, limit) : shuffled;
    setSessionItems(pool);
    setCurrentIndex(0);
    setSessionStats(EMPTY_STATS);
    setSessionActive(true);
    setShowSummary(false);
    setRevealed(false);
  };

  // Phase B: Automatically start study sprint on load if autoStart is true.
  useEffect(() => {
    if (autoStart && filteredQueue.length > 0 && !sessionActive && !showSummary) {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, filteredQueue.length]);

  // ── Summary view ──────────────────────────────────────────────
  if (showSummary) {
    return (
      <div className="border border-ink-200 bg-white dark:bg-ink-900 dark:border-ink-800 rounded-lg p-6 shadow-sm text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 bg-accent-50 dark:bg-accent-950/50 text-accent-600 rounded-full flex items-center justify-center mx-auto text-2xl">
          🎉
        </div>
        <h2 className="text-xl font-bold text-ink-800 dark:text-ink-100">
          {isDE ? 'Review-Sitzung abgeschlossen!' : 'Review Session Complete!'}
        </h2>
        <p className="text-body text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Großartige Arbeit, dein Gedächtnis bleibt heute scharf.'
            : 'Great job keeping your memory retention sharp today.'}
        </p>

        <div className="grid grid-cols-2 gap-3 py-3 text-left">
          <div className="bg-ink-50 dark:bg-ink-800/60 p-3 rounded-md">
            <span className="text-meta text-ink-500 block">
              {isDE ? 'Geprüfte Einträge' : 'Items Reviewed'}
            </span>
            <span className="text-lg font-bold text-ink-700 dark:text-ink-200">
              {sessionStats.reviewed}
            </span>
          </div>
          <div className="bg-ink-50 dark:bg-ink-800/60 p-3 rounded-md">
            <span className="text-meta text-ink-500 block">XP</span>
            <span className="text-lg font-bold text-success-600">+{sessionStats.xp} XP</span>
          </div>
          <div className="bg-ink-50 dark:bg-ink-800/60 p-3 rounded-md">
            <span className="text-meta text-ink-500 block">
              {isDE ? 'Befördert (Leitner)' : 'Promoted (Leitner)'}
            </span>
            <span className="text-lg font-bold text-accent-600">{sessionStats.promoted}</span>
          </div>
          <div className="bg-ink-50 dark:bg-ink-800/60 p-3 rounded-md">
            <span className="text-meta text-ink-500 block">
              {isDE ? 'Braucht Fokus' : 'Needs Focus'}
            </span>
            <span className="text-lg font-bold text-warning-600">{sessionStats.demoted}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowSummary(false);
            onCompleteSession?.();
          }}
          className="w-full py-3 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-md transition-all shadow-sm shadow-accent-200"
        >
          {completeLabel ?? (isDE ? 'Zurück zum Dashboard' : 'Return to Dashboard')}
        </button>
      </div>
    );
  }

  // ── Active session view ───────────────────────────────────────
  if (sessionActive && sessionItems.length > 0) {
    const currentItem = sessionItems[currentIndex];
    return (
      <div className="border border-ink-200 bg-white dark:bg-ink-900 dark:border-ink-800 rounded-lg p-6 shadow-sm max-w-xl mx-auto space-y-6">
        <div className="flex justify-between items-center text-meta text-ink-500 font-medium">
          <span>
            {isDE ? 'Fortschritt' : 'Progress'}: {currentIndex + 1} / {sessionItems.length}
          </span>
          <span className="px-2.5 py-1 bg-accent-50 dark:bg-accent-950/50 text-accent-600 rounded-full">
            {isDE ? 'Box-Level' : 'Box Level'} {currentItem.boxLevel ?? 1}
          </span>
        </div>

        <div className="py-8 text-center space-y-2">
          <h3 className="text-3xl font-extrabold text-ink-800 dark:text-ink-100">
            {currentItem.itemKey}
          </h3>
          <p className="text-body text-ink-500 dark:text-ink-400">
            {isDE ? 'Modul' : 'Module'}:{' '}
            <span className="capitalize font-medium">{currentItem.moduleType}</span>
          </p>
          {/* Spoiler guard: hidden until the user answers (Bug C). */}
          {revealed && currentItem.correctAnswer && (
            <p className="text-body text-ink-500 dark:text-ink-400">
              {isDE ? 'Richtige Antwort' : 'Correct answer'}:{' '}
              <span className="font-medium text-success-600">{currentItem.correctAnswer}</span>
            </p>
          )}
          {!revealed && (
            <p className="text-meta italic text-ink-500 dark:text-ink-500">
              {isDE ? 'Antwort anzeigen? Entscheide zuerst!' : 'Recall it first — then reveal!'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button
            type="button"
            onClick={() => handleAnswerResult(false)}
            className="py-3 px-4 border border-danger-200 bg-danger-50/50 hover:bg-danger-100/50 text-danger-700 font-medium rounded-md transition-all"
          >
            {isDE ? 'Noch lernen 🔁' : 'Still Learning 🔁'}
          </button>
          <button
            type="button"
            onClick={() => handleAnswerResult(true)}
            className="py-3 px-4 bg-success-600 hover:bg-success-700 text-white font-medium rounded-md transition-all shadow-sm"
          >
            {isDE ? 'Verstanden! ✅' : 'Got It! ✅'}
          </button>
        </div>
        <p className="text-center text-meta text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Verstanden = befördert, Noch lernen = bleibt in der Warteschlange.'
            : 'Got it promotes the item; still learning keeps it in the queue.'}
        </p>
      </div>
    );
  }

  // ── Pre-session filter view ───────────────────────────────────
  // Badges always show the count (including 0) for consistent review-queue feedback.
  const filterTabs: Tab<FilterId>[] = [
    { id: 'all', label: isDE ? 'Alle fällig' : 'All Due', icon: Filter, badge: effectiveDueQueue.length },
    { id: 'focus', label: isDE ? 'Box 1-2 (Fokus)' : 'Box 1-2 (Focus)', icon: Target, badge: effectiveDueQueue.filter(item => (item.boxLevel ?? 1) <= 2).length },
    { id: 'mastery', label: isDE ? 'Box 3-4 (Meisterschaft)' : 'Box 3-4 (Mastery)', icon: Award, badge: effectiveDueQueue.filter(item => (item.boxLevel ?? 1) >= 3).length },
    // Module badges count DUE items — consistent with the All/Focus/Mastery
    // badges and the actual Start Session pool (Bug A consistency fix).
    ...moduleTypes.map((moduleType) => ({
      id: moduleType as FilterId,
      label: moduleType.charAt(0).toUpperCase() + moduleType.slice(1),
      badge: effectiveDueQueue.filter(item => item.moduleType === moduleType).length,
    })),
  ];

  return (
    <div className={embedded ? 'space-y-4' : 'border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900 rounded-lg p-6 space-y-4'}>
      {embedded && <div className="h-px bg-ink-100 dark:bg-ink-800" aria-hidden="true" />}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-body font-bold text-ink-800 dark:text-ink-100">
            {isDE ? 'SRS Review-Warteschlange' : 'SRS Review Queue'}
          </h3>
          <p className="text-meta text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Wähle eine Filterkategorie, um deine gezielte Lernsitzung zu starten.'
              : 'Select a filter category to begin your targeted study session.'}
          </p>
        </div>
        <button
          type="button"
          onClick={startSession}
          disabled={filteredQueue.length === 0}
          className="px-5 py-2.5 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white text-body font-semibold rounded-md transition-all shadow-sm"
        >
          {isDE ? 'Sitzung starten' : 'Start Session'} ({filteredQueue.length})
        </button>
      </div>

      <TabGroup
        tabs={filterTabs}
        activeTab={activeFilter}
        onTabChange={setActiveFilter}
        variant="compact"
      />
    </div>
  );
}
