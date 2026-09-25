/**
 * src/components/exercises/SentenceBuilder.tsx
 *
 * Lesson Engine primitive — German word-order construction with DRAG-AND-DROP,
 * tap fallback, clean text typing, and voice speech-recognition input.
 *
 * Modes:
 *  - 'tiles': Scrambled word tiles (tray) + slots. Drag/tap tile to slot.
 *  - 'typing': Text input box for direct typing + check button.
 *  - 'voice': Speech-to-text recording with browser SpeechRecognition + fallback.
 *
 * Difficulty:
 *  - 'easy': full hint + no distractors
 *  - 'medium': standard mode (distractors in tiles mode)
 *  - 'hard': typing / voice forced, no distractors, no hints
 *
 * Granular feedback:
 *  - Identifies specific word errors and Akkusativ article mix-ups (der vs den).
 *  - Framer-motion animations: green bounce/pop on success, error shake + callout on wrong.
 *
 * Audio Safety (C2.6): Pre-lock TTS only speaks prompt/hints, NEVER target answer.
 */

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Check, RotateCcw, Volume2, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { shuffleArray } from '../../utils/shuffleArray';
import { triggerHaptic } from '../../utils/haptic';
import { playCorrectFx, playWrongFx, speakGerman } from '../../utils/audioService';
import { XP_REWARDS } from '../../hooks/useXp';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { getHint } from '../../data/hints';
import { FORM_TO_VERB, getSubjectPerson } from '../../data/a1Verbs';

export interface SentenceItem {
  /** Stable id (SRS itemKey). */
  id: string;
  /** Canonical German word order. */
  words: string[];
  /** Optional decoy tiles mixed into the tray. */
  distractors?: string[];
  /** Optional English hint rendered under the slots. */
  hint?: string;
}

export interface SentenceBuilderProps {
  items: SentenceItem[];
  /** moduleType surfaced to XP + review queue. */
  module: string;
  /** Active interaction mode. Default 'tiles'. */
  mode?: 'tiles' | 'typing' | 'voice';
  /** Difficulty level. Default 'medium'. */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Fired after the last sentence is solved. */
  onComplete?: (solved: number, missed: number) => void;
}

type SlotTone = 'empty' | 'filled' | 'correct' | 'wrong';

