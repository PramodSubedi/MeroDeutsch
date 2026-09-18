/**
 * src/components/games/NumberCypher.tsx
 *
 * German Games #2 — Mystery Code Cracker (NotebookLM workbook mechanic).
 * Solve simple arithmetic written in GERMAN number words ("fünfzehn + dreizehn
 * = ?") — each solved puzzle reveals the INITIAL letter of the result word,
 * and the collected letters spell a hidden German word ("SEHEN"). Wrong
 * answers reveal the correct word (letter not collected) and are queued to
 * the SRS review queue via the shared Lesson Engine reporter (module
 * 'number-cypher'). A cracked code pays bonus XP + confetti.
 *
 * Number words come from the SHARED generator in src/data/uhrzeit.ts
 * (numberToGermanWords, 0–100, hand-verified) — no duplicate number data.
 */

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { numberToGermanWords } from '../../data/uhrzeit';
import { triggerConfetti } from '../../utils/confetti';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import { useXp } from '../../hooks/useXp';

/** Hidden words spellable from German number initials (0–100 set). */
const TARGETS: { word: string; en: string; ne: string }[] = [
  { word: 'SEHEN', en: 'to see', ne: 'देख्नु' },
  { word: 'HASE', en: 'hare', ne: 'खरायो' },
  { word: 'FASS', en: 'barrel', ne: 'पिप/नाङ्लो' },
  { word: 'ZEHN', en: 'ten', ne: 'दस' },
];

interface Puzzle {
  letter: string;
  a: number;
  op: '+' | '−';
  b: number;
  result: number;
  resultWord: string;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** One round = one puzzle per letter of the target word (no repeated numbers). */
function buildPuzzles(target: string): Puzzle[] {
  const used = new Set<number>();
  return target.split('').map((letter) => {
    // Pick a number 0–100 whose German word starts with the needed letter.
    let result = randInt(0, 100);
    let guard = 0;
    while (
      (!numberToGermanWords(result).startsWith(letter) || used.has(result)) &&
      guard < 500
    ) {
      result = randInt(0, 100);
      guard++;
    }
    used.add(result);
    const b = randInt(1, 9);
    const useMinus = result + b <= 100 && Math.random() < 0.5;
    return useMinus
      ? { letter, a: result + b, op: '−' as const, b, result, resultWord: numberToGermanWords(result) }
      : { letter, a: Math.max(0, result - b), op: '+' as const, b, result, resultWord: numberToGermanWords(result) };
  });
}

export function NumberCypher() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();
  const { reportAnswer } = useXp();

  // Coherent first round: one random target drives puzzles AND empty slots.
  const initialTarget = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  const [roundId, setRoundId] = useState(0);
  const [target, setTarget] = useState(initialTarget);
  const [puzzles, setPuzzles] = useState<Puzzle[]>(() => buildPuzzles(initialTarget.word));
  const [step, setStep] = useState(0);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [collected, setCollected] = useState<boolean[]>(
    () => new Array(initialTarget.word.length).fill(false)
  );
  const [password, setPassword] = useState('');
  const [cracked, setCracked] = useState(false);
  const [passwordWrong, setPasswordWrong] = useState(false);

  // (Re)build a round — deterministic fresh puzzles for a fresh target.
  const newRound = () => {
    const nextTarget = TARGETS[Math.floor(Math.random() * TARGETS.length)];
    setTarget(nextTarget);
    setPuzzles(buildPuzzles(nextTarget.word));
    setCollected(new Array(nextTarget.word.length).fill(false));
    setStep(0);
    setInput('');
    setPhase('idle');
    setPassword('');
    setCracked(false);
    setPasswordWrong(false);
    setRoundId((r) => r + 1);
  };

  const current = puzzles[step];
  const done = step >= puzzles.length && puzzles.length > 0;

