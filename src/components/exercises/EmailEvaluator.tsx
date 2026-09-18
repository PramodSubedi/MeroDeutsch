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
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
          {isDE ? 'Benotung beendet' : 'Grading complete'}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
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
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {isDE ? round.title.de : round.title.en}
        </h3>
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {roundIndex + 1}/{EVALUATION_ROUNDS.length} · {score}
        </span>
      </div>

      {/* Original exam task this student was given */}
      <div className={theme.panel.accent}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {isDE ? 'Prüfungsaufgabe' : 'Exam task'}
        </p>
        <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">
          {isDE ? round.taskPrompt.de : round.taskPrompt.en}
        </p>
        {!isDE && round.taskPrompt.ne && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{round.taskPrompt.ne}</p>
        )}
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
          round.expectedRegister === 'formal'
            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        }`}>
          {round.expectedRegister === 'formal'
            ? isDE ? 'erwartet: formell' : 'expected: formal'
            : isDE ? 'erwartet: informell' : 'expected: informal'}
        </span>
      </div>

      {/* The flawed student submission */}
      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {round.studentEmail}
      </pre>
{/* Line-item judges */}
      <div className="space-y-3">
        {round.rules.map((rule) => {
          const v = verdicts[rule.id];
          const judged = v !== undefined;
          const right = ruleJudgedRight(rule, v);
          return (
            <div key={rule.id} className={`rounded-xl border p-3 text-sm ${
              judged
                ? right
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                  : 'border-rose-200 bg-rose-50/60 dark:border-rose-800/40 dark:bg-rose-950/20'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
            }`}>
              <div className="font-semibold text-slate-800 dark:text-slate-100">
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
                <p className={`mt-1.5 text-xs ${right ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {right
                    ? isDE ? `✓ Richtig beurteilt (${rule.satisfied ? 'erfüllt' : 'nicht erfüllt'})` : `✓ Judge correct (${rule.satisfied ? 'met' : 'not met'})`
                    : isDE ? `✗ Richtig wäre: ${rule.satisfied ? 'erfüllt' : 'nicht erfüllt'}` : `✗ Correct answer: ${rule.satisfied ? 'met' : 'not met'}`}
                  <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
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