export function SentenceBuilder({
  items,
  module,
  mode = 'tiles',
  difficulty = 'medium',
  onComplete,
}: SentenceBuilderProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();

  // Effective mode: Hard forces typing mode if tiles selected
  const activeMode = difficulty === 'hard' && mode === 'tiles' ? 'typing' : mode;

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [typedInput, setTypedInput] = useState('');
  const [voiceInput, setVoiceInput] = useState('');
  const [wrongSlots, setWrongSlots] = useState<Set<number>>(() => new Set());
  const [feedback, setFeedback] = useState<{ isError: boolean; message: string } | null>(null);
  const [hintReason, setHintReason] = useState<string | null>(null);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set());
  const [draggingTile, setDraggingTile] = useState<number | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const item = items[index];

  // Speech Recognition hook for voice mode
  const {
    supported: voiceSupported,
    listening,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    lang: 'de-DE',
    onResult: (transcript) => {
      setVoiceInput(transcript);
    },
    onError: (err) => {
      setFeedback({ isError: true, message: err });
    },
  });

  // Scrambled deck reshuffles per sentence
  const deck = useMemo(() => {
    if (!item) return [];
    const tiles = item.words.map((word, i) => ({ word, key: i }));
    // Hard and Easy modes exclude distractors
    if (difficulty === 'medium' && item.distractors) {
      item.distractors.forEach((word, i) => tiles.push({ word, key: 1000 + i }));
    }
    return shuffleArray(tiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, difficulty]);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearResetTimer();
  }, [clearResetTimer]);

  const placedWords = placed.map((tileIdx) => deck[tileIdx]?.word ?? '');

  const getAttemptText = useCallback(() => {
    if (activeMode === 'typing') return typedInput.trim();
    if (activeMode === 'voice') return voiceInput.trim();
    return placedWords.join(' ');
  }, [activeMode, typedInput, voiceInput, placedWords]);

  const isInputReady = useMemo(() => {
    if (!item) return false;
    if (activeMode === 'typing') return typedInput.trim().length > 0;
    if (activeMode === 'voice') return voiceInput.trim().length > 0;
    // v0.2.1 recoverability: `>=` so an accidentally placed distractor can
    // never disable checking — the user can always press Check and get
    // specific feedback instead of a dead UI.
    return placed.length >= item.words.length;
  }, [item, activeMode, typedInput, voiceInput, placed.length]);

  // Contextual feedback analyzer for errors — returns the message AND a hint
  // reason keyed into the shared hint map (U4).
  // Priority: Akkusativ -> Capitalization -> Verb conjugation -> Position-based
  // missing -> Missing (global) -> Word order (generic fallback).
  const analyzeError = (attempt: string, expected: string[]): { message: string; reason: string } => {
    const attemptWords = attempt
      .toLowerCase()
      .replace(/[.,!?]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const expectedWords = expected.map((w) => w.toLowerCase().replace(/[.,!?]/g, ''));
    const expectedStr = expected.join(' ');

    // 1. Akkusativ check: der vs den (highest priority, most common mistake)
    if (expectedStr.toLowerCase().includes('den') && attemptWords.includes('der')) {
      return {
        message: isDE
          ? 'Achtung im Akkusativ: "der" wird zu "den"!'
          : 'Watch out for Akkusativ: "der" changes to "den"!',
        reason: 'akkusativ',
      };
    }

    // 2. Capitalization check: a noun the user typed lowercase at its position.
    for (let i = 0; i < expected.length; i++) {
      const expRaw = expected[i] ?? '';
      const att = attemptWords[i] ?? '';
      const exp = expectedWords[i] ?? '';
      if (att === exp) continue;
      if (/^[A-ZÄÖÜ]/.test(expRaw) && att === exp.toLowerCase()) {
        return {
          message: isDE
            ? `Erinnerung: Substantive beginnen mit Großbuchstabe! (${expRaw})`
            : `Capitalization: Nouns start with uppercase! (${expRaw})`,
          reason: 'capitalization',
        };
      }
    }

    // 3. Verb-conjugation check — fires ONLY when safely detectable. The
    //    attempt contains a known conjugated form that differs from the
    //    sentence's OWN authoritative expected form. The correct value comes
    //    from `expected`, never guessed from a possibly-ambiguous subject, so
    //    a lone `sie` (she? they?) or `Sie` can't produce wrong advice.
    //    `getSubjectPerson` is used only to add a friendly subject label.
    const attemptForm = attemptWords.find((w) => FORM_TO_VERB[w]);
    if (attemptForm) {
      const verb = FORM_TO_VERB[attemptForm];
      const expectedForm = expectedWords.find((w) => FORM_TO_VERB[w] === verb);
      if (expectedForm && expectedForm !== attemptForm) {
        const subjectRaw = expected.find((w) => (getSubjectPerson(w) ?? []).length > 0);
        return {
          message: subjectRaw
            ? isDE
              ? `⚠️ Verbkonjugation: „${subjectRaw}“ braucht „${expectedForm}“, nicht „${attemptForm}“`
              : `⚠️ Verb conjugation: “${subjectRaw}” needs “${expectedForm}”, not “${attemptForm}”`
            : isDE
              ? `⚠️ Verbkonjugation: richtig ist „${expectedForm}“, nicht „${attemptForm}“`
              : `⚠️ Verb conjugation: the correct form is “${expectedForm}”, not “${attemptForm}”`,
          reason: 'verb-conjugation',
        };
      }
    }

    // 4. Position-based missing/incorrect word: expected word absent at its slot.
    for (let i = 0; i < expected.length; i++) {
      const exp = expectedWords[i] ?? '';
      const att = attemptWords[i] ?? '';
      if (att === exp) continue;
      if (!attemptWords.includes(exp)) {
        return {
          message: isDE
            ? `Fehlendes Wort an Position ${i + 1}: "${expected[i]}"`
            : `Missing at position ${i + 1}: "${expected[i]}"`,
          reason: 'missing-word',
        };
      }
    }

    // 5. Missing words (anywhere in the attempt).
    const missing = expectedWords.filter((w) => !attemptWords.includes(w));
    if (missing.length > 0) {
      return {
        message: isDE
          ? `Fehlendes oder falsches Wort: "${missing[0]}"`
          : `Missing or incorrect word: "${missing[0]}"`,
        reason: 'missing-word',
      };
    }

    // 6. Generic fallback: all words present but wrong order / unknown reason.
    return {
      message: isDE ? 'Wortstellung oder Schreibweise prüfen!' : 'Check word order or spelling!',
      reason: 'word-order',
    };
  };

  const check = () => {
    // v0.2.1 recoverability: no `wrongSlots` guard — users may re-check any
    // time after correcting tiles (the old guard trapped them in error state).
    if (!item || !isInputReady) return;
    const attempt = getAttemptText();
    const expectedStr = item.words.join(' ');

    // Normalize for case-insensitive compare in typing/voice modes
    const isCorrect =
      activeMode === 'tiles'
        ? attempt === expectedStr
        : attempt.toLowerCase().replace(/[.,!?]/g, '') === expectedStr.toLowerCase().replace(/[.,!?]/g, '');

    if (isCorrect) {
      playCorrectFx();
      triggerHaptic('light');
      // Post-lock speak target answer (C2.6 safe)
      speakGerman(expectedStr);
      reportResult({ correct: true, module, amount: XP_REWARDS.drill });
      setFeedback({
        isError: false,
        message: isDE ? 'Richtig! Ausgezeichnet!' : 'Correct! Well done!',
      });
      const nextSolved = new Set(solvedIds).add(item.id);
      setSolvedIds(nextSolved);

      if (index >= items.length - 1) {
        onComplete?.(nextSolved.size, items.length - nextSolved.size);
      } else {
        clearResetTimer();
        resetTimerRef.current = setTimeout(() => {
          setPlaced([]);
          setTypedInput('');
          setVoiceInput('');
          setFeedback(null);
          setHintReason(null);
          setWrongSlots(new Set());
          setIndex((i) => i + 1);
        }, 900);
      }
      return;
    }

    // Handle Wrong Answer
    playWrongFx();
    triggerHaptic('error');
    const { message: errorMsg, reason } = analyzeError(attempt, item.words);
    setFeedback({ isError: true, message: errorMsg });
    setHintReason(reason);

    // Hoisted so the auto-removal timer below can read it.
    const wrong = new Set<number>();
    if (activeMode === 'tiles') {
      placed.forEach((tileIdx, slotIdx) => {
        if (deck[tileIdx]?.word !== item.words[slotIdx]) wrong.add(slotIdx);
      });
      setWrongSlots(wrong);
    }

    reportResult({
      correct: false,
      module,
      itemKey: item.id,
      userAnswer: attempt,
      correctAnswer: expectedStr,
    });

    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      if (activeMode === 'tiles') {
        // Use the LOCAL `wrong` set — the `wrongSlots` state captured in this
        // closure is stale (still empty), which silently removed nothing.
        setPlaced((prev) => prev.filter((_, slotIdx) => !wrong.has(slotIdx)));
        setWrongSlots(new Set());
      }
    }, 1200);
  };

  const placeTile = (tileIdx: number) => {
    if (!item) return;
    clearResetTimer();
    // v0.2.1 swap/recall: tapping a tile that is already placed returns it to
    // the tray, so a wrong tile can be replaced without restarting.
    if (placed.includes(tileIdx)) {
      setPlaced((prev) => prev.filter((i) => i !== tileIdx));
      setDraggingTile(null);
      return;
    }
    setPlaced((prev) => [...prev, tileIdx]);
    setDraggingTile(null);
  };

  const removeTile = (slotIdx: number) => {
    // v0.2.1 recoverability: removal is ALWAYS allowed — no locked error state.
    clearResetTimer(); // cancel pending auto-removal so it cannot yank new tiles
    setPlaced((prev) => prev.filter((_, i) => i !== slotIdx));
    setWrongSlots((prev) => {
      if (!prev.has(slotIdx)) return prev;
      const next = new Set(prev);
      next.delete(slotIdx);
      return next;
    });
  };

  const restart = () => {
    clearResetTimer();
    setIndex(0);
    setPlaced([]);
    setTypedInput('');
    setVoiceInput('');
    setFeedback(null);
    setHintReason(null);
    setWrongSlots(new Set());
    setSolvedIds(new Set());
  };

  // Pre-submission audio prompt: Only speak hint/translation, NEVER the target answer (C2.6)
  const speakHintPrompt = () => {
    if (item?.hint) {
      speakGerman(item.hint);
    }
  };

  if (!item) return null;

  const done = solvedIds.size === items.length && items.length > 0;

  return (
    <div className={theme.panel.surface}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-ink-200 pb-3 dark:border-ink-700">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-ink-950 dark:text-white">
            {isDE ? 'Satzbau' : 'Build the sentence'}
          </h3>
          <span className="rounded-sm bg-accent-100 px-2 py-0.5 text-meta font-bold text-accent-800 dark:bg-accent-900/60 dark:text-accent-200">
            {activeMode.toUpperCase()}
          </span>
          {difficulty === 'hard' && (
            <span className="rounded-sm bg-danger-100 px-2 py-0.5 text-meta font-bold text-danger-800 dark:bg-danger-900/60 dark:text-danger-200">
              HARD
            </span>
          )}
        </div>
        <span className="text-body font-semibold text-ink-500 dark:text-ink-400">
          {Math.min(index + 1, items.length)}/{items.length}
        </span>
      </div>

      {/* Mode Renderings */}
      {!done && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${item.id}-${activeMode}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* TILES MODE */}
            {activeMode === 'tiles' && (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="order-1 w-full lg:order-2 lg:flex-1">
                  <p className="mb-2 text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                    {isDE ? 'Dein Satz' : 'Your sentence'}
                  </p>
                  <div
                    className="flex min-h-[64px] flex-wrap content-start gap-2 rounded-lg border-2 border-dashed border-ink-300 bg-ink-50 p-3 dark:border-ink-600 dark:bg-ink-800/40"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingTile !== null) placeTile(draggingTile);
                    }}
                  >
                    {placed.length === 0 && (
                      <span className="self-center px-2 text-body text-ink-500 dark:text-ink-500">
                        {isDE ? 'Wörter hier ablegen…' : 'Drop words here…'}
                      </span>
                    )}
                    {placed.map((tileIdx, slotIdx) => {
                      const tone: SlotTone = wrongSlots.has(slotIdx)
                        ? 'wrong'
                        : solvedIds.has(item.id)
                          ? 'correct'
                          : 'filled';
                      const toneCls =
                        tone === 'wrong'
                          ? 'border-danger-400 bg-danger-100 text-danger-900 dark:border-danger-600 dark:bg-danger-950/50 dark:text-danger-200'
                          : tone === 'correct'
                            ? 'border-success-400 bg-success-50 text-success-900 dark:border-success-600 dark:bg-success-950/40 dark:text-success-200'
                            : 'border-accent-400 bg-accent-50 text-accent-900 shadow-sm dark:border-accent-500 dark:bg-accent-950/60 dark:text-accent-100';
                      return (
                        <motion.button
                          key={`${item.id}-slot-${slotIdx}-${tileIdx}`}
                          layout
                          animate={wrongSlots.has(slotIdx) ? { x: [-5, 5, -5, 5, 0] } : { scale: 1 }}
                          type="button"
                          draggable
                          onDragStart={() => setDraggingTile(tileIdx)}
                          onDragEnd={() => setDraggingTile(null)}
                          onClick={() => removeTile(slotIdx)}
                          className={`min-h-[44px] cursor-grab rounded-md border-2 px-3 py-2 text-body font-bold transition active:scale-95 active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md ${toneCls}`}
                        >
                          {deck[tileIdx]?.word}
                        </motion.button>
                      );
                    })}
                    {/* v0.2.1 slot indicators: numbered ghost slots show how many
                        positions remain and where the next tile lands. */}
                    {Array.from({ length: Math.max(0, item.words.length - placed.length) }, (_, i) => (
                      <span
                        key={`${item.id}-ghost-${i}`}
                        aria-hidden="true"
                        className="flex min-h-[44px] items-center rounded-md border-2 border-dashed border-ink-200 px-3 py-2 text-meta font-bold text-ink-300 dark:border-ink-700 dark:text-ink-600"
                      >
                        {placed.length + i + 1}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="order-2 w-full lg:order-1 lg:w-64 lg:shrink-0">
                  <p className="mb-2 text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                    {isDE ? 'Wörter' : 'Word tiles'}
                  </p>
                  <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
                     {deck.map((tile, index) => {
                       const used = placed.includes(index);
                       return (
                         <button
                           key={`${item.id}-tile-${tile.key}`}
                           type="button"
                           draggable={!used}
                           onDragStart={() => setDraggingTile(index)}
                           onDragEnd={() => setDraggingTile(null)}
                           onClick={() => placeTile(index)}
                           title={used ? (isDE ? 'Zurück ins Fach' : 'Return to tray') : undefined}
                           className={`min-h-[44px] rounded-md border-2 px-3 py-2 text-body font-bold transition active:scale-95 ${
                             used
                               ? 'cursor-pointer border-ink-200 bg-ink-100 text-ink-500 line-through opacity-70 hover:border-danger-300 hover:text-danger-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-500 dark:hover:border-danger-700 dark:hover:text-danger-400'
                               : 'cursor-grab border-ink-200 bg-white text-ink-800 shadow-sm hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-md active:cursor-grabbing dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-accent-500'
                           }`}
                         >
                           {tile.word}
                         </button>
                       );
                     })}
                  </div>
                </div>
              </div>
            )}

            {/* TYPING MODE */}
            {activeMode === 'typing' && (
              <div className="space-y-3">
                <p className="text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                  {isDE ? 'Tippe den Satz auf Deutsch' : 'Type the sentence in German'}
                </p>
                <input
                  type="text"
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isInputReady) check();
                  }}
                  placeholder={isDE ? 'Satz hier eingeben…' : 'Type your answer here…'}
                  className="w-full rounded-md border-2 border-ink-300 bg-white p-3 text-body font-medium text-ink-900 shadow-sm focus:border-accent-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                />
              </div>
            )}

            {/* VOICE MODE */}
            {activeMode === 'voice' && (
              <div className="space-y-4 text-center">
                <p className="text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                  {isDE ? 'Sprich den Satz auf Deutsch' : 'Speak the sentence in German'}
                </p>
                {!voiceSupported ? (
                  <div className="rounded-md bg-warning-50 p-3 text-meta text-warning-800 dark:bg-warning-950/40 dark:text-warning-200">
                    {isDE
                      ? 'Spracherkennung wird von diesem Browser nicht unterstützt. Verwende Tastatureingabe.'
                      : 'Speech recognition is not supported in this browser. Use typing fallback below.'}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={listening ? stopListening : startListening}
                      className={`flex h-16 w-16 items-center justify-center rounded-full transition ${
                        listening
                          ? 'animate-pulse bg-danger-600 text-white shadow-lg'
                          : 'bg-accent-600 text-white hover:bg-accent-700'
                      }`}
                    >
                      {listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                    </button>
                    <span className="text-meta font-medium text-ink-500 dark:text-ink-400">
                      {listening
                        ? isDE
                          ? 'Zuhören… Spreche jetzt!'
                          : 'Listening… Speak now!'
                        : isDE
                          ? 'Tippe auf das Mikrofon zum Sprechen'
                          : 'Tap microphone to speak'}
                    </span>
                  </div>
                )}
                <textarea
                  value={voiceInput}
                  onChange={(e) => setVoiceInput(e.target.value)}
                  placeholder={isDE ? 'Transkript erscheint hier…' : 'Transcript will appear here…'}
                  rows={2}
                  className="w-full rounded-md border-2 border-ink-300 bg-white p-3 text-body font-medium text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                />
              </div>
            )}

            {/* Hint & TTS prompt */}
            {item.hint && difficulty !== 'hard' && (
              <div className="mt-3 flex items-center justify-between rounded-md bg-ink-100 p-2.5 dark:bg-ink-800/60">
                <span className="text-meta font-medium text-ink-600 dark:text-ink-300">
                  💡 {item.hint}
                </span>
                <button
                  type="button"
                  onClick={speakHintPrompt}
                  className="p-1.5 text-ink-500 hover:text-accent-600 dark:text-ink-400 dark:hover:text-accent-300"
                  title={isDE ? 'Hinweis anhören' : 'Listen to hint prompt'}
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Granular Feedback Callout + U4 micro-hint */}
            {feedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`mt-3 rounded-md p-3 text-body font-bold ${
                  feedback.isError
                    ? 'bg-danger-100 text-danger-900 dark:bg-danger-950/60 dark:text-danger-200'
                    : 'bg-success-100 text-success-900 dark:bg-success-950/60 dark:text-success-200'
                }`}
              >
                {feedback.message}
                {feedback.isError && hintReason && (
                  <div className="mt-2 border-t border-danger-200 pt-2 text-meta font-medium text-danger-800 dark:border-danger-800/60 dark:text-danger-200">
                    {(() => {
                      const hint = getHint('grammar', hintReason);
                      return isDE ? hint.de : (
                        <>
                          <div>{hint.en}</div>
                          <div className="mt-0.5 text-danger-700/80 dark:text-danger-300/80">{hint.ne}</div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Controls */}
      {!done && (
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={check}
            disabled={!isInputReady}
            className={`${theme.button.primary} inline-flex min-h-[44px] items-center gap-1.5`}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Prüfen' : 'Check'}
          </button>
        </div>
      )}

      {/* Round complete */}
      {done && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-center text-body font-semibold text-success-700 dark:text-success-300">
            🎉{' '}
            {isDE
              ? `Alle Sätze gebaut! Fehler: ${items.length - solvedIds.size}`
              : `All sentences built! Misses: ${items.length - solvedIds.size}`}
          </p>
          <button
            type="button"
            onClick={restart}
            className={`${theme.button.secondary} inline-flex min-h-[44px] items-center gap-1.5`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Neue Runde' : 'Play again'}
          </button>
        </div>
      )}
    </div>
  );
}