  const revealSlots = useMemo<string[]>(() => {
    return target.word.split('').map((letter, i) => (collected[i] ? letter : '•'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, collected, roundId]);

  const check = () => {
    if (!current || phase !== 'idle') return;
    const guess = input.trim().toLowerCase();
    const right = guess === current.resultWord;
    setPhase(right ? 'correct' : 'wrong');
    reportResult({
      correct: right,
      module: 'number-cypher',
      itemKey: `${current.a}-${current.op}-${current.b}`,
      userAnswer: guess,
      correctAnswer: current.resultWord,
    });
    if (right) {
      setCollected((prev) => {
        const next = [...prev];
        next[step] = true;
        return next;
      });
    }
    setTimeout(() => {
      setStep((s) => s + 1);
      setInput('');
      setPhase('idle');
    }, right ? 700 : 1400);
  };

  const tryPassword = () => {
    if (cracked) return;
    if (password.trim().toUpperCase() === target.word) {
      setCracked(true);
      setPasswordWrong(false);
      triggerConfetti();
      reportAnswer({ correct: true, module: 'number-cypher', amount: 30 });
    } else {
      setPasswordWrong(true);
    }
  };

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? 'Zahlen-Code knacken' : 'Number Code Cracker'}
        </h3>
        <button type="button" onClick={newRound} className={theme.button.secondarySmall}>
          <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
          {isDE ? 'Neu' : 'New'}
        </button>
      </div>

      {/* Letter slots */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {revealSlots.map((slot, i) => (
          <span
            key={`${roundId}-${i}`}
            className={`flex h-11 w-9 items-center justify-center rounded-lg border text-xl font-extrabold ${
              collected[i]
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-dashed border-slate-300 bg-white text-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-600'
            }`}
          >
            {slot}
          </span>
        ))}
      </div>

      {/* Active puzzle */}
      {!done && current && (
        <div className="mx-auto max-w-md">
          <div className={`${theme.panel.muted} text-center`}>
            <div className="text-2xl font-extrabold tracking-wide text-slate-900 dark:text-white">
              {numberToGermanWords(current.a)} {current.op} {numberToGermanWords(current.b)} = ?
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isDE
                ? 'Löse auf Deutsch — der Anfangsbuchstabe offenbart einen Brief des Codes!'
                : 'Solve in German — the first letter reveals a letter of the code!'}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
              disabled={phase !== 'idle'}
              placeholder={isDE ? 'z. B. achtundzwanzig' : 'e.g. achtundzwanzig'}
              className={theme.input}
              aria-label={isDE ? 'Antwort auf Deutsch' : 'German answer'}
            />
            <button
              type="button"
              onClick={check}
              disabled={phase !== 'idle' || !input.trim()}
              className={`${theme.button.primary} shrink-0`}
            >
              {isDE ? 'Prüfen' : 'Check'}
            </button>
          </div>
          {phase !== 'idle' && (
            <div
              className={`mt-3 rounded-xl p-3 text-sm font-semibold ${
                phase === 'correct'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {phase === 'correct'
                ? `${isDE ? '🎉 Richtig!' : '🎉 Correct!'} ${current.resultWord} → ${current.letter}`
                : `${isDE ? '❌ Richtig wäre:' : '❌ Correct would be:'} ${current.resultWord}`}
            </div>
          )}
        </div>
      )}

      {/* Password phase */}
      {done && (
        <div className="mx-auto max-w-md space-y-3 text-center">
          {cracked ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {isDE ? '🎉 Code geknackt! Das Wort ist ' : '🎉 Code cracked! The word is '}
              <span className="text-lg font-extrabold">{target.word}</span>
              {!isDE && <> — {target.en} · {target.ne}</>}
              <span className="mt-1 block text-xs font-medium">
                {isDE ? '+30 Bonus-XP!' : '+30 bonus XP!'}
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {isDE ? 'Welches Wort versteckt sich?' : 'Which word is hiding?'}
              </p>
              <div className="flex gap-2">
                <input
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordWrong(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') tryPassword(); }}
                  placeholder="?????"
                  className={theme.input}
                  aria-label={isDE ? 'Geheimwort' : 'Secret word'}
                />
                <button type="button" onClick={tryPassword} className={`${theme.button.primary} shrink-0`}>
                  {isDE ? 'Knacken' : 'Crack it'}
                </button>
              </div>
              {passwordWrong && (
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {isDE ? 'Nicht das Geheimwort — versuch es nochmal!' : 'Not the secret word — try again!'}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}