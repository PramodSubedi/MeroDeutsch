import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { shuffleArray } from '../../utils/shuffleArray';
import { speakWord } from '../../hooks/useSpeech';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import type { OddOneOutSet } from '../../data/a1ResourcePack';

interface OddOneOutProps {
  /** The data-driven round set (phonetic / pronoun). */
  set: OddOneOutSet;
  /** moduleType surfaced to XP + the review queue. */
  module: string;
}

export function OddOneOut({ set, module }: OddOneOutProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();

  const [roundIndex, setRoundIndex] = useState(0);
  const [pickedWord, setPickedWord] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'right' | 'wrong'>('idle');
  const [score, setScore] = useState(0);
  const [roundId, setRoundId] = useState(0);

  const round = set.rounds[roundIndex % set.rounds.length];
  const oddWord = round.words[round.oddIndex];

  // Shuffle display order per round + reshuffle id — trap word never pinned.
  const displayOrder = useMemo(
    () => shuffleArray([0, 1, 2, 3]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundIndex, roundId]
  );

  const pick = (word: string) => {
    if (phase !== 'idle') return;
    setPickedWord(word);
    const isOdd = word === oddWord;
    setPhase(isOdd ? 'right' : 'wrong');
    reportResult({
      correct: isOdd,
      module,
      amount: 10,
      itemKey: `${set.id}:oddo:${oddWord}`,
      userAnswer: word,
      correctAnswer: oddWord,
    });
    if (isOdd) setScore((s) => s + 1);
  };

  const next = () => {
    setRoundIndex((r) => r + 1);
    setPickedWord(null);
    setPhase('idle');
  };

  const playAgain = () => {
    setRoundIndex(0);
    setPickedWord(null);
    setPhase('idle');
    setScore(0);
    setRoundId((r) => r + 1);
  };

  const done = roundIndex >= set.rounds.length;

  if (done) {
    return (
      <div className={theme.panel.surface}>
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? set.title.de : set.title.en}
        </h3>
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
            {isDE
              ? `Runde beendet — ${score}/${set.rounds.length} richtig.`
              : `Round complete — ${score}/${set.rounds.length} correct.`}
          </p>
          <button
            type="button"
            onClick={playAgain}
            className={`${theme.button.secondary} inline-flex min-h-[44px] items-center gap-1.5`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Neue Runde 🔄' : 'Play again 🔄'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={theme.panel.surface}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? set.title.de : set.title.en}
        </h3>
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {roundIndex + 1}/{set.rounds.length} · {score}
        </span>
      </div>
      <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400">
        {isDE
          ? 'Tippe auf das Wort, das NICHT ins Muster passt!'
          : set.instructions.en}
        {!isDE && (
          <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
            {set.instructions.np}
          </span>
        )}
      </p>

      <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
        {displayOrder.map((wordIndex) => {
          const word = round.words[wordIndex];
          const picked = phase !== 'idle' && pickedWord === word;
          const isTrap = word === oddWord;
          const bg =
            phase !== 'idle' && isTrap
              ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
              : picked
                ? 'border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
                : 'border-slate-200 bg-white text-slate-800 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
          return (
            <div key={`${roundId}-${roundIndex}-${word}`} className="relative">
              <button
                type="button"
                onClick={() => pick(word)}
                disabled={phase !== 'idle'}
                className={`min-h-[64px] w-full rounded-xl border px-3 py-2.5 pr-9 text-left text-base font-semibold transition active:scale-95 disabled:opacity-90 ${bg}`}
              >
                {word}
              </button>
              <button
                type="button"
                onClick={() => speakWord(word)}
                className={`${theme.button.icon} absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2`}
                aria-label={isDE ? `Aussprache: ${word}` : `Hear: ${word}`}
                title={isDE ? 'Wort anhören' : 'Hear the word'}
              >
                🔊
              </button>
            </div>
          );
        })}
      </div>

      {phase !== 'idle' && (
        <div
          className={`mx-auto mt-4 max-w-md rounded-xl p-3 text-sm ${
            phase === 'right'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          {phase === 'right'
            ? isDE ? '🎉 Richtig — das passt nicht!' : '🎉 Correct — that one breaks the pattern!'
            : `${isDE ? '❌ Nicht ganz — richtig wäre:' : '❌ Not quite — the odd one was:'} ${oddWord}`}
          {!isDE && (
            <>
              <span className="mt-1 block">{round.reason}</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                {round.reasonNe}
              </span>
            </>
          )}
          <button type="button" onClick={next} className={`${theme.button.primarySmall} mt-3`}>
            {isDE ? 'Weiter →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}