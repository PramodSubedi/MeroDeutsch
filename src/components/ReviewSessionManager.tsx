import { useEffect, useMemo, useState } from 'react';
import { Filter, Target, Award } from 'lucide-react';
import { triggerConfetti } from '../utils/confetti';
import { useLang } from '../hooks/useLang';
import { useXp } from '../hooks/useXp';
import { TabGroup, type Tab } from './TabGroup';
import type { WrongAnswerItem } from '../types';

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
}

type FilterId = 'all' | 'focus' | 'mastery' | string;

interface SessionStats {
  reviewed: number;
  promoted: number;
  demoted: number;
  xp: number;
}

const EMPTY_STATS: SessionStats = { reviewed: 0, promoted: 0, demoted: 0, xp: 0 };

export function ReviewSessionManager({
  queue,
  dueQueue,
  onMarkCorrect,
  onCompleteSession,
  embedded = false,
  limit,
  autoStart = false,
}: ReviewSessionManagerProps) {
  const { langMode } = useLang();
  const { reportAnswer } = useXp();
  const isDE = langMode === 'german';

  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionItems, setSessionItems] = useState<WrongAnswerItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats>(EMPTY_STATS);
  const [showSummary, setShowSummary] = useState(false);

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

  // Filter items based on the selected tab.
  const filteredQueue = useMemo(() => {
    return effectiveDueQueue.filter((item) => {
      const box = item.boxLevel ?? 1;
      if (activeFilter === 'focus') return box <= 2;
      if (activeFilter === 'mastery') return box >= 3;
      if (activeFilter !== 'all') return item.moduleType === activeFilter;
      return true;
    });
  }, [effectiveDueQueue, activeFilter]);

  const handleAnswerResult = (isCorrect: boolean) => {
    const currentItem = sessionItems[currentIndex];
    if (!currentItem) return;

    if (isCorrect) {
      // Promote in Leitner system + award real XP (10 per correctly recalled item).
      onMarkCorrect(currentItem.id);
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

    if (currentIndex + 1 < sessionItems.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Session finished! Trigger confetti.
      triggerConfetti();
      setShowSummary(true);
      setSessionActive(false);
    }
  };

  const startSession = () => {
    if (filteredQueue.length === 0) return;
    // Cap the pool if limit is set (Phase B short daily refresh/3-minute sprint).
    const pool = limit && limit > 0 ? filteredQueue.slice(0, limit) : filteredQueue;
    setSessionItems(pool);
    setCurrentIndex(0);
    setSessionStats(EMPTY_STATS);
    setSessionActive(true);
    setShowSummary(false);
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl">
          🎉
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          {isDE ? 'Review-Sitzung abgeschlossen!' : 'Review Session Complete!'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Großartige Arbeit, dein Gedächtnis bleibt heute scharf.'
            : 'Great job keeping your memory retention sharp today.'}
        </p>

        <div className="grid grid-cols-2 gap-3 py-3 text-left">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-400 block">
              {isDE ? 'Geprüfte Einträge' : 'Items Reviewed'}
            </span>
            <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
              {sessionStats.reviewed}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-400 block">XP</span>
            <span className="text-lg font-bold text-emerald-600">+{sessionStats.xp} XP</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-400 block">
              {isDE ? 'Befördert (Leitner)' : 'Promoted (Leitner)'}
            </span>
            <span className="text-lg font-bold text-blue-600">{sessionStats.promoted}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <span className="text-xs text-slate-400 block">
              {isDE ? 'Braucht Fokus' : 'Needs Focus'}
            </span>
            <span className="text-lg font-bold text-amber-600">{sessionStats.demoted}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowSummary(false);
            onCompleteSession?.();
          }}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm shadow-blue-200"
        >
          {isDE ? 'Zurück zum Dashboard' : 'Return to Dashboard'}
        </button>
      </div>
    );
  }

  // ── Active session view ───────────────────────────────────────
  if (sessionActive && sessionItems.length > 0) {
    const currentItem = sessionItems[currentIndex];
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm max-w-xl mx-auto space-y-6">
        <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
          <span>
            {isDE ? 'Fortschritt' : 'Progress'}: {currentIndex + 1} / {sessionItems.length}
          </span>
          <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-full">
            {isDE ? 'Box-Level' : 'Box Level'} {currentItem.boxLevel ?? 1}
          </span>
        </div>

        <div className="py-8 text-center space-y-2">
          <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            {currentItem.itemKey}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isDE ? 'Modul' : 'Module'}:{' '}
            <span className="capitalize font-medium">{currentItem.moduleType}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isDE ? 'Richtige Antwort' : 'Correct answer'}:{' '}
            <span className="font-medium text-emerald-600">{currentItem.correctAnswer}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button
            type="button"
            onClick={() => handleAnswerResult(false)}
            className="py-3 px-4 border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 text-rose-700 font-medium rounded-xl transition-all"
          >
            {isDE ? 'Noch lernen 🔁' : 'Still Learning 🔁'}
          </button>
          <button
            type="button"
            onClick={() => handleAnswerResult(true)}
            className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all shadow-sm"
          >
            {isDE ? 'Verstanden! ✅' : 'Got It! ✅'}
          </button>
        </div>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
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
    ...moduleTypes.map((moduleType) => ({
      id: moduleType as FilterId,
      label: moduleType.charAt(0).toUpperCase() + moduleType.slice(1),
      badge: queue.filter(item => item.moduleType === moduleType).length,
    })),
  ];

  return (
    <div className={embedded ? 'space-y-4' : 'bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm space-y-4'}>
      {embedded && <div className="h-px bg-slate-100 dark:bg-slate-800" aria-hidden="true" />}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {isDE ? 'SRS Review-Warteschlange' : 'SRS Review Queue'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Wähle eine Filterkategorie, um deine gezielte Lernsitzung zu starten.'
              : 'Select a filter category to begin your targeted study session.'}
          </p>
        </div>
        <button
          type="button"
          onClick={startSession}
          disabled={filteredQueue.length === 0}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
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
