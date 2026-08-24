/**
 * components/RapidBlitz/ChallengeView.tsx
 *
 * Renders the current challenge based on type and handles answer submission.
 * Supports all 6 challenge types:
 * - Vocabulary Translation
 * - Audio Comprehension (auto-plays TTS)
 * - Article Precision
 * - Number Conversion
 * - Verb Conjugation
 * - Pronunciation & Reading (word shown → user speaks)
 *
 * Answers are NOT highlighted before the user picks — all options render
 * neutral. Once an answer is submitted (locked), the chosen option glows
 * green (correct) or red (wrong) with the correct answer revealed in green.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { speakGerman } from '../../utils/audioService';
import { CompactAudioButton } from '../CompactAudioButton';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { theme } from '../../config/theme';
import type { RapidBlitzChallenge } from '../../types/rapidBlitz';

interface ChallengeViewProps {
  challenge: RapidBlitzChallenge | null;
  isLoading?: boolean;
  locked?: boolean;
  onAnswer?: (answer: string) => void;
  onAnswerSpeech?: (transcript: string) => boolean;
}

export function ChallengeView({
  challenge,
  isLoading,
  locked,
  onAnswer,
  onAnswerSpeech,
}: ChallengeViewProps) {
  if (isLoading) {
    return (
      <div className={`${theme.panel.surface} flex min-h-64 items-center justify-center`}>
        <div className="text-center text-slate-500 dark:text-slate-400">Loading challenge...</div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className={`${theme.panel.surface} flex min-h-64 items-center justify-center`}>
        <div className="text-center text-slate-500 dark:text-slate-400">No challenge available</div>
      </div>
    );
  }

  switch (challenge.type) {
    case 'vocabulary-translation':
      return (
        <VocabularyTranslationView challenge={challenge} onAnswer={onAnswer} locked={locked} />
      );
    case 'audio-comprehension':
      return (
        <AudioComprehensionView challenge={challenge} onAnswer={onAnswer} locked={locked} />
      );
    case 'article-precision':
      return (
        <ArticlePrecisionView challenge={challenge} onAnswer={onAnswer} locked={locked} />
      );
    case 'number-conversion':
      return (
        <NumberConversionView challenge={challenge} onAnswer={onAnswer} locked={locked} />
      );
    case 'verb-conjugation':
      return (
        <VerbConjugationView challenge={challenge} onAnswer={onAnswer} locked={locked} />
      );
    case 'pronunciation-reading':
      return (
        <PronunciationReadingView
          challenge={challenge}
          onAnswerSpeech={onAnswerSpeech}
          locked={locked}
        />
      );
    default:
      return (
        <div className={`${theme.panel.surface} flex min-h-64 items-center justify-center`}>
          <div className="text-center text-slate-500">Challenge type not yet implemented</div>
        </div>
      );
  }
}

/**
 * Compute the button style for a multiple-choice option.
 * While unlocked all options are neutral (no answer spoiler).
 * After `locked`, the correct option is green, the chosen-wrong option red.
 */
function optionClass(
  value: string,
  correctValue: string,
  lastChoice: string | null,
  locked: boolean | undefined
): string {
  const neutral = 'bg-slate-600 hover:bg-slate-700';
  if (!locked || lastChoice === null) return neutral;
  if (value === correctValue) return 'bg-emerald-600 hover:bg-emerald-700';
  if (value === lastChoice) return 'bg-red-600 hover:bg-red-700';
  return `${neutral} opacity-60`;
}

/**
 * Shared answer-button wrapper that tracks the last choice locally.
 */
function useChoiceButton(onAnswer?: (answer: string) => void, locked?: boolean) {
  const [lastChoice, setLastChoice] = useState<string | null>(null);
  const handleClick = useCallback(
    (option: string) => {
      if (locked) return;
      setLastChoice(option);
      onAnswer?.(option);
    },
    [onAnswer, locked]
  );
  return { lastChoice, handleClick };
}

/**
 * Vocabulary Translation: "Match English to German"
 */
