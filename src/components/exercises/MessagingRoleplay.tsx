/**
 * src/components/exercises/MessagingRoleplay.tsx
 *
 * Lesson Engine primitive — branching dialogue rendered as a SIMULATED
 * MESSAGING APP (WhatsApp/iMessage style).
 *
 * Mechanics:
 *  - NPC messages arrive as left-aligned gray bubbles; the learner replies via
 *    a quick-reply menu docked at the bottom of the chat.
 *  - Correct reply  -> blue bubble on the right, "typing…" indicator, then the
 *    next NPC bubble. +10 XP per correct socio-linguistic choice.
 *  - Wrong reply    -> bubble still sends, but an inline system note shows the
 *    feedback (`fb`) and the learner retries the same step; each uniquely-wrong
 *    step is queued ONCE into the SRS review queue via the shared reporter.
 *  - Scenario switcher chips above the chat; auto-scroll to newest message.
 *
 * Data: reuses the EXISTING `RoleplayScenario` curriculum type (no new datasets).
 * Design: theme.* classes, ≥44px targets, light/dark, haptics + audio FX.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { triggerHaptic } from '../../utils/haptic';
import { playCorrectFx, playWrongFx } from '../../utils/audioService';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import type { RoleplayScenario } from '../../types/curriculum';

interface MessagingRoleplayProps {
  scenarios: RoleplayScenario[];
  /** moduleType surfaced to XP + the review queue (default 'roleplay'). */
  module?: string;
}

/** One chat transcript entry. */
interface ChatEntry {
  id: string;
  from: 'npc' | 'me' | 'system';
  text: string;
}

export function MessagingRoleplay({ scenarios, module = 'roleplay' }: MessagingRoleplayProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();

  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [answeredWrong, setAnsweredWrong] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario = scenarios[scenarioIdx];
  const step = scenario?.steps[stepIdx];

  // Seed/reset the transcript when the scenario or position changes.
  useEffect(() => {
    if (!scenario) return;
    const seed: ChatEntry[] = [];
    for (let i = 0; i <= stepIdx && i < scenario.steps.length; i++) {
      seed.push({ id: `${scenario.id}-npc-${i}`, from: 'npc', text: scenario.steps[i].npc });
      if (i < stepIdx) {
        seed.push({
          id: `${scenario.id}-me-${i}`,
          from: 'me',
          text: scenario.steps[i].options.find((o) => o.ok)?.text ?? '',
        });
      }
    }
    setEntries(seed);
    setTyping(false);
    setAnsweredWrong(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioIdx]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [entries, typing]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const totalSteps = useMemo(
    () => scenarios.reduce((acc, s) => acc + s.steps.length, 0),
    [scenarios]
  );

  const choose = (optIndex: number) => {
    if (!scenario || !step || typing) return;
    const opt = step.options[optIndex];
    triggerHaptic('light');

    setEntries((prev) => [
      ...prev,
      { id: `${scenario.id}-me-${stepIdx}-${optIndex}-${Date.now()}`, from: 'me', text: opt.text },
    ]);

    if (opt.ok) {
      playCorrectFx();
      reportResult({
        correct: true,
        module,
        itemKey: `${scenario.id}:step${stepIdx}`,
        userAnswer: opt.text,
        correctAnswer: opt.text,
      });
      setTyping(true);
      const isLastStep = stepIdx === scenario.steps.length - 1;
      typingTimerRef.current = setTimeout(() => {
        setTyping(false);
        if (!isLastStep) {
          setStepIdx((s) => s + 1);
        }
        // On the last step the conversation simply ends (restart chip appears).
      }, 900);
    } else {
      playWrongFx();
      setAnsweredWrong(true);
      reportResult({
        correct: false,
        module,
        itemKey: `${scenario.id}:step${stepIdx}`,
        userAnswer: opt.text,
        correctAnswer: step.options.find((o) => o.ok)?.text ?? '',
      });
      setEntries((prev) => [
        ...prev,
        { id: `${scenario.id}-sys-${Date.now()}`, from: 'system', text: opt.fb },
      ]);
    }
  };

  const restartScenario = () => {
    setStepIdx(0);
    setEntries(
      scenario
        ? [{ id: `${scenario.id}-npc-0`, from: 'npc', text: scenario.steps[0].npc }]
        : []
    );
    setAnsweredWrong(false);
  };

  if (!scenario || !step) return null;

  const conversationComplete =
    stepIdx === scenario.steps.length - 1 &&
    entries.some((e) => e.from === 'me') &&
    !answeredWrong &&
    !typing &&
    entries.filter((e) => e.from === 'me').length >= scenario.steps.length;

  return (
    <div className={theme.panel.surface}>
      {/* Scenario picker */}
      <div className="mb-3 flex flex-wrap gap-2">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setScenarioIdx(i);
              setStepIdx(0);
            }}
            className={`inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
              i === scenarioIdx
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span aria-hidden="true">{s.emoji}</span> {s.title}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-lg dark:bg-blue-950/60"
            aria-hidden="true"
          >
            {scenario.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {scenario.title}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              {isDE ? 'online' : 'online'}
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {Math.min(stepIdx + 1, scenario.steps.length)}/{scenario.steps.length}
          </span>
        </div>

        {/* Message list */}
        <div ref={scrollRef} className="h-80 space-y-2 overflow-y-auto px-3 py-4 sm:h-96">
          {entries.map((entry) =>
            entry.from === 'system' ? (
              <div key={entry.id} className="flex justify-center">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-center text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  💡 {entry.text}
                </span>
              </div>
            ) : (
              <div
                key={entry.id}
                className={`flex ${entry.from === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                    entry.from === 'me'
                      ? 'rounded-br-md bg-blue-600 text-white'
                      : 'rounded-bl-md bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {entry.text}
                  <span
                    className={`mt-0.5 flex items-center justify-end gap-0.5 text-[10px] ${
                      entry.from === 'me' ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    {new Date().toLocaleTimeString(isDE ? 'de-DE' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {entry.from === 'me' && <CheckCheck className="h-3 w-3" aria-hidden="true" />}
                  </span>
                </div>
              </div>
            )
          )}

          {/* Typing indicator */}
          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm dark:bg-slate-800">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick-reply dock / completion state */}
        <div className="border-t border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
          {conversationComplete ? (
            <div className="flex flex-col items-center gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" aria-hidden="true" />
                {isDE ? 'Gespräch beendet!' : 'Conversation complete!'}
              </p>
              <button
                type="button"
                onClick={restartScenario}
                className={`${theme.button.secondary} min-h-[44px]`}
              >
                {isDE ? 'Nochmal spielen 🔄' : 'Play again 🔄'}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {isDE ? 'Antworten' : 'Quick replies'}
              </p>
              <div className="flex flex-col gap-2">
                {step.options.map((opt, i) => (
                  <button
                    key={`${opt.text}-${i}`}
                    type="button"
                    disabled={typing}
                    onClick={() => choose(i)}
                    className="min-h-[44px] rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-left text-sm font-semibold text-blue-900 transition hover:bg-blue-100 active:scale-95 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:bg-blue-900/50"
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress caption */}
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
        {isDE
          ? `${totalSteps} Nachrichten in ${scenarios.length} Gesprächen`
          : `${totalSteps} messages across ${scenarios.length} conversations`}
      </p>
    </div>
  );
}