/**
 * src/components/run/steps/CheckSteps.tsx
 *
 * The scored half of a run.
 *
 * Every component here reports the SAME shape: it renders a step, it decides
 * right from wrong itself, and it calls `onResult(correct)` exactly once per
 * attempt. That uniformity is what lets the runner treat "what is a check step"
 * as a data question (`isCheckStep`) rather than an interface question, so adding
 * a step type never means editing the runner.
 *
 * ── WHY `TypedStep` CARRIES FIVE AUTHORED KINDS ─────────────────────────────
 * Fill-in, V2 slot, accusative/dative shift, the three translation directions,
 * error correction and subordinate contrast are one interaction with different
 * framing. `direction` changes only the INSTRUCTION and which side is hidden —
 * never the comparison — so they share a component. What `direction` is
 * forbidden from doing is changing the answer set: a direction that made a
 * correct alternative wrong would be a bug in the one component every typed
 * exercise goes through.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../../hooks/useLang';
import { AudioButton } from '../../AudioButton';
import { speakWord } from '../../../hooks/useSpeech';
import { matchesAnswer } from './matchesAnswer';
import { ASK_INSTRUCTION } from '../../../data/curriculum/lessonSpec';
import type { ArrangeStep, DictationStep, MatchStep, McqStep, TypedStep } from '../../../data/curriculum/steps';

const CARD = 'rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900';

/**
 * Report a check step's outcome.
 *
 * `userAnswer` is what the learner actually produced, carried up so the review
 * card can show a "you said" line beside the expected answer. It is optional
 * because not every interaction has a single string to report: a `match` step
 * misses on a PAIR, and fabricating one line would put a sentence on the card
 * that nobody typed.
 */
export type StepResult = (correct: boolean, userAnswer?: string) => void;

export function TypedStepView({ step, onResult }: { step: TypedStep; onResult: StepResult }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [value, setValue] = useState('');
  const [locked, setLocked] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('');
    setLocked(null);
    inputRef.current?.focus();
  }, [step]);

  // The instruction comes from `ASK_INSTRUCTION`, which lives beside the
  // validator rather than here. They have to agree about what each `ask` MEANS:
  // the first version kept the wording in this component and the meaning in a
  // data field, and a single over-loaded `direction` then rendered "Fill in the
  // blank:" for conjugations, article questions and definitions alike.
  const instruction = isDE ? ASK_INSTRUCTION[step.ask].de : ASK_INSTRUCTION[step.ask].en;
  // German text is tagged so a screen reader switches voice. The prompt is German
  // for every ask except the two that translate out of it.
  const promptLang = step.ask === 'translate-de-en' ? 'de' : step.ask === 'translate-en-de' || step.ask === 'translate-ne-de' ? undefined : 'de';

  function submit() {
    if (locked !== null) return;
    const ok = matchesAnswer(value, step.answer, step.accepted);
    setLocked(ok);
    onResult(ok, value);
    if (ok && step.speakAfter) speakWord(step.speakAfter);
  }

  return (
    <section className={CARD} aria-label={instruction}>
      <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{instruction}</p>
      <div className="mt-2 flex items-start justify-between gap-2">
        <p lang={promptLang} className="text-base text-ink-900 dark:text-ink-50">
          {step.prompt}
        </p>
        {step.speakPrompt ? <AudioButton word={step.speakPrompt} lang="de" showSpeedToggle={false} className="shrink-0" /> : null}
      </div>

      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor={`typed-${step.prompt.slice(0, 24)}`}>
          {instruction}
        </label>
        <input
          id={`typed-${step.prompt.slice(0, 24)}`}
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={locked !== null}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 disabled:opacity-70 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
        />
        {locked === null ? (
          <button
            type="submit"
            disabled={value.trim() === ''}
            className="mt-2 min-h-[44px] w-full rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-50 sm:w-auto"
          >
            {isDE ? 'Prüfen' : 'Check'}
          </button>
        ) : (
          <div
            role="status"
            className={`mt-3 rounded-md border p-3 text-sm ${
              locked
                ? 'border-success-200 bg-success-50 text-success-900 dark:border-success-900 dark:bg-success-950/40 dark:text-success-100'
                : 'border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-100'
            }`}
          >
            <p className="font-semibold">{locked ? (isDE ? 'Richtig' : 'Correct') : isDE ? 'Noch nicht' : 'Not yet'}</p>
            {!locked ? (
              <p className="mt-1">
                {isDE ? 'Richtig wäre: ' : 'The answer is: '}
                <span className="font-semibold">{step.answer}</span>
              </p>
            ) : null}
            {step.note ? <p className="mt-1 text-ink-700 dark:text-ink-200">{step.note}</p> : null}
          </div>
        )}
      </form>
    </section>
  );
}

/* ── multiple choice ──────────────────────────────────────────────────────── */