function VocabularyTranslationView({
  challenge,
  onAnswer,
  locked,
}: {
  challenge: any;
  onAnswer?: (answer: string) => void;
  locked?: boolean;
}) {
  const { lastChoice, handleClick } = useChoiceButton(onAnswer, locked);
  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Vocabulary Translation
        </div>
      </div>

      <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 text-center dark:border-blue-800 dark:bg-blue-950/40">
        <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
          {challenge.english}
        </div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Select the German word
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {challenge.options.map((option: string) => (
          <button
            key={option}
            type="button"
            onClick={() => handleClick(option)}
            disabled={locked}
            className={`rounded-2xl px-4 py-3 text-base font-semibold text-white shadow transition-colors disabled:opacity-50 ${optionClass(
              option,
              challenge.german,
              lastChoice,
              locked
            )}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Audio Comprehension: "Listen and select" — TTS auto-plays on mount.
 */
function AudioComprehensionView({
  challenge,
  onAnswer,
  locked,
}: {
  challenge: any;
  onAnswer?: (answer: string) => void;
  locked?: boolean;
}) {
  const { lastChoice, handleClick } = useChoiceButton(onAnswer, locked);

  const handlePlayAudio = useCallback(() => {
    speakGerman(challenge.word);
  }, [challenge.word]);

  // Auto-play the word once when the card appears.
  useEffect(() => {
    const t = window.setTimeout(() => speakGerman(challenge.word), 150);
    return () => window.clearTimeout(t);
  }, [challenge.word]);

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Audio Comprehension
        </div>
      </div>

      <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-6 text-center dark:border-purple-800 dark:bg-purple-950/40">
        <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Listen to the audio, then select the meaning
        </div>
        <button
          type="button"
          onClick={handlePlayAudio}
          disabled={locked}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-3xl shadow transition hover:bg-purple-700 active:scale-95 disabled:opacity-50"
          aria-label={`Play audio: ${challenge.word}`}
        >
          🔊
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {challenge.options.map((option: string) => (
          <button
            key={option}
            type="button"
            onClick={() => handleClick(option)}
            disabled={locked}
            className={`rounded-2xl px-4 py-3 text-base font-semibold text-white shadow transition-colors disabled:opacity-50 ${optionClass(
              option,
              challenge.meaning,
              lastChoice,
              locked
            )}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Article Precision: "Select der/die/das"
 */
function ArticlePrecisionView({
  challenge,
  onAnswer,
  locked,
}: {
  challenge: any;
  onAnswer?: (answer: string) => void;
  locked?: boolean;
}) {
  const { lastChoice, handleClick } = useChoiceButton(onAnswer, locked);
  const articles = ['der', 'die', 'das'] as const;
  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Article Precision
        </div>
      </div>

      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950/40">
        <div className="flex items-center justify-center gap-3">
          <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
            {challenge.noun}
          </div>
          <CompactAudioButton word={challenge.noun} />
        </div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Select the correct article
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {articles.map((article) => (
          <button
            key={article}
            type="button"
            onClick={() => handleClick(article)}
            disabled={locked}
            className={`rounded-2xl px-3 py-3 text-lg font-extrabold text-white shadow transition-colors disabled:opacity-50 ${
              locked && lastChoice !== null
                ? optionClass(article, challenge.article, lastChoice, locked)
                : // Global gender color tokens: der=blue, die=red, das=green.
                  `${theme.gender[article === 'die' ? 'dieF' : article].bg} hover:brightness-110`
            }`}
          >
            {article.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Number Conversion: "Convert digit ↔ German text"
 */
function NumberConversionView({
  challenge,
  onAnswer,
  locked,
}: {
  challenge: any;
  onAnswer?: (answer: string) => void;
  locked?: boolean;
}) {
  const { lastChoice, handleClick } = useChoiceButton(onAnswer, locked);
  const isDigitToText = challenge.direction === 'digit-to-text';
  const correctValue = isDigitToText
    ? challenge.germanText
    : String(challenge.number);

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Number Conversion
        </div>
      </div>

      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/40">
        <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
          {isDigitToText ? challenge.number : challenge.germanText}
        </div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {isDigitToText ? 'Select the German text' : 'Select the number'}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {challenge.options.map((option: string) => (
          <button
            key={option}
            type="button"
            onClick={() => handleClick(option)}
            disabled={locked}
            className={`rounded-2xl px-4 py-3 text-base font-semibold text-white shadow transition-colors disabled:opacity-50 ${optionClass(
              option,
              correctValue,
              lastChoice,
              locked
            )}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Verb Conjugation: "Select the correct verb form"
 */
function VerbConjugationView({
  challenge,
  onAnswer,
  locked,
}: {
  challenge: any;
  onAnswer?: (answer: string) => void;
  locked?: boolean;
}) {
  const { lastChoice, handleClick } = useChoiceButton(onAnswer, locked);
  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Verb Conjugation
        </div>
      </div>

      <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-6 text-center dark:border-indigo-800 dark:bg-indigo-950/40">
        <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
          {challenge.pronoun} {challenge.verb ? `(${challenge.verb})` : ''}
        </div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Select the correct verb form
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {challenge.options.map((option: string) => (
          <button
            key={option}
            type="button"
            onClick={() => handleClick(option)}
            disabled={locked}
            className={`rounded-2xl px-4 py-3 text-base font-semibold text-white shadow transition-colors disabled:opacity-50 ${optionClass(
              option,
              challenge.conjugated,
              lastChoice,
              locked
            )}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Pronunciation & Reading: "The word is shown — the user speaks it."
 * Does NOT auto-play TTS (would spoil the answer) — the user reads the word
 * aloud and the mic auto-starts when supported. The 🔊 button lets the user
 * hear the word if they want.
 * When speech recognition is unsupported, the user self-checks their
 * reading (I said it) or skips — no meaning-picker, keeping it speak-first.
 */
function PronunciationReadingView({
  challenge,
  onAnswerSpeech,
  locked,
}: {
  challenge: any;
  onAnswerSpeech?: (transcript: string) => boolean;
  locked?: boolean;
}) {
  const [speechPhase, setSpeechPhase] = useState<'idle' | 'listening' | 'done'>('idle');
  const [speechMessage, setSpeechMessage] = useState('');
  const [speechResult, setSpeechResult] = useState<'correct' | 'wrong' | null>(null);
  const evaluatedRef = useRef(false);
  const startedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpeakResult = useCallback(
    (transcript: string) => {
      if (evaluatedRef.current) return;
      evaluatedRef.current = true;
      const isCorrect = onAnswerSpeech?.(transcript) ?? false;
      setSpeechResult(isCorrect ? 'correct' : 'wrong');
      setSpeechPhase('done');
    },
    [onAnswerSpeech]
  );

  const { supported, listening, status, start, stop } = useSpeechRecognition({
    lang: 'de-DE',
    onResult: handleSpeakResult,
    onError: (message) => {
      setSpeechMessage(message);
      setSpeechPhase('idle');
    },
  });

  // Reset per-card state (guard on challenge id).
  useEffect(() => {
    evaluatedRef.current = false;
    startedRef.current = false;
    setSpeechResult(null);
    setSpeechPhase('idle');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [challenge.id]);

  const handlePlayAudio = useCallback(() => {
    speakGerman(challenge.text);
  }, [challenge.text]);

  const handleSpeak = useCallback(() => {
    if (locked) return;
    setSpeechMessage('');
    setSpeechResult(null);
    setSpeechPhase('listening');
    start();
  }, [locked, start]);

  // NOTE: No auto-play TTS here — this is a pronunciation challenge where the
  // user must speak the word themselves. Auto-playing would spoil the answer.
  // The user can tap 🔊 to hear the word if they want.

  // Auto-start the mic once when the card appears (if supported).
  useEffect(() => {
    if (!supported || locked || startedRef.current) return;
    startedRef.current = true;
    setSpeechMessage('');
    setSpeechPhase('listening');
    start();

    // Give the player ~7s to speak; then stop listening and offer retry/skip.
    timeoutRef.current = window.setTimeout(() => {
      try {
        stop();
      } catch {
        // ignore
      }
      setSpeechPhase('idle');
      setSpeechMessage('No speech heard — tap 🎤 to try again, or skip.');
    }, 7000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id, supported, locked]);

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Pronunciation & Reading
        </div>
      </div>

      <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/40">
        <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
          {challenge.text}
        </div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Read the word out loud
        </div>

        {/* Feedback banner after speech evaluation */}
        {speechResult === 'correct' && (
          <div className="mt-3 inline-block rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-bold text-white">
            ✅ Richtig — gut gemacht!
          </div>
        )}
        {speechResult === 'wrong' && (
          <div className="mt-3 inline-block rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white">
            ❌ Say it like: {challenge.text}
          </div>
        )}

        {/* Controls */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handlePlayAudio}
            disabled={locked}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-2xl shadow transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
            aria-label={`Play audio: ${challenge.text}`}
          >
            🔊
          </button>

          {supported ? (
            <button
              type="button"
              onClick={handleSpeak}
              disabled={locked || listening || speechPhase === 'done'}
              className={`rounded-full px-6 py-3 text-base font-bold text-white shadow transition active:scale-95 disabled:opacity-50 ${
                listening ? 'bg-red-500 animate-pulse' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              🎤 {listening ? 'Listening…' : speechPhase === 'done' ? 'Done' : 'Speak'}
            </button>
          ) : (
            // Fallback for browsers without speech recognition:
            // the user self-checks their own reading (speak-first, no meaning picker).
            <button
              type="button"
              onClick={() => {
                if (locked) return;
                onAnswerSpeech?.(challenge.text.toLowerCase());
                setSpeechResult('correct');
                setSpeechPhase('done');
              }}
              disabled={locked || speechPhase === 'done'}
              className={`rounded-full px-6 py-3 text-base font-bold text-white shadow transition active:scale-95 disabled:opacity-50 ${
                speechPhase === 'done'
                  ? 'bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              🎤 I said it
            </button>
          )}
        </div>

        {(speechMessage || status) && speechPhase !== 'done' && (
          <div className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            {speechMessage || status}
          </div>
        )}
      </div>
    </div>
  );
}