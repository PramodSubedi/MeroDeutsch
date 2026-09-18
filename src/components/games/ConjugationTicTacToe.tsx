/**
 * src/components/games/ConjugationTicTacToe.tsx
 *
 * German Games #1 — Conjugation Tic-Tac-Toe (NotebookLM workbook mechanic).
 * The learner claims a 3×3 cell by conjugating a verb from the SHARED
 * `A1_VERBS` reference for a random pronoun; a friendly AI claims its own
 * cells in reply. Wrong answers reveal the correct form and hand the turn to
 * the AI — every miss is queued to the SRS review queue via the shared
 * Lesson Engine reporter (module 'verb-tictactoe'), and a win pays a bonus XP
 * + confetti. Options are fixed at question create and shuffled once (C2.9).
 *
 * TTS safety (C2.6): the 🔊 button speaks ONLY "pronoun + infinitive" before
 * the answer locks; the conjugated form is spoken after the lock.
 */

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { shuffleArray } from '../../utils/shuffleArray';
import { triggerConfetti } from '../../utils/confetti';
import { speakText } from '../../hooks/useSpeech';
import { A1_VERBS } from '../../data/a1Verbs';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import { useXp } from '../../hooks/useXp';

type Cell = 'X' | 'O' | null;
type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const PERSON_KEY = {
  ich: 'ich', du: 'du', er: 'er', sie: 'sie', wir: 'wir', ihr: 'ihr',
} as const;

type Pronoun = keyof typeof PERSON_KEY;

const PRONOUNS: Pronoun[] = ['ich', 'du', 'er', 'sie', 'wir', 'ihr'];

interface VerbQuestion {
  pronoun: Pronoun;
  verb: string;
  correct: string;
  options: string[];
}

/** One conjugation question — options fixed + shuffled at create (C2.9). */
function makeQuestion(): VerbQuestion {
  const entries = Object.entries(A1_VERBS);
  const [verb, forms] = entries[Math.floor(Math.random() * entries.length)];
  const pronoun = PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)];
  const correct = forms[PERSON_KEY[pronoun]];
  const others = shuffleArray(Object.values(forms).filter((f) => f !== correct));
  return { pronoun, verb, correct, options: shuffleArray([correct, ...others.slice(0, 2)]) };
}

