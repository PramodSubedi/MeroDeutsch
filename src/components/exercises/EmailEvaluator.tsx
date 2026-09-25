/**
 * src/components/exercises/EmailEvaluator.tsx
 *
 * Lesson Engine primitive — Goethe A1 "Point Evaluator" (Phase D): the learner
 * acts as the examiner and grades a flawed sample student email rule by rule
 * (greeting register, comma/lowercase rule, mandatory points, closing). Wrong
 * judgments are queued to the SRS queue via the shared reporter (module
 * 'email-evaluator' → errorTag 'spelling'); a fully correct round pays +10 XP
 * once + confetti. Data: src/data/emailTemplates.ts (EVALUATION_ROUNDS).
 */

import { useEffect, useState } from 'react';
import { Check, ChevronRight, RefreshCw, X } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import {
  EVALUATION_ROUNDS,
  type EvaluationRound,
  type EvaluationRule,
} from '../../data/emailTemplates';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import { useXp } from '../../hooks/useXp';
import { triggerConfetti } from '../../utils/confetti';

type Verdict = 'met' | 'not';

const moduleType = 'email-evaluator';

function ruleJudgedRight(rule: EvaluationRule, verdict: Verdict | undefined): boolean {
  if (!verdict) return false;
  return (verdict === 'met') === rule.satisfied;
}

export function EmailEvaluator() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();
  const { reportAnswer } = useXp();

  const [roundIndex, setRoundIndex] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [score, setScore] = useState(0);
  const [awarded, setAwarded] = useState(false);

  const completed = roundIndex >= EVALUATION_ROUNDS.length;
  const round: EvaluationRound = EVALUATION_ROUNDS[roundIndex % EVALUATION_ROUNDS.length];
  const allJudged = !completed && Object.keys(verdicts).length === round.rules.length;
  const allCorrect =
    allJudged && round.rules.every((r) => ruleJudgedRight(r, verdicts[r.id]));

  // Award XP exactly once per fully-correct grading round.
  useEffect(() => {
    if (allJudged && allCorrect && !awarded) {
      setAwarded(true);
      triggerConfetti();
      reportAnswer({ correct: true, module: moduleType, amount: 10 });
    }
  }, [allJudged, allCorrect, awarded, reportAnswer]);

  const judge = (ruleId: string, v: Verdict) => {
    if (verdicts[ruleId] || allJudged) return;
    const rule = round.rules.find((r) => r.id === ruleId);
    if (!rule) return;
    setVerdicts((prev) => ({ ...prev, [ruleId]: v }));
    const right = (v === 'met') === rule.satisfied;
    if (right) {
      setScore((s) => s + 1);
    } else {
      reportResult({
        correct: false,
        module: moduleType,
        itemKey: `${round.id}:${ruleId}`,
        userAnswer: v === 'met' ? 'met' : 'not met',
        correctAnswer: rule.satisfied ? 'met' : 'not met',
      });
    }
  };

  const nextRound = () => {
    setRoundIndex((i) => i + 1);
    setVerdicts({});
    setAwarded(false);
  };

  const playAgain = () => {
    setRoundIndex(0);
    setVerdicts({});
    setScore(0);
    setAwarded(false);
  };
