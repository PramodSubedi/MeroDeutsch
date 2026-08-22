import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ArticleItem } from '../types';
import { curriculumService } from '../services';
import { useReviewQueue } from './useReviewQueue';
import { useXp } from './useXp';
import { useAuth } from './useAuth';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { pickRandom } from '../utils/questionGenerator';

const STORAGE_KEY_BASE = 'meroDeutschArticleGame';

interface ArticleGameState {
  score: number;
  total: number;
  streak: number;
}

function loadState(key: string): ArticleGameState {
  try {
    const raw = getItem(key);
    if (!raw) return { score: 0, total: 0, streak: 0 };
    const parsed = JSON.parse(raw) as Partial<ArticleGameState>;
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
    };
  } catch {
    return { score: 0, total: 0, streak: 0 };
  }
}

function saveState(key: string, state: ArticleGameState): void {
  setItem(key, JSON.stringify(state));
}

/**
 * useArticleGame — consolidated state + persistence for the der/die/das trainer.
 *
 * Owns quiz state (current card, score, streak, accuracy, lock/choice/result),
 * persists score/total/streak to localStorage (per-user scoped), and wires
 * the existing SRS review queue (`useReviewQueue`) + XP system (`useXp`)
 * so wrong answers enter the Leitner queue and correct answers award XP.
 */
export function useArticleGame() {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const storageKey = scopedKey(STORAGE_KEY_BASE, userId);

  const [articlesData, setArticlesData] = useState<ArticleItem[]>([]);
  const [currentItem, setCurrentItem] = useState<ArticleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lastChoice, setLastChoice] = useState<'der' | 'die' | 'das' | null>(null);
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);

  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();

  // Load persisted stats when the user changes (login/logout/switch).
  useEffect(() => {
    const persisted = loadState(storageKey);
    setScore(persisted.score);
    setTotal(persisted.total);
    setStreak(persisted.streak);
  }, [storageKey]);

  // Load article nouns from the curriculum service. Offline-first:
  // RPC -> table SELECT -> Dexie cache (populated by a prior online fetch).
  // On a cold offline start the pool may be empty — the page shows an empty
  // state instead of a bundled JSON deck.
  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getArticles()
      .then((data) => {
        if (cancelled) return;
        setArticlesData(data);
        if (data.length > 0) setCurrentItem(pickRandom(data));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setArticlesData([]);
        setCurrentItem(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist stats whenever they change.
  useEffect(() => {
    saveState(storageKey, { score, total, streak });
  }, [score, total, streak, storageKey]);

  const targetPhrase = useMemo(
    () => (currentItem ? `${currentItem.art} ${currentItem.noun}` : ''),
    [currentItem]
  );

  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  /**
   * Core result handler shared by button clicks and speech evaluation.
   * Updates score/streak/total, locks the card, and awards XP on success.
   */
  const reportResult = useCallback(
    (correct: boolean) => {
      if (locked || !currentItem) return;
      setLocked(true);
      setTotal((t) => t + 1);
      if (correct) {
        setScore((s) => s + 1);
        setStreak((st) => st + 1);
        setLastResult('correct');
        reportAnswer({ correct: true, module: 'articles' });
      } else {
        setStreak(0);
        setLastResult('wrong');
      }
    },
    [locked, currentItem, reportAnswer]
  );

  /**
   * Lock the card and count an attempt without scoring.
   * Used by the speech path when the user says only the article correctly
   * (partial match) — mirrors the original trainer's behavior.
   */
  const reportPartial = useCallback(() => {
    if (locked || !currentItem) return;
    setLocked(true);
    setTotal((t) => t + 1);
  }, [locked, currentItem]);

  /** Evaluate a der/die/das button choice. */
  const checkAnswer = useCallback(
    (choice: 'der' | 'die' | 'das') => {
      if (locked || !currentItem) return;
      const correct = choice === currentItem.art;
      setLastChoice(choice);
      if (!correct) {
        addWrongAnswer({
          moduleType: 'articles',
          itemKey: `${currentItem.art} ${currentItem.noun}`,
          userAnswer: `${choice} ${currentItem.noun}`,
          correctAnswer: `${currentItem.art} ${currentItem.noun}`,
        });
      }
      reportResult(correct);
    },
    [locked, currentItem, addWrongAnswer, reportResult]
  );

  /** Advance to the next quiz card, clearing per-card state. */
  const nextItem = useCallback(() => {
    if (articlesData.length === 0) return;
    setCurrentItem((prev) => {
      if (!prev) return pickRandom(articlesData);
      return pickRandom(articlesData, (item) => item.noun === prev.noun);
    });
    setLocked(false);
    setLastChoice(null);
    setLastResult(null);
  }, [articlesData]);

  /** Reset all game stats and start fresh. */
  const resetGame = useCallback(() => {
    setScore(0);
    setTotal(0);
    setStreak(0);
    setLocked(false);
    setLastChoice(null);
    setLastResult(null);
    if (articlesData.length > 0) {
      setCurrentItem(pickRandom(articlesData));
    }
  }, [articlesData]);

  return {
    articlesData,
    currentItem,
    loading,
    score,
    total,
    streak,
    accuracy,
    locked,
    lastChoice,
    lastResult,
    targetPhrase,
    checkAnswer,
    reportResult,
    reportPartial,
    nextItem,
    resetGame,
    /** Exposed for the speech-recognition error path (wrong-answer SRS entry). */
    addWrongAnswer,
  };
}
