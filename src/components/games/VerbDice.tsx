/**
 * src/components/games/VerbDice.tsx
 *
 * Lesson Engine game — Virtual Verb-Dice Challenge (Würfelspiel, A1 Resource
 * Pack Unit 3 mechanic). Two virtual dice roll: face 1 picks the subject
 * pronoun (mapping 1:1 to the A1_VERBS keys), face 2 picks the drill verb.
 * The learner must conjugate correctly BEFORE the 10-second countdown
 * expires — a timeout counts as a miss and reveals the correct form.
 *
 * - Options are built once per turn and shuffled at create (stable after
 *   reveal — C2.9).
 * - Distractors come from the SAME verb's other forms (realistic confusions).
 * - Every miss (wrong pick or timeout) is queued to the SRS queue via the
 *   shared reporter (module 'verb-dice' → errorTag 'verb').
 * - TTS (C2.6): pre-reveal 🔊 speaks ONLY "pronoun + infinitive"; the
 *   conjugated form is spoken after the reveal.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dices } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { shuffleArray } from '../../utils/shuffleArray';
import { speakText } from '../../hooks/useSpeech';
import { A1_VERBS } from '../../data/a1Verbs';
import {
  A1_VERB_DICE,
  PRONOUN_LABELS,
  type Pronoun,
} from '../../data/a1ResourcePack';
import { useAnswerReporter } from '../../hooks/useExerciseSession';

interface DiceTurn {
  pronoun: Pronoun;
  verb: string;
  correct: string;
  options: string[];
}

type TurnPhase = 'idle' | 'rolling' | 'answer' | 'revealed';

const moduleType = 'verb-dice';

/** Build one honest turn from the SHARED A1_VERBS table. */
function buildTurn(pronoun: Pronoun, verb: string): DiceTurn {
  const forms = A1_VERBS[verb];
  const correct = forms[pronoun];
  const distractors = shuffleArray(
    Object.values(forms).filter((f) => f !== correct)
  );
  return {
    pronoun,
    verb,
    correct,
    options: shuffleArray([correct, ...distractors.slice(0, 2)]),
  };
}

