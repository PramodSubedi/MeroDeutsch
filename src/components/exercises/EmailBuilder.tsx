/**
 * src/components/exercises/EmailBuilder.tsx
 *
 * Lesson Engine primitive — Goethe A1 "Schreiben" guided email builder
 * (NotebookLM exam-prep mechanic). Learners pick a task (Einladung, Zusage,
 * Absage, Termin verschieben), then assemble the email step by step:
 * greeting → 3 mandatory content points → closing. Every step is a
 * Redemittel-chip choice; the correct chip matches the task's register
 * (informal vs formal) and content requirements. Wrong picks flash red and
 * are queued to the SRS review queue via the shared reporter (module
 * 'email-builder'); a completed email pays +25 XP once + confetti, then the
 * model answer and Redemittel glossary are revealed.
 *
 * Data: src/data/emailTemplates.ts (hand-verified tasks — NOT a DB seed).
 * Nur DE (C1.5): EN/NE helper lines hidden; the German chips stay playable.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import {
  EMAIL_TASKS,
  type EmailChoice,
  type EmailTask,
} from '../../data/emailTemplates';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import { useXp } from '../../hooks/useXp';
import { triggerConfetti } from '../../utils/confetti';

export function EmailBuilder() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();
  const { reportAnswer } = useXp();

  const [task, setTask] = useState<EmailTask>(EMAIL_TASKS[0]);
  const [started, setStarted] = useState(false);
  /** 0 = greeting, 1..3 = content points, 4 = closing, 5 = review. */
  const [stepIndex, setStepIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<{ key: string; wrongChoice?: string } | null>(null);
  const [awarded, setAwarded] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear pending advance/flash timers on unmount (React 19 no-ops stale
  // setState, but explicit cleanup keeps the surface leak-free).
  useEffect(() => () => { timersRef.current.forEach((t) => clearTimeout(t)); }, []);

  const steps = useMemo<string[]>(
    () => ['greeting', ...task.points.map((p) => p.id), 'closing'],
    [task]
  );

  const choicesFor = (key: string): EmailChoice[] => {
    if (key === 'greeting') return task.greetingOptions;
    if (key === 'closing') return task.closingOptions;
    return task.points.find((p) => p.id === key)?.choices ?? [];
  };

  const correctFor = (key: string): string => {
    const list = choicesFor(key);
    return (list.find((c) => c.correct) ?? list[0]).de;
  };

  const startTask = (t: EmailTask) => {
    setTask(t);
    setStarted(true);
    setStepIndex(0);
    setPicks({});
    setFlash(null);
    setAwarded(false);
  };

  const backToPicker = () => {
    setStarted(false);
    setStepIndex(0);
    setPicks({});
    setFlash(null);
    setAwarded(false);
  };

  const retrySameTask = () => startTask(task);

  const pick = (key: string, choice: EmailChoice) => {
    if (picks[key] || flash) return;
    if (choice.correct === true) {
      setPicks((prev) => ({ ...prev, [key]: choice.de }));
      setFlash(null);
      const isLast = key === 'closing';
      timersRef.current.push(
        setTimeout(() => {
          setFlash(null);
          setStepIndex((s) => Math.min(s + 1, steps.length));
          if (isLast && !awarded) {
            setAwarded(true);
            triggerConfetti();
            reportAnswer({ correct: true, module: 'email-builder', amount: 25 });
          }
        }, 500)
      );
    } else {
      setFlash({ key, wrongChoice: choice.de });
      reportResult({
        correct: false,
        module: 'email-builder',
        itemKey: `${task.id}:${key}`,
        userAnswer: choice.de,
        correctAnswer: correctFor(key),
      });
      timersRef.current.push(setTimeout(() => setFlash(null), 1400));
    }
  };

  const stepKey = steps[stepIndex];
  const currentPoint = task.points.find((p) => p.id === stepKey);
  const review = stepIndex >= steps.length;

  /** The assembled email (only picked lines, in exam order). */
  const assembled = useMemo(() => {
    const lines: string[] = [];
    if (picks.greeting) lines.push(picks.greeting);
    for (const p of task.points) if (picks[p.id]) lines.push(picks[p.id]);
    if (picks.closing) lines.push(picks.closing);
    return lines.join('\n');
  }, [picks, task]);

  if (!started) {
    return (
      <div className="space-y-4">
        <p className="text-body text-ink-500 dark:text-ink-400">
          {isDE ? 'Wähle eine Prüfungsaufgabe:' : 'Choose an exam task:'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {EMAIL_TASKS.map((t) => (
            <div key={t.id} className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
              <div className="flex items-center justify-between">
                <h3 className="text-body font-bold text-ink-900 dark:text-white">
                  {isDE ? t.title.de : t.title.en}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    t.recipient.formal
                      ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'
                      : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
                  }`}
                >
                  {t.recipient.formal ? (isDE ? 'formell' : 'formal') : isDE ? 'informell' : 'informal'}
                </span>
              </div>
              <p className="mt-2 text-meta leading-5 text-ink-600 dark:text-ink-300">
                {isDE ? t.prompt.de : t.prompt.en}
              </p>
              {!isDE && <p className="mt-1 text-meta text-ink-500 dark:text-ink-500">{t.prompt.ne}</p>}
              <button
                type="button"
                onClick={() => startTask(t)}
                className={`${theme.button.primary} mt-3 w-full`}
              >
                {isDE ? 'Aufgabe starten' : 'Start task'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task header + progress */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-body font-bold text-ink-900 dark:text-white">
            {isDE ? task.title.de : task.title.en}
          </h3>
          <p className="text-meta text-ink-500 dark:text-ink-400">
            {isDE ? 'Empfänger: ' : 'Recipient: '}
            <span className="font-semibold text-ink-700 dark:text-ink-200">{task.recipient.name}</span>
            {task.recipient.formal
              ? isDE ? ' (formell — Sie)' : ' (formal — Sie)'
              : isDE ? ' (informell — du)' : ' (informal — du)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-meta font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            {Math.min(stepIndex + 1, steps.length)}/{steps.length}
          </span>
          <button type="button" onClick={retrySameTask} className={theme.button.secondarySmall}>
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
            {isDE ? 'Neu' : 'Restart'}
          </button>
          <button type="button" onClick={backToPicker} className={theme.button.secondarySmall}>
            {isDE ? 'Aufgaben' : 'Tasks'}
          </button>
        </div>
      </div>

      {/* Task prompt (trilingual; EN/NE hidden in Nur DE) */}
      <div className={theme.panel.accent}>
        <p className="text-body font-semibold text-ink-800 dark:text-ink-100">
          {isDE ? task.prompt.de : task.prompt.en}
        </p>
        {!isDE && <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">{task.prompt.ne}</p>}
      </div>

      {/* Completed steps checklist */}
      {stepIndex > 0 && (
        <div className="flex flex-wrap gap-2">
          {steps.slice(0, stepIndex).map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-meta font-semibold text-success-700 dark:bg-success-950/40 dark:text-success-300"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              {picks[key]}
            </span>
          ))}
        </div>
      )}

      {!review && (
        <div className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-body font-bold text-ink-800 dark:text-ink-100">
              {stepKey === 'greeting'
                ? isDE ? '1. Anrede' : '1. Greeting'
                : stepKey === 'closing'
                  ? isDE ? '5. Grußformel' : '5. Closing'
                  : `${stepIndex + 1}. ${isDE ? currentPoint?.label.de : currentPoint?.label.en}`}
            </h4>
            <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden="true" />
          </div>
          <div className="grid gap-2">
            {choicesFor(stepKey).map((choice) => {
              const isChosen = picks[stepKey] === choice.de;
              const isWrongFlash = flash?.key === stepKey && flash.wrongChoice === choice.de;
              const cls = isChosen
                ? 'border-success-400 bg-success-50 text-success-900 dark:border-success-700 dark:bg-success-950/40 dark:text-success-200'
                : isWrongFlash
                  ? 'border-danger-400 bg-danger-50 text-danger-900 dark:border-danger-700 dark:bg-danger-950/40 dark:text-danger-200'
                  : 'border-ink-200 bg-white text-ink-800 hover:border-accent-400 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100';
              return (
                <button
                  key={choice.de}
                  type="button"
                  disabled={isChosen || flash !== null}
                  onClick={() => pick(stepKey, choice)}
                  className={`min-h-[44px] rounded-md border px-4 py-2.5 text-left text-body font-semibold transition active:scale-95 disabled:opacity-80 ${cls}`}
                >
                  {choice.de}
                  {!isDE && choice.en && (
                    <span className="mt-0.5 block text-meta font-normal text-ink-500 dark:text-ink-400">
                      {choice.en}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Review: assembled email vs model + Redemittel glossary */}
      {review && (
        <div className="space-y-4">
          <div className="rounded-lg border border-success-200 bg-success-50/60 p-4 dark:border-success-800/40 dark:bg-success-950/20">
            <h4 className="mb-2 text-body font-bold text-success-700 dark:text-success-300">
              🎉 {isDE ? 'Deine E-Mail (+25 XP)' : 'Your email (+25 XP)'}
            </h4>
            <pre className="whitespace-pre-wrap font-sans text-body leading-6 text-ink-800 dark:text-ink-100">
              {assembled}
            </pre>
          </div>
          <div className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
            <h4 className="mb-2 text-body font-bold text-ink-800 dark:text-ink-100">
              {isDE ? 'Musterlösung' : 'Model answer'}
            </h4>
            <pre className="whitespace-pre-wrap font-sans text-body leading-6 text-ink-600 dark:text-ink-300">
              {task.model}
            </pre>
            <h4 className="mb-1 mt-4 text-body font-bold text-ink-800 dark:text-ink-100">
              {isDE ? 'Redemittel' : 'Key phrases'}
            </h4>
            <ul className="space-y-1 text-meta text-ink-600 dark:text-ink-300">
              {task.vocabulary.map((v) => (
                <li key={v.de}>
                  <span className="font-semibold text-ink-800 dark:text-ink-100">{v.de}</span>
                  {!isDE && <> — {v.en} · {v.ne}</>}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={retrySameTask} className={`${theme.button.secondary} flex-1`}>
              {isDE ? 'Nochmal üben' : 'Practice again'}
            </button>
            <button type="button" onClick={backToPicker} className={`${theme.button.primary} flex-1`}>
              {isDE ? 'Nächste Aufgabe' : 'Next task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}