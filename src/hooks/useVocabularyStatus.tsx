/**
 * src/hooks/useVocabularyStatus.tsx
 *
 * Per-word learning status store for the Glossary / Vocab Trainer surfaces.
 *
 * This is a COARSE mastery checklist (new → learning → known → mastered)
 * keyed by `VocabCard.id`, deliberately SEPARATE from the Leitner box model
 * in `userProgress` (SRS). It powers:
 *   - "status" badges on glossary rows,
 *   - Fresh / Due / Mixed pool modes in the Vocab Trainer,
 *   - One-tap "mark as known" on a card.
 *
 * Storage architecture:
 *   PRIMARY : Dexie (IndexedDB) table `vocabStats`, keyed by userId
 *             ('guest' included) — offline-first, every write lands here first.
 *   CLOUD   : None today. There is no `vocab_stats` Supabase table, so this
 *             store is intentionally DEVICE-LOCAL (unlike SRS/XP/A1Path which
 *             mirror to Postgres). See the project report for the honest scope.
 *   HYDRATION : Direct Dexie `useLiveQuery` — reactive, no manual sync.
 *
 * Status derivation (retained, coarse):
 *   - 'learning' -> 1+ interaction but not yet 'known'
 *   - 'known'    -> >= 2 correct
 *   - 'mastered' -> >= 5 correct OR explicit user mark
 *   Manual `setStatus` (e.g. "mark as known") overrides until the next
 *   recorded attempt re-derives it.
 *
 * The provider is mounted once in main.tsx (inside AuthProvider so it can read
 * the real userId).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAuth } from './useAuth';
import type { VocabStatusRow, VocabStatusValue } from '../types';

/** Coarse thresholds for the automatic status derivation. */
const KNOWN_CORRECT = 2;
const MASTERED_CORRECT = 5;

function deriveStatus(row: Pick<VocabStatusRow, 'correctCount' | 'wrongCount' | 'repetitionCount'>): VocabStatusValue {
  if (row.correctCount >= MASTERED_CORRECT) return 'mastered';
  if (row.correctCount >= KNOWN_CORRECT && row.correctCount > row.wrongCount) return 'known';
  if (row.repetitionCount > 0 || row.wrongCount > 0) return 'learning';
  return 'new';
}

/** How easy each correct/incorrect answer nudges the Ease Factor. */
const EASE_CORRECT_DELTA = 0.08;
const EASE_WRONG_DELTA = -0.2;
const EASE_MIN = 1.0;
const EASE_MAX = 3.0;

export interface VocabStatusContextValue {
  /** Current user id backing the store ('guest' when signed out). */
  userId: string;
  /** Map of wordId -> status row for the CURRENT user (reactive via Dexie). */
  statsByWord: Readonly<Record<string, VocabStatusRow>>;
  /** Lookup a single word's status (or undefined when never touched). */
  getStatus: (wordId: string) => VocabStatusRow | undefined;
  /**
   * Record a quiz/flashcard attempt for a word. Re-derives the status and
   * adjusts the Ease Factor. Pass `correct`=true/false.
   */
  recordAttempt: (wordId: string, correct: boolean) => void;
  /**
   * Explicitly mark a word's status (e.g. "mark as known"). The next
   * recorded attempt re-derives it from counts.
   */
  setStatus: (wordId: string, status: VocabStatusValue) => void;
  /** Number of distinct known/mastered words for the current user. */
  knownCount: number;
  /** Number of words still marked 'new' (never practiced). */
  newCount: number;
}

const VocabStatusContext = createContext<VocabStatusContextValue | undefined>(undefined);

interface VocabStatusProviderProps {
  children: ReactNode;
}

export function VocabularyStatusProvider({ children }: VocabStatusProviderProps) {
  const { user } = useAuth();
  const userId = user?.userId ?? 'guest';

  // Reactive rows for the current user. Writes to Dexie immediately repaint
  // the live query, so glossary badges / trainer pools stay fresh with no
  // manual refresh call.
  const rows =
    useLiveQuery(
      () => (db ? db.vocabStats.where('userId').equals(userId).toArray() : Promise.resolve([] as VocabStatusRow[])),
      [userId]
    ) ?? [];

  const statsByWord = useMemo(() => {
    const map: Record<string, VocabStatusRow> = {};
    for (const r of rows) map[r.wordId] = r;
    return map;
  }, [rows]);

  const getStatus = useCallback(
    (wordId: string) => statsByWord[wordId],
    [statsByWord]
  );

  /** Load or default an existing row for a word (returns null when no DB). */
  const loadRow = useCallback(
    async (wordId: string): Promise<VocabStatusRow> => {
      const now = new Date().toISOString();
      const fallback: VocabStatusRow = {
        id: `${userId}:${wordId}`,
        userId,
        wordId,
        status: 'new',
        lastReviewed: now,
        repetitionCount: 0,
        correctCount: 0,
        wrongCount: 0,
        easeFactor: 2.5,
        updateSeq: 0,
      };
      if (!db) return fallback;
      try {
        return (await db.vocabStats.get(`${userId}:${wordId}`)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    [userId]
  );

  const recordAttempt = useCallback(
    (wordId: string, correct: boolean) => {
      void (async () => {
        if (!db) return;
        const prev = await loadRow(wordId);
        const correctCount = prev.correctCount + (correct ? 1 : 0);
        const wrongCount = prev.wrongCount + (correct ? 0 : 1);
        const next: VocabStatusRow = {
          ...prev,
          userId,
          wordId,
          repetitionCount: prev.repetitionCount + 1,
          correctCount,
          wrongCount,
          status: deriveStatus({ correctCount, wrongCount, repetitionCount: prev.repetitionCount + 1 }),
          lastReviewed: new Date().toISOString(),
          easeFactor: Math.min(
            EASE_MAX,
            Math.max(EASE_MIN, prev.easeFactor + (correct ? EASE_CORRECT_DELTA : EASE_WRONG_DELTA))
          ),
          updateSeq: prev.updateSeq + 1,
        };
        try {
          await db.vocabStats.put(next);
        } catch (err) {
          console.warn('[vocabStatus] write failed:', err);
        }
      })();
    },
    [userId, loadRow]
  );

  const setStatus = useCallback(
    (wordId: string, status: VocabStatusValue) => {
      void (async () => {
        if (!db) return;
        const prev = await loadRow(wordId);
        const next: VocabStatusRow = {
          ...prev,
          userId,
          wordId,
          status,
          lastReviewed: new Date().toISOString(),
          updateSeq: prev.updateSeq + 1,
        };
        try {
          await db.vocabStats.put(next);
        } catch (err) {
          console.warn('[vocabStatus] write failed:', err);
        }
      })();
    },
    [userId, loadRow]
  );

  const { knownCount, newCount } = useMemo(() => {
    let known = 0;
    let fresh = 0;
    for (const r of rows) {
      if (r.status === 'known' || r.status === 'mastered') known++;
      if (r.status === 'new') fresh++;
    }
    return { knownCount: known, newCount: fresh };
  }, [rows]);

  const value = useMemo<VocabStatusContextValue>(
    () => ({ userId, statsByWord, getStatus, recordAttempt, setStatus, knownCount, newCount }),
    [userId, statsByWord, getStatus, recordAttempt, setStatus, knownCount, newCount]
  );

  return <VocabStatusContext.Provider value={value}>{children}</VocabStatusContext.Provider>;
}

export function useVocabularyStatus(): VocabStatusContextValue {
  const context = useContext(VocabStatusContext);
  if (!context) {
    throw new Error('useVocabularyStatus must be used within VocabularyStatusProvider');
  }
  return context;
}