export function McqStepView({ step, onResult }: { step: McqStep; onResult: StepResult }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => setChosen(null), [step]);

  const locked = chosen !== null;
  const correct = chosen === step.answer;

  return (
    <section className={CARD} aria-label={step.prompt}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-base text-ink-900 dark:text-ink-50">{step.prompt}</p>
        {step.speakPrompt ? <AudioButton word={step.speakPrompt} lang="de" showSpeedToggle={false} className="shrink-0" /> : null}
      </div>

      <div role="radiogroup" aria-label={step.prompt} className="mt-3 grid gap-2">
        {step.options.map((option, i) => {
          const isAnswer = option === step.answer;
          const isChosen = option === chosen;
          const tone = !locked
            ? 'border-ink-300 hover:border-accent-500 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800'
            : isAnswer
              ? 'border-success-500 bg-success-50 dark:border-success-600 dark:bg-success-950/40'
              : isChosen
                ? 'border-danger-500 bg-danger-50 dark:border-danger-600 dark:bg-danger-950/40'
                : 'border-ink-200 opacity-60 dark:border-ink-800';
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={locked}
              onClick={() => {
                setChosen(option);
                onResult(option === step.answer, option);
              }}
              className={`min-h-[44px] rounded-md border px-3 py-2 text-left text-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 ${tone}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {locked ? (
        <div role="status" className={`mt-3 rounded-md border p-3 text-sm ${correct ? 'border-success-200 bg-success-50 dark:border-success-900 dark:bg-success-950/40' : 'border-danger-200 bg-danger-50 dark:border-danger-900 dark:bg-danger-950/40'}`}>
          <p className="font-semibold">{correct ? (isDE ? 'Richtig' : 'Correct') : isDE ? 'Nicht ganz' : 'Not quite'}</p>
          {!correct ? (
            <p className="mt-1">
              {isDE ? 'Richtig wäre: ' : 'The answer is: '}
              <span className="font-semibold">{step.answer}</span>
            </p>
          ) : null}
          {step.hintReason ? <p className="mt-1 text-ink-700 dark:text-ink-200">{step.hintReason}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

/* ── arrange ──────────────────────────────────────────────────────────────── */

export function ArrangeStepView({ step, onResult }: { step: ArrangeStep; onResult: StepResult }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [picked, setPicked] = useState<string[]>([]);
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    setPicked([]);
    setLocked(null);
  }, [step]);

  const tray = [...step.tokens].sort((a, b) => a.localeCompare(b));
  const remaining = useMemo(() => {
    const pool = [...tray];
    for (const p of picked) {
      const at = pool.indexOf(p);
      if (at >= 0) pool.splice(at, 1);
    }
    return pool;
  }, [picked, tray]);

  const isLocked = locked !== null;

  return (
    <section className={CARD} aria-label={step.prompt}>
      <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{isDE ? 'Stelle den Satz richtig zusammen:' : 'Build the sentence:'}</p>
      <p className="mt-1 text-base text-ink-900 dark:text-ink-50">{step.prompt}</p>

      <div
        className="mt-3 flex min-h-[3rem] flex-wrap items-start gap-1.5 rounded-md border border-dashed border-ink-300 p-2 dark:border-ink-700"
        aria-label={isDE ? 'Dein Satz' : 'Your sentence'}
      >
        {picked.length === 0 ? (
          <span className="text-sm text-ink-400 dark:text-ink-500">{isDE ? 'Tippe die Wörter hierher' : 'Tap the words in this order'}</span>
        ) : (
          picked.map((word, i) => (
            <button
              key={`${word}-${i}`}
              type="button"
              disabled={isLocked}
              onClick={() => setPicked(picked.filter((_, j) => j !== i))}
              className="rounded-md border border-ink-300 bg-white px-2 py-1 text-base text-ink-900 disabled:opacity-70 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
            >
              {word}
            </button>
          ))
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {remaining.map((word, i) => (
          <button
            key={`${word}-${i}`}
            type="button"
            disabled={isLocked}
            onClick={() => setPicked([...picked, word])}
            className="min-h-[44px] rounded-md border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-base text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-70 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
          >
            {word}
          </button>
        ))}
      </div>

      {locked === null ? (
        <button
          type="button"
          disabled={picked.length !== step.tokens.length}
          onClick={() => {
            const ok = picked.join(' ') === step.tokens.join(' ');
            setLocked(ok);
            onResult(ok, picked.join(' '));
          }}
          className="mt-3 min-h-[44px] w-full rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-50 sm:w-auto"
        >
          {isDE ? 'Prüfen' : 'Check'}
        </button>
      ) : (
        <div role="status" className={`mt-3 rounded-md border p-3 text-sm ${locked ? 'border-success-200 bg-success-50 dark:border-success-900 dark:bg-success-950/40' : 'border-danger-200 bg-danger-50 dark:border-danger-900 dark:bg-danger-950/40'}`}>
          <p className="font-semibold">{locked ? (isDE ? 'Richtig' : 'Correct') : isDE ? 'Nicht ganz' : 'Not quite'}</p>
          {!locked ? (
            <p className="mt-1">
              {isDE ? 'Richtig wäre: ' : 'The answer is: '}
              <span className="font-semibold">{step.tokens.join(' ')}</span>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ── match ────────────────────────────────────────────────────────────────── */

export function MatchStepView({ step, onResult }: { step: MatchStep; onResult: StepResult }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setPicked(null);
    setMatched([]);
    setWrong(null);
    setLocked(false);
  }, [step]);

  const rights = useMemo(() => [...step.pairs].sort((a, b) => a.en.localeCompare(b.en)), [step.pairs]);

  function choose(id: string) {
    if (locked || matched.includes(id)) return;
    if (picked === null) {
      setPicked(id);
      setWrong(null);
      return;
    }
    if (picked === id) {
      setPicked(null);
      return;
    }
    if (step.pairs.find((p) => p.id === picked)?.en === step.pairs.find((p) => p.id === id)?.en) {
      const next = [...matched, picked, id];
      setMatched(next);
      setPicked(null);
      if (next.length === step.pairs.length * 2) {
        setLocked(true);
        onResult(true);
      }
    } else {
      setWrong(id);
      onResult(false, step.pairs.find((p) => p.id === id)?.en ?? undefined);
    }
  }

  return (
    <section className={CARD} aria-label={isDE ? 'Zuordnen' : 'Match'}>
      <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{isDE ? 'Tippe ein Wort und dann seine Übersetzung.' : 'Tap a word, then its translation.'}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <h3 className="text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {step.columnLabels?.left ?? (isDE ? 'Deutsch' : 'German')}
          </h3>
          {step.pairs.map((p) => (
            <PairButton
              key={p.id}
              text={p.de}
              state={matched.includes(p.id) ? 'matched' : picked === p.id ? 'picked' : 'idle'}
              disabled={locked}
              onClick={() => choose(p.id)}
            />
          ))}
        </div>
        <div className="grid gap-1.5">
          <h3 className="text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {step.columnLabels?.right ?? (isDE ? 'Englisch' : 'English')}
          </h3>
          {rights.map((p) => (
            <PairButton
              key={p.id}
              text={p.en}
              state={matched.includes(p.id) ? 'matched' : wrong === p.id ? 'wrong' : 'idle'}
              disabled={locked}
              onClick={() => choose(p.id)}
            />
          ))}
        </div>
      </div>
      <p className="mt-2 text-micro text-ink-500 dark:text-ink-400" role="status">
        {matched.length / 2} / {step.pairs.length} {isDE ? 'Paare' : 'pairs'}
      </p>
    </section>
  );
}

function PairButton({
  text,
  state,
  disabled,
  onClick,
}: {
  text: string;
  state: 'idle' | 'picked' | 'matched' | 'wrong';
  disabled: boolean;
  onClick: () => void;
}) {
  const tone =
    state === 'matched'
      ? 'border-success-500 bg-success-50 opacity-70 dark:border-success-600 dark:bg-success-950/40'
      : state === 'picked'
        ? 'border-accent-500 bg-accent-50 dark:border-accent-600 dark:bg-accent-950/40'
        : state === 'wrong'
          ? 'border-danger-500 bg-danger-50 dark:border-danger-600 dark:bg-danger-950/40'
          : 'border-ink-300 hover:border-accent-500 dark:border-ink-700';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[44px] rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 ${tone}`}
    >
      {text}
    </button>
  );
}

/* ── dictation ────────────────────────────────────────────────────────────── */

export function DictationStepView({ step, onResult }: { step: DictationStep; onResult: StepResult }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [value, setValue] = useState('');
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    setValue('');
    setLocked(null);
  }, [step]);

  return (
    <section className={CARD} aria-label={isDE ? 'Diktat' : 'Dictation'}>
      <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{step.instruction ?? (isDE ? 'Schreibe, was du hörst.' : 'Type what you hear.')}</p>
      <div className="mt-2">
        <AudioButton word={step.text} lang="de" className="shrink-0" />
      </div>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (locked !== null) return;
          const ok = matchesAnswer(value, step.text);
          setLocked(ok);
          onResult(ok, value);
        }}
      >
        <label className="sr-only" htmlFor={`dictation-${step.text.slice(0, 20)}`}>
          {isDE ? 'Diktat' : 'Dictation'}
        </label>
        <input
          id={`dictation-${step.text.slice(0, 20)}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={locked !== null}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 disabled:opacity-70 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
        />
        {locked === null ? (
          <button
            type="submit"
            disabled={value.trim() === ''}
            className="mt-2 min-h-[44px] rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-50"
          >
            {isDE ? 'Prüfen' : 'Check'}
          </button>
        ) : (
          <div
            role="status"
            className={`mt-3 rounded-md border p-3 text-sm ${locked ? 'border-success-200 bg-success-50 dark:border-success-900 dark:bg-success-950/40' : 'border-danger-200 bg-danger-50 dark:border-danger-900 dark:bg-danger-950/40'}`}
          >
            <p className="font-semibold">{locked ? (isDE ? 'Richtig' : 'Correct') : isDE ? 'Nicht ganz' : 'Not quite'}</p>
            <p className="mt-1">
              {isDE ? 'Richtig wäre: ' : 'The answer is: '}
              <span className="font-semibold">{step.text}</span>
            </p>
          </div>
        )}
      </form>
    </section>
  );
}
