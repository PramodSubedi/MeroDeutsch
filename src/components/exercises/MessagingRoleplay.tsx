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
import { Check, CheckCheck, Globe, Mic, Send, Volume2 } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { triggerHaptic } from '../../utils/haptic';
import { playCorrectFx, playWrongFx, speakGerman } from '../../utils/audioService';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import {
  useSpeechRecognition,
  isSpeechRecognitionSupported,
} from '../../hooks/useSpeechRecognition';
import type { RoleplayScenario, RoleplayOption } from '../../types/curriculum';

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
  /** Optional EN / NE helper rendered under an NPC bubble when translations are shown. */
  trans?: string;
}

export function MessagingRoleplay({ scenarios, module = 'roleplay' }: MessagingRoleplayProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();

  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  // Comprehension helper — reveal EN/NE under bubbles + options (hidden in Nur DE).
  const [showTrans, setShowTrans] = useState(false);
  // Scaffolding — the chip quick-replies (production input is the primary path).
  const [showChips, setShowChips] = useState(true);
  // Production input — typed or spoken German answer.
  const [freeInput, setFreeInput] = useState('');
  // Session summary tracking (reset on restart / new scenario).
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speech = useSpeechRecognition({
    lang: 'de-DE',
    onResult: (t) => setFreeInput(t.trim()),
  });
  const speechSupported = useMemo(isSpeechRecognitionSupported, []);

  /** Speak a text on explicit tap — never auto (avoids spoiling the answer). */
  const speak = (text: string) => {
    if (text) speakGerman(text);
  };

  /** Case/accent/punctuation-insensitive normalization for matching. */
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:„“”"«»()…]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  /** Dice coefficient over character bigrams — simple fuzzy similarity. */
  const similarity = (a0: string, b0: string): number => {
    const a = normalize(a0);
    const b = normalize(b0);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const bigrams = (s: string) => {
      const out = new Map<string, number>();
      for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        out.set(g, (out.get(g) ?? 0) + 1);
      }
      return out;
    };
    const ga = bigrams(a);
    const gb = bigrams(b);
    let inter = 0;
    for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0);
    const total = ga.size + gb.size;
    return total === 0 ? 0 : (2 * inter) / total;
  };

  /** Accepts exact (normalized) match, a solid fuzzy match, or containment. */
  const matches = (input: string, target: string): boolean => {
    const a = normalize(input);
    const b = normalize(target);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 4 && (a.includes(b) || b.includes(a))) return true;
    return similarity(a, b) >= 0.72;
  };

  const scenario = scenarios[scenarioIdx];
  const step = scenario?.steps[stepIdx];

  // Seed/reset the transcript when the scenario or position changes.
  useEffect(() => {
    if (!scenario) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    const seed: ChatEntry[] = [];
    for (let i = 0; i <= stepIdx && i < scenario.steps.length; i++) {
      const st = scenario.steps[i];
      // Learner-initiated opening step: no NPC bubble — the learner speaks first.
      if (i === 0 && st.from === 'me') {
        continue;
      }
      seed.push({
        id: `${scenario.id}-npc-${i}`,
        from: 'npc',
        text: st.npc,
        trans: st.npcEn,
      });
      if (i < stepIdx) {
        seed.push({
          id: `${scenario.id}-me-${i}`,
          from: 'me',
          text: st.options.find((o) => o.ok)?.text ?? '',
        });
      }
    }
    setEntries(seed);
    setTyping(false);
    setConversationComplete(false);
    setCorrectCount(0);
    setWrongCount(0);
    setFreeInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioIdx, scenario]);

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

  const handleWrong = (opt: RoleplayOption, userText: string) => {
    playWrongFx();
    triggerHaptic('error');
    setWrongCount((c) => c + 1);
    reportResult({
      correct: false,
      module,
      itemKey: `${scenario!.id}:step${stepIdx}`,
      userAnswer: userText,
      correctAnswer: step!.options.find((o) => o.ok)?.text ?? '',
    });
    const adds: ChatEntry[] = [
      { id: `${scenario!.id}-me-${stepIdx}-wrong-${Date.now()}`, from: 'me', text: userText },
      { id: `${scenario!.id}-sys-${Date.now()}`, from: 'system', text: opt.fb },
    ];
    // Branching-lite: the NPC reacts to what was actually said, even when off.
    if (opt.reaction) {
      adds.push({
        id: `${scenario!.id}-react-${Date.now()}`,
        from: 'npc',
        text: opt.reaction,
        trans: opt.reactionEn,
      });
    }
    setEntries((prev) => [...prev, ...adds]);
  };

  /** Shared correct path: chime, report, then deliver the NPC's next line. */
  const handleCorrect = (opt: RoleplayOption, userText = opt.text) => {
    if (!scenario || !step || typing) return;
    playCorrectFx();
    triggerHaptic('light');
    setConversationComplete(false);
    setCorrectCount((c) => c + 1);

    const adds: ChatEntry[] = [
      {
        id: `${scenario.id}-me-${stepIdx}-ok-${Date.now()}`,
        from: 'me',
        text: userText,
      },
    ];
    // Branching-lite: a distinct NPC reaction to THIS exact choice.
    if (opt.reaction) {
      adds.push({
        id: `${scenario.id}-react-${Date.now()}`,
        from: 'npc',
        text: opt.reaction,
        trans: opt.reactionEn,
      });
    }
    setEntries((prev) => [...prev, ...adds]);

    reportResult({
      correct: true,
      module,
      itemKey: `${scenario.id}:step${stepIdx}`,
      userAnswer: userText,
      correctAnswer: opt.text,
    });

    // Route to the option's target step (branching) or advance linearly.
    const target = typeof opt.next === 'number' ? opt.next : stepIdx + 1;
    setTyping(true);
    const isLastStep = target >= scenario.steps.length;
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      if (!isLastStep) {
        // Deliver the NPC's next line BEFORE opening the new replies, so the
        // conversation never looks one-sided.
        const next = scenario.steps[target];
        setEntries((prev) => [
          ...prev,
          { id: `${scenario.id}-npc-${target}`, from: 'npc', text: next.npc, trans: next.npcEn },
        ]);
        setStepIdx(target);
        setTyping(false);
      } else if (scenario.closing) {
        // Let the NPC say goodbye before revealing the completion state.
        setEntries((prev) => [
          ...prev,
          { id: `${scenario.id}-npc-close`, from: 'npc', text: scenario.closing as string },
        ]);
        typingTimerRef.current = setTimeout(() => {
          typingTimerRef.current = null;
          setTyping(false);
          setConversationComplete(true);
        }, 900);
      } else {
        setTyping(false);
        setConversationComplete(true);
      }
      // On the last step without a closing line the conversation simply ends
      // (summary appears).
    }, 900);
  };

  /** Chip answer. */
  const choose = (optIndex: number) => {
    if (!scenario || !step || typing) return;
    const opt = step.options[optIndex];
    triggerHaptic('light');
    if (opt.ok) {
      handleCorrect(opt);
    } else {
      handleWrong(opt, opt.text);
    }
  };

  /** Submitted free-form answer — typed OR spoken. */
  const submitFree = (raw?: string) => {
    if (!scenario || !step || typing) return;
    const text = (raw ?? freeInput).trim();
    if (!text) return;
    triggerHaptic('light');
    const matchedOption = step.options.find((option) => option.ok && matches(text, option.text));
    if (matchedOption) {
      setFreeInput('');
      handleCorrect(matchedOption, text);
      return;
    }
    // Not the target — route to the closest distractor's feedback so the hint is relevant.
    const nearest = [...step.options]
      .filter((o) => !o.ok)
      .sort((a, b) => similarity(text, b.text) - similarity(text, a.text))[0];
    handleWrong(nearest ?? {
      text: '',
      ok: false,
      fb: isDE ? 'Versuche eine andere Formulierung.' : 'Try rephrasing your answer.',
    }, text);
    setFreeInput('');
  };

  const restartScenario = () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    speech.stop();
    setStepIdx(0);
    setEntries(
      scenario
        ? scenario.steps[0].from === 'me'
          ? [] // learner initiates — no opening NPC bubble
          : [
              {
                id: `${scenario.id}-npc-0`,
                from: 'npc',
                text: scenario.steps[0].npc,
                trans: scenario.steps[0].npcEn,
              },
            ]
        : []
    );
    setConversationComplete(false);
    setCorrectCount(0);
    setWrongCount(0);
    setFreeInput('');
  };

  if (!scenario || !step) return null;

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
            disabled={typing || speech.listening}
            aria-current={i === scenarioIdx ? 'step' : undefined}
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 py-1.5 text-meta font-semibold transition active:scale-95 ${
              i === scenarioIdx
                ? 'bg-accent-600 text-white shadow-sm'
                : 'border border-ink-200 bg-white text-ink-600 hover:border-accent-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300'
            }`}
          >
            <span aria-hidden="true">{s.emoji}</span> {s.title}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-ink-200 bg-ink-100 shadow-sm dark:border-ink-700 dark:bg-ink-950">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-lg dark:bg-accent-950/60"
            aria-hidden="true"
          >
            {scenario.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-body font-bold text-ink-900 dark:text-white">
              {scenario.title}
            </div>
            <div className="text-meta text-success-600 dark:text-success-400">
              {isDE ? 'online' : 'online'}
            </div>
          </div>
          <span className="text-meta font-semibold text-ink-500">
            {Math.min(stepIdx + 1, scenario.steps.length)}/{scenario.steps.length}
          </span>
          {!isDE && (
            <button
              type="button"
              onClick={() => setShowTrans((v) => !v)}
              aria-pressed={showTrans}
              aria-label={isDE ? 'Übersetzung' : 'Toggle translations'}
              className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 py-1 text-meta font-semibold transition active:scale-95 ${
                showTrans
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'border border-ink-200 bg-white text-ink-500 hover:border-accent-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300'
              }`}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {isDE ? 'ÜB' : showTrans ? 'EN' : 'EN'}
            </button>
          )}
        </div>

        {/* Grammar / level chip (inherited from the target card) */}
        {(step.grammarFocus || step.cefrLevel || scenario.roleFlip) && !conversationComplete && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-200 bg-ink-50 px-3 py-2 dark:border-ink-700 dark:bg-ink-900/60">
            {scenario.roleFlip && (
              <span
                className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700 dark:bg-accent-950/60 dark:text-accent-200"
                title={isDE ? 'Rollenwechsel: Du sprichst zuerst!' : 'Role flip: you speak first!'}
              >
                🎭 {isDE ? 'Du beginnst' : 'You start'}
              </span>
            )}
            {step.grammarFocus && (
              <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700 dark:bg-accent-950/60 dark:text-accent-200">
                ✦ {step.grammarFocus}
              </span>
            )}
            {step.cefrLevel && (
              <span className="rounded-full bg-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                {step.cefrLevel}
              </span>
            )}
          </div>
        )}

        {!conversationComplete && (
          <div className="border-b border-ink-200 bg-white px-3 py-2.5 dark:border-ink-700 dark:bg-ink-900">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-500">
              {step.from === 'me'
                ? (isDE ? 'Dein Gesprächseinstieg' : 'Your opening line')
                : (isDE ? 'Deine Aufgabe' : 'Your task')}
            </p>
            <p className="mt-0.5 text-body font-medium leading-5 text-ink-700 dark:text-ink-200">
              {step.prompt}
            </p>
          </div>
        )}

        {/* Message list */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={isDE ? 'Gesprächsverlauf' : 'Conversation transcript'}
          className="h-80 space-y-2 overflow-y-auto px-3 py-4 sm:h-96"
        >
          {entries.map((entry) =>
            entry.from === 'system' ? (
              <div key={entry.id} className="flex justify-center">
                <span className="rounded-full bg-warning-100 px-3 py-1 text-center text-meta font-medium text-warning-800 dark:bg-warning-950/50 dark:text-warning-200">
                  💡 {entry.text}
                </span>
              </div>
            ) : (
              <div
                key={entry.id}
                className={`flex ${entry.from === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3.5 py-2 text-body leading-relaxed shadow-sm ${
                    entry.from === 'me'
                      ? 'rounded-br-md bg-accent-600 text-white'
                      : 'rounded-bl-md border border-ink-200 bg-white text-ink-800 dark:bg-ink-800 dark:border-ink-800 dark:text-ink-100'
                  }`}
                >
                  {entry.from === 'npc' && (
                    <button
                      type="button"
                      onClick={() => speak(entry.text)}
                      aria-label={isDE ? 'Diesen Satz anhören' : 'Hear this line'}
                      className={`mb-1.5 mr-1 inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition active:scale-95 ${
                        isDE
                          ? 'bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-400'
                          : 'bg-accent-50 text-accent-600 dark:bg-accent-900/50 dark:text-accent-300'
                      }`}
                    >
                      <Volume2 className="h-3 w-3" aria-hidden="true" />
                      {isDE ? 'Anhören' : 'Listen'}
                    </button>
                  )}
                  {entry.text}
                  {!isDE && showTrans && entry.from === 'npc' && entry.trans && (
                    <span className="mt-1 block border-t border-ink-200 pt-1 text-[11px] italic text-ink-500 dark:border-ink-700 dark:text-ink-400">
                      {entry.trans}
                    </span>
                  )}
                  <span
                    className={`mt-0.5 flex items-center justify-end gap-0.5 text-[10px] ${
                      entry.from === 'me' ? 'text-accent-200' : 'text-ink-500'
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
              <div className="flex items-center gap-1 rounded-lg rounded-bl-md border border-ink-200 bg-white px-4 py-3 shadow-sm dark:bg-ink-800 dark:border-ink-800">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick-reply dock / completion state */}
        <div className="border-t border-ink-200 bg-white px-3 py-3 dark:border-ink-700 dark:bg-ink-900">
          {conversationComplete ? (
            <div className="flex flex-col items-center gap-3 px-2 py-1">
              <p className="flex items-center gap-1.5 text-body font-semibold text-success-700 dark:text-success-300">
                <Check className="h-4 w-4" aria-hidden="true" />
                {isDE ? 'Gespräch beendet!' : 'Conversation complete!'}
              </p>
              {/* Session summary */}
              <div className="grid w-full grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-success-50 px-2 py-2 dark:bg-success-950/40">
                  <div className="text-lg font-bold text-success-700 dark:text-success-300">{correctCount}</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    {isDE ? 'Richtig' : 'Correct'}
                  </div>
                </div>
                <div className="rounded-lg bg-danger-50 px-2 py-2 dark:bg-danger-950/40">
                  <div className="text-lg font-bold text-danger-600 dark:text-danger-300">{wrongCount}</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    {isDE ? 'Falsch' : 'Wrong'}
                  </div>
                </div>
                <div className="rounded-lg bg-ink-100 px-2 py-2 dark:bg-ink-800">
                  <div className="text-lg font-bold text-ink-800 dark:text-ink-100">
                    {scenario.steps.length}
                  </div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    {isDE ? 'Schritte' : 'Steps'}
                  </div>
                </div>
              </div>
              {wrongCount > 0 && (
                <p className="text-center text-meta text-ink-500 dark:text-ink-400">
                  {isDE
                    ? 'Solche Sätze findest du jetzt in deiner Wiederholungsliste.'
                    : 'Words you missed are in your review queue to revisit later.'}
                </p>
              )}
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
              {/* Production input: type or speak your own German answer. */}
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={freeInput}
                  onChange={(e) => setFreeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitFree();
                  }}
                  disabled={typing}
                  placeholder={isDE ? 'Tippe deine Antwort…' : 'Type your German answer…'}
                  aria-label={isDE ? 'Deine Antwort' : 'Your answer'}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-3.5 text-body text-ink-900 placeholder:text-ink-500 focus:border-accent-500 focus:outline-none disabled:opacity-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100"
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={() => (speech.listening ? speech.stop() : speech.start())}
                    disabled={typing}
                    aria-label={isDE ? 'Sprich deine Antwort' : 'Speak your answer'}
                    aria-pressed={speech.listening}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50 ${
                      speech.listening
                        ? 'bg-danger-500 text-white shadow'
                        : 'border border-ink-300 bg-white text-ink-600 hover:border-accent-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200'
                    }`}
                  >
                    <Mic className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => submitFree()}
                  disabled={typing || !freeInput.trim()}
                  aria-label={isDE ? 'Antwort senden' : 'Send answer'}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-600 text-white shadow transition hover:bg-accent-700 active:scale-95 disabled:opacity-40"
                >
                  <Send className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {speech.listening && (
                <p className="mb-1 px-1 text-meta font-medium text-danger-500">
                  {isDE ? 'Höre zu…' : 'Listening…'}
                </p>
              )}
              {!speech.listening && speech.status !== 'Ready to listen.' && speech.status !== 'Stopped.' && (
                <p role="status" className="mb-1 px-1 text-meta font-medium text-warning-700 dark:text-warning-300">
                  {speech.status}
                </p>
              )}

              {/* Chips are an optional scaffold — production input is the primary path. */}
              <div className="mb-2 flex items-center justify-between">
                <p className="px-1 text-meta font-semibold uppercase tracking-[0.18em] text-ink-500">
                  {isDE ? 'Schnellantworten' : 'Quick replies'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowChips((v) => !v)}
                  aria-pressed={showChips}
                  className="min-h-[44px] rounded-full px-2.5 text-meta font-semibold text-accent-600 underline-offset-2 hover:underline dark:text-accent-300"
                >
                  {showChips ? (isDE ? 'Ausblenden' : 'Hide options') : (isDE ? 'Zeigen' : 'Show options')}
                </button>
              </div>
              {showChips && (
                <div className="flex flex-col gap-2">
                  {step.options.map((opt, i) => (
                    <div key={`${opt.text}-${i}`} className="flex items-stretch gap-1.5">
                      <button
                        type="button"
                        disabled={typing}
                        onClick={() => choose(i)}
                        className="min-h-[44px] flex-1 rounded-lg border border-accent-200 bg-accent-50/70 px-4 py-2.5 text-left text-body font-semibold text-accent-900 transition hover:bg-accent-100 active:scale-95 disabled:opacity-50 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-100 dark:hover:bg-accent-900/50"
                      >
                        {opt.text}
                        {!isDE && showTrans && (opt.en || opt.ne) && (
                          <span className="mt-0.5 block text-[11px] font-normal text-ink-500 dark:text-ink-400">
                            {opt.en ?? opt.ne}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => !opt.ok && speak(opt.text)}
                        disabled={typing || opt.ok}
                        aria-label={
                          opt.ok
                            ? isDE
                              ? 'Richtige Antwort — noch nicht offenbart'
                              : 'Correct answer — hidden until chosen'
                            : isDE
                              ? 'Anhören'
                              : 'Hear this option'
                        }
                        className="inline-flex min-h-[44px] w-11 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500 transition hover:border-accent-300 hover:text-accent-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300"
                      >
                        <Volume2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress caption */}
      <p className="mt-3 text-center text-meta text-ink-500 dark:text-ink-400">
        {isDE
          ? `${totalSteps} Nachrichten in ${scenarios.length} Gesprächen`
          : `${totalSteps} messages across ${scenarios.length} conversations`}
      </p>
    </div>
  );
}