function winnerOf(b: Cell[]): Cell {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

export function ConjugationTicTacToe() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();
  const { reportAnswer } = useXp();

  const [board, setBoard] = useState<Cell[]>(() => Array<Cell>(9).fill(null));
  const [status, setStatus] = useState<GameStatus>('playing');
  const [pendingCell, setPendingCell] = useState<number | null>(null);
  const [question, setQuestion] = useState<VerbQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timersRef.current.forEach((t) => clearTimeout(t)); }, []);

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  /** Resolve the board after a move; pays the win bonus once. */
  const settle = (b: Cell[]): boolean => {
    const w = winnerOf(b);
    if (w === 'X') {
      setStatus('won');
      triggerConfetti();
      reportAnswer({ correct: true, module: 'verb-tictactoe', amount: 30 });
      return true;
    }
    if (w === 'O') { setStatus('lost'); return true; }
    if (b.every(Boolean)) { setStatus('draw'); return true; }
    return false;
  };

  /** Friendly AI: slight center preference, otherwise random. */
  const aiMove = (current: Cell[]) => {
    setAiThinking(true);
    later(() => {
      const empties = current
        .map((c, i) => (c === null ? i : -1))
        .filter((i) => i >= 0);
      setAiThinking(false);
      if (empties.length === 0) { settle(current); return; }
      const pick =
        empties.includes(4) && Math.random() < 0.5
          ? 4
          : empties[Math.floor(Math.random() * empties.length)];
      const next = [...current];
      next[pick] = 'O';
      setBoard(next);
      settle(next);
    }, 700);
  };

  const tapCell = (i: number) => {
    if (status !== 'playing' || board[i] !== null || pendingCell !== null || aiThinking) return;
    setQuestion(makeQuestion());
    setPendingCell(i);
    setSelected(null);
    setLocked(false);
    setWasRight(false);
  };

  const choose = (opt: string) => {
    if (locked || !question) return;
    setLocked(true);
    setSelected(opt);
    const right = opt === question.correct;
    setWasRight(right);
    reportResult({
      correct: right,
      module: 'verb-tictactoe',
      itemKey: `${question.pronoun}-${question.verb}`,
      userAnswer: opt,
      correctAnswer: question.correct,
    });
    later(
      () => {
        if (right && pendingCell !== null) {
          const next = [...board];
          next[pendingCell] = 'X';
          setBoard(next);
          setQuestion(null);
          setPendingCell(null);
          if (!settle(next)) aiMove(next);
        } else {
          // Wrong: no claim — the AI takes the turn (answer is revealed).
          setQuestion(null);
          setPendingCell(null);
          if (status === 'playing') aiMove(board);
        }
      },
      right ? 450 : 1300
    );
  };

  const newRound = () => {
    setBoard(Array<Cell>(9).fill(null));
    setStatus('playing');
    setQuestion(null);
    setPendingCell(null);
    setSelected(null);
    setLocked(false);
    setWasRight(false);
    setAiThinking(false);
  };

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? 'Konjugations-Tic-Tac-Toe' : 'Conjugation Tic-Tac-Toe'}
        </h3>
        <button type="button" onClick={newRound} className={theme.button.secondarySmall}>
          <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
          {isDE ? 'Neu' : 'New'}
        </button>
      </div>

      {status === 'playing' && (
        <p className="mb-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Tippe ein Feld und konjugiere, um es zu besetzen (🔵 du vs 🤖 Computer).'
            : 'Tap a cell and conjugate to claim it (🔵 you vs 🤖 computer).'}
        </p>
      )}

      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
        {board.map((cell, i) => (
          <button
            key={i}
            type="button"
            onClick={() => tapCell(i)}
            disabled={status !== 'playing' || cell !== null || pendingCell !== null || aiThinking}
            className={`flex min-h-[64px] items-center justify-center rounded-xl border text-3xl font-extrabold transition active:scale-95 ${
              cell === 'X'
                ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                : cell === 'O'
                  ? 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  : 'border-slate-200 bg-white text-slate-300 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
            }`}
            aria-label={`Cell ${i + 1}`}
          >
            {cell ?? (pendingCell === i ? '?' : '')}
          </button>
        ))}
      </div>

      {aiThinking && (
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          🤖 {isDE ? 'Der Computer ist am Zug…' : 'The computer is thinking…'}
        </p>
      )}

      {/* Conjugation question for the tapped cell */}
      {question && pendingCell !== null && (
        <div className="mx-auto mt-4 max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {question.pronoun} +{' '}
                <span className="text-blue-600 dark:text-blue-300">{question.verb}</span>
              </div>
              {!locked && (
                <button
                  type="button"
                  onClick={() => speakText(`${question.pronoun} ${question.verb}`, 0.9)}
                  className={theme.button.icon}
                  aria-label={isDE ? 'Prompt anhören' : 'Hear the prompt'}
                  title={isDE ? 'Nur der Prompt — nicht die Antwort' : 'Prompt only — not the answer'}
                >
                  🔊
                </button>
              )}
            </div>
            <div className="grid gap-2">
              {question.options.map((opt) => {
                const chosen = locked && selected === opt;
                const isAnswer = opt === question.correct;
                const bg =
                  locked && isAnswer
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : chosen
                      ? 'bg-red-100 text-red-900 dark:bg-red-950/30 dark:text-red-300'
                      : 'bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200';
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={locked}
                    onClick={() => choose(opt)}
                    className={`min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-70 ${bg}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {locked && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                {wasRight
                  ? isDE ? '🎉 Richtig — Feld besetzt!' : '🎉 Correct — cell claimed!'
                  : `${isDE ? '✅ Richtig:' : '✅ Correct:'} ${question.correct}`}
                {!wasRight && (
                  <button
                    type="button"
                    onClick={() => speakText(question.correct, 0.85)}
                    className={`${theme.button.icon} ml-2`}
                    aria-label={isDE ? 'Antwort anhören' : 'Hear the answer'}
                  >
                    🔊
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game over footer */}
      {status !== 'playing' && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p
            className={`text-center text-sm font-semibold ${
              status === 'won'
                ? 'text-emerald-700 dark:text-emerald-300'
                : status === 'lost'
                  ? 'text-slate-600 dark:text-slate-300'
                  : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {status === 'won'
              ? isDE ? '🎉 Du hast gewonnen! +30 XP' : '🎉 You win! +30 XP'
              : status === 'lost'
                ? isDE ? '🤖 Der Computer gewinnt — noch ein Versuch?' : '🤖 The computer wins — try again?'
                : isDE ? 'Unentschieden!' : 'Draw!'}
          </p>
          <button
            type="button"
            onClick={newRound}
            className={`${theme.button.secondary} inline-flex min-h-[44px] items-center gap-1.5`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Neue Runde' : 'New round'}
          </button>
        </div>
      )}
    </div>
  );
}