if (completed) {
    return (
      <div className={`${theme.panel.surface} mt-4`}>
        <h3 className="text-lg font-semibold text-ink-950 dark:text-white">
          {isDE ? 'Benotung beendet' : 'Grading complete'}
        </h3>
        <p className="mt-2 text-body text-ink-600 dark:text-ink-300">
          {isDE
            ? `${score} von ${EVALUATION_ROUNDS.length * EVALUATION_ROUNDS[0]!.rules.length} Einzelurteilen richtig.`
            : `${score} of ${EVALUATION_ROUNDS.length * EVALUATION_ROUNDS[0]!.rules.length} individual judgments correct.`}
        </p>
        <button type="button" onClick={playAgain} className={`${theme.button.secondary} mt-4 inline-flex min-h-[44px] items-center gap-1.5`}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {isDE ? 'Neue Runde' : 'New round'}
        </button>
      </div>
    );
  }

  return (
    <div className={`${theme.panel.surface} mt-4 space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-body font-bold text-ink-900 dark:text-white">
          {isDE ? round.title.de : round.title.en}
        </h3>
        <span className="text-body font-semibold text-ink-500 dark:text-ink-400">
          {roundIndex + 1}/{EVALUATION_ROUNDS.length} · {score}
        </span>
      </div>

      {/* Original exam task this student was given */}
      <div className={theme.panel.accent}>
        <p className="text-meta font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          {isDE ? 'Prüfungsaufgabe' : 'Exam task'}
        </p>
        <p className="mt-1 text-body text-ink-800 dark:text-ink-100">
          {isDE ? round.taskPrompt.de : round.taskPrompt.en}
        </p>
        {!isDE && round.taskPrompt.ne && (
          <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">{round.taskPrompt.ne}</p>
        )}
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
          round.expectedRegister === 'formal'
            ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'
            : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
        }`}>
          {round.expectedRegister === 'formal'
            ? isDE ? 'erwartet: formell' : 'expected: formal'
            : isDE ? 'erwartet: informell' : 'expected: informal'}
        </span>
      </div>

      {/* The flawed student submission */}
      <pre className="whitespace-pre-wrap rounded-lg border border-ink-200 bg-ink-50 p-4 font-sans text-body leading-6 text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
        {round.studentEmail}
      </pre>
{/* Line-item judges */}
      <div className="space-y-3">
        {round.rules.map((rule) => {
          const v = verdicts[rule.id];
          const judged = v !== undefined;
          const right = ruleJudgedRight(rule, v);
          return (
            <div key={rule.id} className={`rounded-md border p-3 text-body ${
              judged
                ? right
                  ? 'border-success-200 bg-success-50/60 dark:border-success-800/40 dark:bg-success-950/20'
                  : 'border-danger-200 bg-danger-50/60 dark:border-danger-800/40 dark:bg-danger-950/20'
                : 'border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900'
            }`}>
              <div className="font-semibold text-ink-800 dark:text-ink-100">
                {isDE ? rule.label.de : rule.label.en}
              </div>
              {!judged ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => judge(rule.id, 'met')} className={`${theme.button.secondarySmall} inline-flex min-h-[44px] items-center gap-1`}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {isDE ? 'Erfüllt' : 'Met'}
                  </button>
                  <button type="button" onClick={() => judge(rule.id, 'not')} className={`${theme.button.secondarySmall} inline-flex min-h-[44px] items-center gap-1`}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    {isDE ? 'Nicht erfüllt' : 'Not met'}
                  </button>
                </div>
              ) : (
                <p className={`mt-1.5 text-meta ${right ? 'text-success-700 dark:text-success-300' : 'text-danger-700 dark:text-danger-300'}`}>
                  {right
                    ? isDE ? `✓ Richtig beurteilt (${rule.satisfied ? 'erfüllt' : 'nicht erfüllt'})` : `✓ Judge correct (${rule.satisfied ? 'met' : 'not met'})`
                    : isDE ? `✗ Richtig wäre: ${rule.satisfied ? 'erfüllt' : 'nicht erfüllt'}` : `✗ Correct answer: ${rule.satisfied ? 'met' : 'not met'}`}
                  <span className="mt-0.5 block text-ink-500 dark:text-ink-400">
                    {isDE ? rule.hint.de : rule.hint.en}
                    {!isDE && rule.hint.ne && <span className="block">{rule.hint.ne}</span>}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {allJudged && (
        <button type="button" onClick={nextRound} className={`${theme.button.primary} w-full`}>
          {isDE ? 'Nächste Aufgabe →' : 'Next task →'}
          <ChevronRight className="inline h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}