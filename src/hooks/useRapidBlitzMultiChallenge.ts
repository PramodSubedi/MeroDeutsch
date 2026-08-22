/**
 * hooks/useRapidBlitzMultiChallenge.ts
 *
 * 60-second Rapid Blitz game engine that rotates through 6 challenge types:
 * vocabulary, audio, articles, numbers, verbs, pronunciation.
 *
 * The game is organised into 6 sections (one per challenge type), each with
 * exactly 4 questions. Questions for each section come from the DYNAMIC
 * `content_items` pool via curriculumService.getRapidFireSections() — no
 * bundled static data.
 *
 * For the **Mixed** mode the 6 sections are played in order (CHALLENGE_MODES),
 * with the questions inside each section shuffled on every run.
 *
 * Before every section a `sectionInfo` phase pauses the 60-second timer and
 * shows the player a short mode description + example.  Tapping "Continue"
 * resumes the countdown and the section's 4 questions.
 *
 * Status flow: idle -> preRound -> countdown -> playing -> (sectionInfo -> countdown -> playing)* x6 -> finished
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReviewQueue } from './useReviewQueue';
import { useXp } from './useXp';
import { useAuth } from './useAuth';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { shuffleArray } from '../utils/shuffleArray';
import { curriculumService } from '../services';
import type { ChallengeType, RapidBlitzChallenge } from '../types/rapidBlitz';

const RAPID_BLITZ_DURATION = 60; // seconds per round
const HIGH_SCORE_KEY_BASE = 'rapidBlitzMultiChallenge';
const FEEDBACK_LOCK_MS = 1500;
const QUESTIONS_PER_SECTION = 4; // questions per section/round

const CHALLENGE_MODES = [
  'vocabulary-translation',
  'audio-comprehension',
  'article-precision',
  'number-conversion',
  'verb-conjugation',
  'pronunciation-reading',
] as const;

/** Empty pool map used until the dynamic pools load. */
const EMPTY_POOLS: Record<string, RapidBlitzChallenge[]> = {};

export interface AnswerRecord {
  challengeType: string;
  challenge: RapidBlitzChallenge;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  round: number;
}

/**
 * Helper: extract a readable question label from a challenge.
 */
export function getChallengeQuestion(challenge: RapidBlitzChallenge): string {
  switch (challenge.type) {
    case 'vocabulary-translation':
      return `"${challenge.english}" → ?`;
    case 'audio-comprehension':
      return `Listen & choose: "${challenge.meaning}"`;
    case 'article-precision':
      return `Article: "${challenge.noun}"`;
    case 'number-conversion':
      return challenge.direction === 'digit-to-text' ? `Write ${challenge.number} in German` : `Write the number for "${challenge.germanText}"`;
    case 'verb-conjugation':
      return `${challenge.pronoun} ___ ${challenge.verb}`;
    case 'pronunciation-reading':
      return `Pronounce: "${challenge.text}"`;
    default:
      return 'unknown';
  }
}

/** Challenges with a multiple-choice `options` array (article-precision uses fixed der/die/das). */
type ChallengeWithOptions = Extract<RapidBlitzChallenge, { options: string[] }>;

/**
 * Shuffle an individual challenge's multiple-choice options ONCE so the
 * correct answer is not always at position A. Answers are compared by value,
 * so shuffling does not affect scoring/XP/queue wiring.
 */
function shuffleChallengeOptions(challenge: RapidBlitzChallenge): RapidBlitzChallenge {
  if (!('options' in challenge)) return challenge;
  const withOptions = challenge as ChallengeWithOptions;
  if (!withOptions.options || withOptions.options.length < 2) return challenge;
  return { ...challenge, options: shuffleArray([...withOptions.options]) } as RapidBlitzChallenge;
}

/**
 * Build the flat challenge list for a given mode from the DYNAMIC pools.
 * Mixed mode => 6 sections, each section's questions shuffled locally.
 * Focused mode => just the questions for that section.
 *
 * Each question's options are shuffled exactly once here (at run start), so
 * the correct answer lands on a random position and stays fixed for the rest
 * of the run (no re-shuffle on re-render).
 */
function buildChallengeList(
  mode: ChallengeType | undefined,
  pools: Record<string, RapidBlitzChallenge[]>
): RapidBlitzChallenge[] {
  if (mode) {
    return [...(pools[mode] ?? [])].map(shuffleChallengeOptions);
  }
  return CHALLENGE_MODES.flatMap((m) => shuffleArray(pools[m] ?? [])).map(shuffleChallengeOptions);
}

