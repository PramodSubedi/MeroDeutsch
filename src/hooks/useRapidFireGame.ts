import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ArticleItem } from '../types';
import { curriculumService } from '../services';
import { useReviewQueue } from './useReviewQueue';
import { useXp } from './useXp';
import { useAuth } from './useAuth';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { buildQuestionDeck } from '../utils/questionGenerator';

/** Blitz duration in seconds. */
export const RAPID_FIRE_DURATION = 60;
const HIGH_SCORE_KEY_BASE = 'meroDeutschRapidBlitz';

/** Combo thresholds → XP multiplier. */
function getMultiplier(combo: number): number {
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

export type RapidFireStatus = 'idle' | 'countdown' | 'playing' | 'finished';

export interface RapidFireHighScore {
  score: number;
  wpm: number;
  accuracy: number;
  date: string;
}

interface RapidFireState {
  bestScore: number;
  bestWpm: number;
  lastRun?: RapidFireHighScore;
}

function loadHighScore(key: string): RapidFireState {
  try {
    const raw = getItem(key);
    if (!raw) return { bestScore: 0, bestWpm: 0 };
    const parsed = JSON.parse(raw) as Partial<RapidFireState>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      bestWpm: typeof parsed.bestWpm === 'number' ? parsed.bestWpm : 0,
      lastRun: parsed.lastRun,
    };
  } catch {
    return { bestScore: 0, bestWpm: 0 };
  }
}

function saveHighScore(key: string, state: RapidFireState): void {
  setItem(key, JSON.stringify(state));
}

/**
 * 60-Second Rapid-Fire Blitz game engine.
 *
 * Fetches article nouns from `curriculumService.getArticles()` (no hardcoded
 * arrays), runs the timer, tracks combo multiplier + WPM, awards scaled XP
 * via the shared `useXp` context, pushes misses into `useReviewQueue`, and
 * persists per-user high scores via `safeStorage` + `scopedKey`.
 */
export function useRapidFireGame() {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const storageKey = scopedKey(HIGH_SCORE_KEY_BASE, userId);

  const [status, setStatus] = useState<RapidFireStatus>('idle');
  const [pool, setPool] = useState<ArticleItem[]>([]);
  const [deck, setDeck] = useState<ArticleItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RAPID_FIRE_DURATION);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [missedWords, setMissedWords] = useState<string[]>([]);
  const [highScore, setHighScore] = useState<RapidFireState>(() => loadHighScore(storageKey));
  const [xpEarned, setXpEarned] = useState(0);

  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();

  // Load noun pool via the curriculum service (data layer), once.
  useEffect(() => {
    let cancelled = false;
    curriculumService.getArticles().then((data) => {
      if (cancelled || data.length === 0) return;
      setPool(data);
      setDeck(buildQuestionDeck(data, data.length, (item) => item.noun));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reload high score whenever the user/scoped key changes.
  useEffect(() => {
    setHighScore(loadHighScore(storageKey));
  }, [storageKey]);

  /**
   * Persist best score + wpm if we beat them (writes only at finish to keep
   * the blitz path zero-alloc and re-render light).
   */
  const persistBest = useCallback(
    (finalScore: number, wpm: number, accuracy: number) => {
      const current = loadHighScore(storageKey);
      const next: RapidFireState = {
        bestScore: Math.max(current.bestScore, finalScore),
        bestWpm: Math.max(current.bestWpm, Math.round(wpm)),
        lastRun: { score: finalScore, wpm: Math.round(wpm), accuracy, date: new Date().toISOString() },
      };
      saveHighScore(storageKey, next);
      setHighScore(next);
    },
    [storageKey]
  );

  // 60-second countdown — starts when status flips to 'playing'.
  useEffect(() => {
    if (status !== 'playing') return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  // When the countdown hits 0, finalize the run exactly once.
  useEffect(() => {
    if (status !== 'playing' || secondsLeft > 0) return;

    const elapsed = RAPID_FIRE_DURATION - secondsLeft;
    const minutes = Math.max(elapsed / 60, 1 / 60);
    const finalWpm = Math.round(correctCount / minutes);
    const attempts = correctCount + incorrectCount;
    const finalAccuracy = attempts > 0 ? Math.round((correctCount / attempts) * 100) : 0;

    persistBest(score, finalWpm, finalAccuracy);
    setStatus('finished');
  }, [status, secondsLeft, correctCount, incorrectCount, score, persistBest]);

  const currentItem = useMemo(() => deck[currentIndex], [deck, currentIndex]);

  const multiplier = getMultiplier(combo);

  const wpm = useMemo(() => {
    const elapsed = RAPID_FIRE_DURATION - secondsLeft;
    const minutes = Math.max(elapsed / 60, 1 / 60);
    return Math.round(correctCount / minutes);
  }, [correctCount, secondsLeft]);

  const liveAccuracy = useMemo(() => {
    const attempts = correctCount + incorrectCount;
    return attempts > 0 ? Math.round((correctCount / attempts) * 100) : 0;
  }, [correctCount, incorrectCount]);

  /**
   * Answer handler — zero-delay: advance to the next card in the same frame.
   */
  const answer = useCallback(
    (choice: 'der' | 'die' | 'das') => {
      if (status !== 'playing') return;
      const item = deck[currentIndex];
      if (!item) return;

      if (choice === item.art) {
        const newCombo = combo + 1;
        const mult = getMultiplier(newCombo);
        const gained = Math.round(10 * mult);
        setCombo(newCombo);
        setCorrectCount((c) => c + 1);
        setScore((s) => s + gained);
        setXpEarned((x) => x + gained);
        reportAnswer({ correct: true, module: 'rapid', amount: gained });
      } else {
        setCombo(0);
        setIncorrectCount((c) => c + 1);
        setMissedWords((m) => [...m, `${item.art} ${item.noun}`]);
        addWrongAnswer({
          moduleType: 'rapid',
          itemKey: `${item.art} ${item.noun}`,
          userAnswer: `${choice} ${item.noun}`,
          correctAnswer: `${item.art} ${item.noun}`,
        });
      }

      // Zero-delay transition: next card immediately.
      setCurrentIndex((i) => (i + 1) % deck.length);
    },
    [status, deck, currentIndex, combo, reportAnswer, addWrongAnswer]
  );

  /** Start a fresh run (or restart after finishing). */
  const startGame = useCallback(() => {
    if (pool.length === 0) return;
    setDeck(buildQuestionDeck(pool, pool.length, (item) => item.noun));
    setCurrentIndex(0);
    setSecondsLeft(RAPID_FIRE_DURATION);
    setScore(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setCombo(0);
    setMissedWords([]);
    setXpEarned(0);
    setStatus('countdown');
  }, [pool]);

  /** Transition from countdown → playing. */
  const startPlaying = useCallback(() => {
    setStatus('playing');
  }, []);

  /** Return to the idle / ready screen. */
  const resetGame = useCallback(() => {
    setStatus('idle');
    setScore(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setCombo(0);
    setMissedWords([]);
    setXpEarned(0);
    setSecondsLeft(RAPID_FIRE_DURATION);
  }, []);

  return {
    status,
    currentItem,
    secondsLeft,
    score,
    correctCount,
    incorrectCount,
    combo,
    multiplier,
    wpm,
    accuracy: liveAccuracy,
    missedWords,
    xpEarned,
    bestScore: highScore.bestScore,
    bestWpm: highScore.bestWpm,
    lastRun: highScore.lastRun,
    answer,
    startGame,
    startPlaying,
    resetGame,
    isLoading: pool.length === 0,
  };
}