export function VerbDice() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();

  const [phase, setPhase] = useState<TurnPhase>('idle');
  const [displayPronoun, setDisplayPronoun] = useState<Pronoun>('ich');
  const [displayVerb, setDisplayVerb] = useState(A1_VERB_DICE.verbs[0]);
  const [turn, setTurn] = useState<DiceTurn | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [wasRight, setWasRight] = useState(false);
  const [timeLeft, setTimeLeft] = useState(A1_VERB_DICE.timerSeconds);
  const [stats, setStats] = useState({ right: 0, missed: 0 });
  const rollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup the roll animation interval on unmount.
  useEffect(
    () => () => {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    },
    []
  );

  // Countdown: fires while the turn is in 'answer'. At 0 the turn is a
  // TIMEOUT MISS — the correct form reveals (and is queued to SRS).
  useEffect(() => {
    if (phase !== 'answer') return;
    if (timeLeft <= 0) {
      if (turn) {
        reportResult({
          correct: false,
          module: moduleType,
          itemKey: `${turn.pronoun}-${turn.verb}`,
          userAnswer: '(timeout)',
          correctAnswer: turn.correct,
        });
      }
      setWasRight(false);
      setPhase('revealed');
      setStats((s) => ({ ...s, missed: s.missed + 1 }));
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, turn, reportResult]);

  /** Roll both dice → brief face shuffle → build the turn. */
  const roll = useCallback(() => {
    if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    setPhase('rolling');
    setTurn(null);
    setSelected(null);
    rollTimerRef.current = setInterval(() => {
      const faces = A1_VERB_DICE.pronounFaces;
      setDisplayPronoun(faces[Math.floor(Math.random() * faces.length)]);
      setDisplayVerb(
        A1_VERB_DICE.verbs[Math.floor(Math.random() * A1_VERB_DICE.verbs.length)]
      );
    }, 80);
    setTimeout(() => {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
      const pronoun =
        A1_VERB_DICE.pronounFaces[Math.floor(Math.random() * A1_VERB_DICE.pronounFaces.length)];
      const verb =
        A1_VERB_DICE.verbs[Math.floor(Math.random() * A1_VERB_DICE.verbs.length)];
      setDisplayPronoun(pronoun);
      setDisplayVerb(verb);
      setTurn(buildTurn(pronoun, verb));
      setTimeLeft(A1_VERB_DICE.timerSeconds);
      setPhase('answer');
    }, 700);
  }, []);

  /** Conjugate — correct claims +15 XP; wrong/timeout queues the miss. */
  const choose = (option: string) => {
    if (phase !== 'answer' || !turn) return;
    const right = option === turn.correct;
    setSelected(option);
    setWasRight(right);
    setPhase('revealed');
    reportResult({
      correct: right,
      module: moduleType,
      amount: 15,
      itemKey: `${turn.pronoun}-${turn.verb}`,
      userAnswer: option,
      correctAnswer: turn.correct,
    });
    setStats((s) =>
      right ? { ...s, right: s.right + 1 } : { ...s, missed: s.missed + 1 }
    );
  };

  const busy = phase === 'rolling';

  /** Ready the next roll. */
  const nextTurn = () => {
    setPhase('idle');
    setTurn(null);
    setSelected(null);
    setTimeLeft(A1_VERB_DICE.timerSeconds);
  };

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink-950 dark:text-white">
          {isDE ? 'Verb-Würfelspiel' : 'Verb-Dice Challenge'}
        </h3>
        <span className="text-body font-semibold text-ink-500 dark:text-ink-400">
          {isDE ? 'Richtig' : 'Right'} {stats.right} · {isDE ? 'Verpasst' : 'Missed'} {stats.missed}
        </span>
      </div>

      {phase === 'idle' && (
        <p className="mb-4 text-center text-meta text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Würfle! Würfel 1 = Pronomen, Würfel 2 = Verb — konjugiere in 10 Sekunden!'
            : 'Roll! Dice 1 = pronoun, dice 2 = verb — conjugate within 10 seconds!'}
        </p>
      )}

      {/* Dice display: pronoun face + verb face */}
      <div className="mx-auto flex max-w-md items-center justify-center gap-3">
        <div
          className={`flex min-h-[76px] w-full flex-col items-center justify-center rounded-lg border-2 border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-800 ${
            busy ? 'animate-pulse' : ''
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
            {isDE ? 'Würfel 1' : 'Dice 1'}
          </span>
          <span className="mt-1 text-center text-lg font-extrabold text-accent-600 dark:text-accent-300">
            {PRONOUN_LABELS[displayPronoun].de}
          </span>
          {!isDE && (
            <span className="text-center text-[10px] text-ink-500">
              {PRONOUN_LABELS[displayPronoun].en}
            </span>
          )}
        </div>
        <div
          className={`flex min-h-[76px] w-full flex-col items-center justify-center rounded-lg border-2 border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-800 ${
            busy ? 'animate-pulse' : ''
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
            {isDE ? 'Würfel 2' : 'Dice 2'}
          </span>
          <span className="mt-1 text-lg font-extrabold text-accent-600 dark:text-accent-300">
            {displayVerb}
          </span>
        </div>
      </div>

      {phase === 'idle' && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={roll}
            className={`${theme.button.primary} inline-flex min-h-[44px] items-center gap-2`}
          >
            <Dices className="h-5 w-5" aria-hidden="true" />
            {isDE ? 'Würfeln!' : 'Roll the dice!'}
          </button>
        </div>
      )}

      {phase === 'answer' && turn && (
        <div className="mx-auto mt-4 max-w-md">
          {/* Countdown bar (10s → 0) */}
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                timeLeft <= 3
                  ? 'bg-danger-500'
                  : timeLeft <= 6
                    ? 'bg-warning-500'
                    : 'bg-success-500'
              }`}
              style={{ width: `${(timeLeft / A1_VERB_DICE.timerSeconds) * 100}%` }}
            />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-body font-bold text-ink-600 dark:text-ink-300">
              ⏱ {timeLeft}s
            </span>
            <button
              type="button"
              onClick={() => speakText(`${PRONOUN_LABELS[turn.pronoun].de} ${turn.verb}`, 0.9)}
              className={theme.button.icon}
              aria-label={isDE ? 'Prompt anhören' : 'Hear the prompt'}
              title={isDE ? 'Nur der Prompt — nicht die Antwort' : 'Prompt only — not the answer'}
            >
              🔊
            </button>
          </div>

          <div className="grid gap-2">
            {turn.options.map((opt) => {
              const chosen = selected === opt;
              const isAnswer = opt === turn.correct;
              const bg =
                isAnswer
                  ? 'bg-success-100 text-success-900 dark:bg-success-950/30 dark:text-success-300'
                  : chosen
                    ? 'bg-danger-100 text-danger-900 dark:bg-danger-950/30 dark:text-danger-300'
                    : 'border border-ink-200 bg-white text-ink-800 shadow-sm hover:bg-ink-50 dark:bg-ink-800 dark:border-ink-800 dark:text-ink-200';
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => choose(opt)}
                  className={`min-h-[44px] rounded-md px-4 py-2.5 text-left text-body font-semibold transition active:scale-95 ${bg}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reveal: timeout or answer shown — correct form + answer audio when wrong */}
      {phase === 'revealed' && turn && (
        <div
          className={`mx-auto mt-4 max-w-md rounded-md p-3 text-body ${
            wasRight
              ? 'bg-success-50 text-success-800 dark:bg-success-950/40 dark:text-success-200'
              : 'bg-warning-50 text-warning-900 dark:bg-warning-950/40 dark:text-warning-200'
          }`}
        >
          {wasRight
            ? isDE ? `🎉 Richtig — ${turn.correct}! +15 XP` : `🎉 Correct — ${turn.correct}! +15 XP`
            : `${isDE ? '⏱ Richtig wäre:' : '⏱ Correct would be:'} ${PRONOUN_LABELS[turn.pronoun].de} ${turn.correct}`}
          {!wasRight && (
            <button
              type="button"
              onClick={() => speakText(turn.correct, 0.85)}
              className={`${theme.button.icon} ml-2`}
              aria-label={isDE ? 'Antwort anhören' : 'Hear the answer'}
            >
              🔊
            </button>
          )}
          <button
            type="button"
            onClick={nextTurn}
            className={`${theme.button.primarySmall} mt-3 block`}
          >
            {isDE ? 'Nochmal würfeln →' : 'Roll again →'}
          </button>
        </div>
      )}
    </div>
  );
}