/**
 * Main hook: generates and manages multi-challenge sessions.
 * Accepts optional `mode` parameter to focus on one challenge type.
 */
export function useRapidBlitzMultiChallenge(mode?: ChallengeType) {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const storageKey = scopedKey(HIGH_SCORE_KEY_BASE, userId);

  const [status, setStatus] = useState<'idle' | 'preRound' | 'countdown' | 'sectionInfo' | 'playing' | 'finished'>('idle');
  const [challenges, setChallenges] = useState<RapidBlitzChallenge[]>([]);
  /** Dynamic section pools — fetched once via the service layer. */
  const [sectionPools, setSectionPools] = useState<Record<string, RapidBlitzChallenge[]>>(EMPTY_POOLS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RAPID_BLITZ_DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const raw = getItem(storageKey);
      return raw ? JSON.parse(raw) : 0;
    } catch {
      return 0;
    }
  });

  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalSections = useMemo(() => Math.max(1, Math.ceil(challenges.length / QUESTIONS_PER_SECTION)), [challenges.length]);

  // ── Load dynamic section pools via the service layer ─────────────
  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getRapidFireSections()
      .then((raw) => {
        if (cancelled) return;
        const pools: Record<string, RapidBlitzChallenge[]> = {};
        for (const [type, questions] of Object.entries(raw)) {
          pools[type] = questions as RapidBlitzChallenge[];
        }
        setSectionPools(pools);
      })
      .catch(() => {
        /* pools stay empty -> game shows zero-question state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Build challenge list whenever mode or pools change ───────────
  useEffect(() => {
    let cancelled = false;
    if (!cancelled) {
      setChallenges(buildChallengeList(mode, sectionPools));
    }
    return () => { cancelled = true; };
  }, [mode, sectionPools]);

  // ── Session timer (only runs while actively playing) ─────────────
  useEffect(() => {
    if (status !== 'playing') return;
    if (secondsLeft <= 0) { setStatus('finished'); return; }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { setStatus('finished'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, secondsLeft]);

  // ── Persist best score on finish ────────────────────────────────
  useEffect(() => {
    if (status !== 'finished') return;
    if (score > bestScore) {
      setBestScore(score);
      try { setItem(storageKey, JSON.stringify(score)); } catch { /* ignore */ }
    }
  }, [status, score, bestScore, storageKey]);

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  /** Move to the next question index, entering `sectionInfo` at section boundaries. */
  const advanceIndex = useCallback(
    (nextIndex: number) => {
      setCurrentIndex(nextIndex);
      if (nextIndex % QUESTIONS_PER_SECTION === 0 && nextIndex < challenges.length) {
        setCurrentSectionIndex(Math.min(nextIndex / QUESTIONS_PER_SECTION, totalSections - 1));
        setStatus('sectionInfo');
      }
    },
    [challenges.length, totalSections]
  );

  const scheduleNext = useCallback(() => {
    setLocked(true);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      setLocked(false);
      advanceIndex(currentIndex + 1);
    }, FEEDBACK_LOCK_MS);
  }, [currentIndex, advanceIndex]);

  const startGame = useCallback(() => {
    setStatus('preRound');
    setCurrentSectionIndex(0);
    setScore(0);
    setCombo(0);
    setCorrectCount(0);
    setWrongCount(0);
    setLocked(false);
    setCurrentIndex(0);
    setSecondsLeft(RAPID_BLITZ_DURATION);
    setHistory([]);
  }, []);

  const continuePreRound = useCallback(() => {
    if (status === 'preRound' || status === 'sectionInfo') setStatus('countdown');
  }, [status]);

  const startPlaying = useCallback(() => {
    setStatus('playing');
  }, []);

  const currentSectionType = useMemo<ChallengeType | null>(() => {
    if (challenges.length === 0) return null;
    const idx = Math.min(currentSectionIndex, totalSections - 1) * QUESTIONS_PER_SECTION;
    const challenge = challenges[idx];
    return challenge ? (challenge.type as ChallengeType) : null;
  }, [challenges, currentSectionIndex, totalSections]);

  const currentChallenge = useMemo(
    () => (challenges.length > 0 ? challenges[currentIndex % challenges.length] : null),
    [currentIndex, challenges]
  );

  const multiplier = useMemo(() => {
    if (combo >= 5) return 2;
    if (combo >= 3) return 1.5;
    return 1;
  }, [combo]);

  const answer = useCallback(
    (selectedAnswer: string): boolean => {
      if (status !== 'playing' || challenges.length === 0 || locked) return false;
      const challenge = challenges[currentIndex % challenges.length];
      let isCorrect = false;
      let correctAnswer = '';
      switch (challenge.type) {
        case 'vocabulary-translation': correctAnswer = challenge.german; isCorrect = selectedAnswer === correctAnswer; break;
        case 'audio-comprehension': correctAnswer = challenge.meaning; isCorrect = selectedAnswer === correctAnswer; break;
        case 'article-precision': correctAnswer = challenge.article; isCorrect = selectedAnswer === correctAnswer; break;
        case 'number-conversion':
          if (challenge.direction === 'digit-to-text') { correctAnswer = challenge.germanText; isCorrect = selectedAnswer === correctAnswer; }
          else { correctAnswer = String(challenge.number); isCorrect = selectedAnswer === correctAnswer; }
          break;
        case 'verb-conjugation': correctAnswer = challenge.conjugated; isCorrect = selectedAnswer === correctAnswer; break;
        case 'pronunciation-reading': correctAnswer = challenge.meaning; isCorrect = selectedAnswer === correctAnswer; break;
        default: isCorrect = false;
      }
      let xp = 0;
      if (isCorrect) {
        setCombo((c) => c + 1);
        setCorrectCount((c) => c + 1);
        const mult = getMultiplier(combo + 1);
        xp = Math.round(10 * mult);
        reportAnswer({ correct: true, module: 'rapid-blitz', amount: xp });
      } else {
        setCombo(0);
        setWrongCount((c) => c + 1);
        addWrongAnswer({ moduleType: 'rapid-blitz', itemKey: JSON.stringify({ type: challenge.type, challenge }), userAnswer: selectedAnswer, correctAnswer });
      }
      setHistory((h) => [...h, { challengeType: challenge.type, challenge, userAnswer: selectedAnswer, correctAnswer, isCorrect, round: currentSectionIndex + 1 }]);
      setScore((s) => s + xp);
      scheduleNext();
      return isCorrect;
    },
    [status, challenges, currentIndex, combo, locked, currentSectionIndex, addWrongAnswer, reportAnswer, scheduleNext]
  );

  const answerSpeech = useCallback(
    (transcript: string): boolean => {
      if (status !== 'playing' || challenges.length === 0 || locked) return false;
      const challenge = challenges[currentIndex % challenges.length];
      if (challenge.type !== 'pronunciation-reading') return false;
      const spoken = transcript.toLowerCase().trim();
      const target = challenge.text.toLowerCase().trim();
      const words = spoken.split(' ').filter(Boolean);
      const isCorrect = spoken === target || words.includes(target);
      let xp = 0;
      if (isCorrect) {
        setCombo((c) => c + 1);
        setCorrectCount((c) => c + 1);
        const mult = getMultiplier(combo + 1);
        xp = Math.round(10 * mult);
        reportAnswer({ correct: true, module: 'rapid-blitz', amount: xp });
      } else {
        setCombo(0);
        setWrongCount((c) => c + 1);
        addWrongAnswer({ moduleType: 'rapid-blitz', itemKey: `pron-${challenge.text}`, userAnswer: transcript, correctAnswer: challenge.text });
      }
      setHistory((h) => [...h, { challengeType: challenge.type, challenge, userAnswer: transcript, correctAnswer: challenge.text, isCorrect, round: currentSectionIndex + 1 }]);
      setScore((s) => s + xp);
      scheduleNext();
      return isCorrect;
    },
    [status, challenges, currentIndex, locked, combo, currentSectionIndex, addWrongAnswer, reportAnswer, scheduleNext]
  );

  const skip = useCallback(() => {
    if (challenges.length > 0 && !locked) {
      setCombo(0);
      advanceIndex(currentIndex + 1);
    }
  }, [challenges.length, locked, currentIndex, advanceIndex]);

  const currentSection = useMemo(() => Math.min(currentSectionIndex, totalSections - 1) + 1, [currentSectionIndex, totalSections]);

  return {
    status,
    challenges,
    currentChallenge,
    currentIndex,
    currentSectionType,
    currentSection,
    totalSections,
    secondsLeft,
    score,
    combo,
    multiplier,
    bestScore,
    correctCount,
    wrongCount,
    history,
    locked,
    startGame,
    continuePreRound,
    startPlaying,
    answer,
    answerSpeech,
    skip,
  };
}

function getMultiplier(combo: number): number {
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}
