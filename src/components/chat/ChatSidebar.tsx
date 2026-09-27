/**
 * src/components/chat/ChatSidebar.tsx — the contextual companion panel.
 *
 * SEND PIPELINE (the whole feature, in one function)
 * ---------------------------------------------------
 *   classifyIntent → optional vocab lookup → handleIntent → buildSystemPrompt
 *   → streamChat → patch the streaming bubble
 *
 * Every step is swappable because each one is a pure module. The two that are
 * NOT skippable are the grounding (`handleIntent`) and the offline path.
 *
 * WHY IT IS CLOSED BY DEFAULT
 * ---------------------------
 * It mounts on learn/practice/checkpoint routes, which includes active quizzes
 * (`/rapid-fire`, `/checkpoint/:i`, `/articles`). A panel that expands itself
 * mid-question would be exactly the interruption `.clinerules` C2.7 forbids, so
 * it starts collapsed and the learner opens it deliberately — button or
 * Ctrl/Cmd+K. Nothing auto-opens it.
 *
 * Z-ORDER
 * -------
 * `z-[55]` for the panel: above the sticky header (z-50) so it is not clipped,
 * below the milestone/level-up toast (z-[60]) so XP and streak toasts are
 * never hidden behind a chat drawer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, WifiOff } from 'lucide-react';

import { useLearningContext } from '../../context/LearningContext';
import { useChatbotTriggers } from '../../hooks/useChatbotTriggers';
import { useChatStore, nextMessageId, type QuizSession } from '../../lib/chatStore';
import { classifyIntent, extractQuotedTerm } from '../../lib/intentRouter';
import { classifyWithModel } from '../../lib/intentModel';
import { followUpsFor, handleIntent } from '../../lib/responseHandlers';
import { lookupVocab, type VocabHit } from '../../lib/vocabLookup';
import { buildPracticeDeck, isAnswerCorrect } from '../../lib/chatPractice';
import { buildPageContext } from '../../lib/pageContext';
import { buildReport } from '../../lib/weeklyReport';
import { parseCommand, COMMAND_HELP } from '../../lib/slashCommands';
import { setDailySessionActive } from '../../lib/dailySessionSignal';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import { triggerConfetti } from '../../utils/confetti';
import { streamChat, OllamaError, type WireMessage } from '../../lib/ollamaClient';
import { healthCheck } from '../../lib/ollamaHealth';
import {
  buildSystemPrompt,
  buildUserPrompt,
  recentHistory,
} from '../../lib/promptBuilder';
import {
  advanceConversation,
  levelForContext,
} from '../../lib/conversationManager';
import { CHATBOT_CONFIG, isLearningRoute } from '../../config/chatbot';
import type { Intent } from '../../types/chatbot';

import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { OnboardingCard, QuizCard } from './payloads';

/** Starter prompts — chosen to exercise the intents that read real data. */
function suggestions(isDE: boolean): string[] {
  return isDE
    ? ['Wie weit bin ich?', 'Was sollte ich üben?', 'Wo bin ich im Kurs?', 'Warum war das falsch?']
    : ['How am I doing?', 'What should I practise?', 'Where am I in the course?', 'Why was I wrong?'];
}

/** End-of-round summary, from the results already recorded. */
function quizSummary(quiz: QuizSession | null, isDE: boolean): string {
  const results = quiz?.results ?? [];
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const headline = isDE
    ? `**Runde beendet — ${correct}/${total} richtig.**`
    : `**Round complete — ${correct}/${total} correct.**`;
  if (correct === total && total > 0) {
    return `${headline} ${isDE ? 'Perfekt! 🦉' : 'Perfect! 🦉'}`;
  }
  if (correct === 0) {
    return `${headline} ${isDE ? 'Frag mich nach der Regel — ich erkläre sie dir.' : 'Ask me for the rule and I will explain it.'}`;
  }
  return `${headline} ${isDE ? 'Die Fehler sind in deiner Warteschlange.' : 'Your misses are in the review queue.'}`;
}

export function ChatSidebar() {
  const { snapshot, navigateTo } = useLearningContext();
  const { pathname } = useLocation();

  const open = useChatStore((s) => s.open);
  const setOpen = useChatStore((s) => s.setOpen);
  const messages = useChatStore((s) => s.messages);
  const settings = useChatStore((s) => s.settings);
  const status = useChatStore((s) => s.status);
  const setStatus = useChatStore((s) => s.setStatus);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const mood = useChatStore((s) => s.mood);
  const conversation = useChatStore((s) => s.conversation);
  const setConversation = useChatStore((s) => s.setConversation);
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);
  const pendingPrompt = useChatStore((s) => s.pendingPrompt);
  const quiz = useChatStore((s) => s.quiz);
  // The live drill question. Declared with the other selectors — a hook below
  // the early `return null` would change hook order as the route changes.
  const activeQuestion = useChatStore((s) => s.quiz?.deck[s.quiz.index] ?? null);
  const [helpOpen, setHelpOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDE = snapshot.isDE;
  const enabled = settings.enabled;

  /* ── connection health ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!open || !enabled) return;
    let cancelled = false;
    const run = async () => {
      const prev = useChatStore.getState().status;
      setStatus({ ...prev, checking: true });
      const next = await healthCheck(settings.baseUrl);
      if (!cancelled) setStatus(next);
    };
    void run();
    const timer = setInterval(run, CHATBOT_CONFIG.healthCheckIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, enabled, settings.baseUrl, setStatus]);

  /* ── Ctrl/Cmd+K toggle ─────────────────────────────────────────────── */
  // Not a conflict: `useKeyboardShortcuts` owns Space / 1-4 / Enter, and it
  // stands down while a text field has focus. Cmd+K is unused.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!useChatStore.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  /* ── keep the newest message in view ────────────────────────────────── */
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  /* ── proactive nudge ───────────────────────────────────────────────── */
  // Fires ONCE per mount, and only when the learner has genuinely repeated a
  // mistake. It queues a real question rather than merely revealing an empty
  // panel — a nudge that just opens a blank chat teaches nothing.
  const nudged = useRef(false);
  useEffect(() => {
    if (!settings.autoOpenOnMistake || nudged.current) return;
    const repeated = snapshot.review.recent.find((item) => item.errorCount >= 3);
    if (!repeated) return;
    nudged.current = true;
    useChatStore.getState().enqueuePrompt(isDE ? 'Warum war das falsch?' : 'Why was I wrong?');
  }, [settings.autoOpenOnMistake, snapshot.review.recent, isDE]);

  /* ── drain prompts queued from outside the panel ───────────────────── */
  // `WhyButton` and `useChatbotTriggers` call `enqueuePrompt`; this is the
  // single place that consumes it, so nothing outside the panel ever has to
  // know how to send a message.
  //
  // The route guard matters: a trigger can fire on a settings page, and without
  // it the question would be answered into a panel that renders nothing.
  const onLearningRoute = isLearningRoute(pathname);
  const sendRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    if (!pendingPrompt) return;
    if (isStreaming) return; // never interrupt a reply already in flight
    if (!onLearningRoute) return; // answer it when they come back, not into the void
    const queued = useChatStore.getState().takePendingPrompt();
    if (queued) sendRef.current(queued);
  }, [pendingPrompt, isStreaming, onLearningRoute]);

  // Mero noticing things on his own (failed checkpoint, streak at risk, new
  // weakest skill, level up).
  useChatbotTriggers(snapshot);

  /* ── the send pipeline ──────────────────────────────────────────────── */
  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isStreaming) return;

      const store = useChatStore.getState();
      const { addMessage, patchMessage, setStreaming: setBusy, setMood: setFace } = store;

      addMessage({ id: nextMessageId(), role: 'user', content: text, createdAt: Date.now() });
      setFace('thinking');

      // ── SLASH COMMANDS short-circuit the router ───────────────────────
      // A leading slash is authoritative: `/why` must not lose to a keyword
      // rule, and `/help` never reaches the model at all.
      const command = parseCommand(text);
      if (command.command === 'help') {
        addMessage({
          id: nextMessageId(),
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          intent: 'casual_chat',
        });
        setFace('idle');
        setHelpOpen(true);
        return;
      }
      if (command.command === 'stop') {
        abortRef.current?.abort();
        return;
      }

      let intent: Intent = command.intent ?? classifyIntent(text, snapshot);
      // `/vocab Hund` carries its own lookup term.
      const lookupTerm = command.command === 'vocab' && command.argument
        ? command.argument
        : extractQuotedTerm(text);

      // PRACTICE MODE routes an UNMATCHED message to German conversation. Meta
      // questions deliberately pass through: a learner who switched to practice
      // mode to drill must still be able to ask "where am I?" and get a real
      // answer, not a forced role-play.
      if (mode === 'practice' && (intent === 'casual_chat' || intent === 'conversation')) {
        intent = 'conversation';
      }

      // MODEL-ASSISTED FALLBACK — only when the rules scored ZERO and a server
      // is reachable. It can never re-route a question the rules understood, so
      // a flaky model cannot hijack the common cases.
      if (intent === 'casual_chat' && store.status.reachable) {
        intent =
          (await classifyWithModel(text, {
            baseUrl: settings.baseUrl,
            model: settings.model,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
          })) ?? intent;
      }

      // Only vocabulary lookups need I/O; everything else is pure.
      let vocabHit: VocabHit | null = null;
      if (intent === 'vocab_lookup') {
        vocabHit = await lookupVocab(lookupTerm ?? text);
      }

      // Screen context is assembled for EVERY turn, not just page_help, so the
      // model can volunteer what the learner is looking at when it helps.
      const page = buildPageContext(pathname, snapshot);
      const report = intent === 'report' ? buildReport(snapshot) : undefined;

      const nextConversation = advanceConversation(conversation, text, {
        level: levelForContext(snapshot.cefr, snapshot.a1.unitIndex),
      });
      setConversation(nextConversation);

      const plan = handleIntent({
        intent,
        message: text,
        context: snapshot,
        vocabHit,
        conversation,
        page,
        report,
      });

      // A drill is built from real data and rendered as an interactive card,
      // so the model only contributes the one-line encouragement.
      if (intent === 'start_quiz') {
        const deck = await buildPracticeDeck({
          count: 3,
          mode: mode === 'practice' ? 'listen' : 'choice',
          ctx: snapshot,
        });
        if (!store.startQuiz(deck, mode === 'practice' ? 'listen' : 'choice')) {
          addMessage({
            id: nextMessageId(),
            role: 'assistant',
            content: isDE
              ? 'Ich habe noch nicht genug Material für eine Runde. Lerne zuerst ein paar Wörter, dann frag mich nochmal.'
              : "I don't have enough material for a round yet. Learn a few words first, then ask me again.",
            createdAt: Date.now(),
          });
          setFace('concerned');
          return;
        }
      }

      const assistantId = nextMessageId();
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        streaming: true,
        intent,
        // Powers the per-message "ask again" button.
        inReplyTo: text,
        // A real recording for this word, when the lookup found one. Preferred
        // over synthesis so the learner hears the app's own pronunciation.
        audioUrl: vocabHit?.audioUrl ?? undefined,
        // The structured card. Attached immediately so it is on screen while
        // the prose is still streaming.
        payload: plan.payload,
      });

      // No server: answer from the deterministic fallback and stop. The panel
      // stays useful with Ollama switched off — that is the whole point of
      // ResponsePlan carrying a fallback.
      if (!store.status.reachable) {
        patchMessage(assistantId, {
          content: plan.fallbackReply,
          streaming: false,
          action: plan.suggestedAction,
        });
        setFace(plan.mood);
        return;
      }

      const wire: WireMessage[] = [
        {
          role: 'system',
          content: buildSystemPrompt({ context: snapshot, plan, settings, conversation, page }),
        },
        // Read history from the store, not the render closure: `addMessage`
        // above already pushed the user's turn, and a closure would omit it.
        ...recentHistory(useChatStore.getState().messages),
        { role: 'user', content: buildUserPrompt(text, snapshot, conversation) },
      ];

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      let acc = '';
      try {
        await streamChat(
          wire,
          {
            baseUrl: settings.baseUrl,
            model: settings.model,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
          },
          (delta) => {
            acc += delta;
            patchMessage(assistantId, { content: acc });
          },
          controller.signal,
        );
        patchMessage(assistantId, {
          content: acc.trim() ? acc : plan.fallbackReply,
          streaming: false,
          action: plan.suggestedAction,
        });
        setFace(plan.mood);
      } catch (err) {
        if (controller.signal.aborted) {
          patchMessage(assistantId, {
            content: acc || (isDE ? 'Abgebrochen.' : 'Stopped.'),
            streaming: false,
          });
        } else {
          const hint =
            err instanceof OllamaError ? `${err.message} ${err.hint}`.trim() : String(err);
          patchMessage(assistantId, {
            content: `${plan.fallbackReply}\n\n---\n_${isDE ? 'Hinweis' : 'Note'}_: ${hint}`,
            streaming: false,
            error: true,
            action: plan.suggestedAction,
          });
        }
        setFace('concerned');
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [snapshot, conversation, settings, isStreaming, isDE, mode, setConversation],
  );

  // The pending-prompt effect above is declared before `send`, so it reaches it
  // through this ref rather than a stale closure.
  sendRef.current = send;

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onAction = useCallback((to: string) => navigateTo(to), [navigateTo]);

  /* ── answering an in-chat drill ─────────────────────────────────────── */
  // Scoring lives HERE, not in the store, because recording an answer is the
  // one place that touches the learner's real progress. `useAnswerReporter` is
  // the app's own writer: XP through XpContext AND the SRS queue on a miss —
  // exactly the path Articles, Dictation and Blitz use.
  const reportAnswer = useAnswerReporter();
  const correctStreak = useRef(0);

  const onQuizAnswer = useCallback(
    (given: string) => {
      const store = useChatStore.getState();
      const question = store.activeQuestion();
      if (!question) return;

      const correct = isAnswerCorrect(given, question.correct, question.mode);
      const result = store.answerQuiz(given, correct);
      if (!result) return;

      // The real write path — same as Articles, Dictation, Blitz.
      //
      // `itemKey` and `correctAnswer` are NOT optional extras here: without
      // both, `useAnswerReporter` awards the XP and silently SKIPS
      // `addWrongAnswer`, so a wrong answer would never reach the review queue
      // and in-chat practice would be a dead end.
      reportAnswer({
        correct,
        module: question.moduleType,
        itemKey: question.itemKey,
        userAnswer: given,
        correctAnswer: question.correct,
      });

      if (correct) {
        correctStreak.current += 1;
        // A little celebration for a run of three, not on every single answer.
        if (correctStreak.current === 3) triggerConfetti();
        store.setMood('proud');
      } else {
        correctStreak.current = 0;
        store.setMood('concerned');
      }

      const finished = !store.activeQuestion();
      store.addMessage({
        id: nextMessageId(),
        role: 'assistant',
        content: finished
          ? quizSummary(store.quiz, isDE)
          : correct
            ? isDE
              ? `✅ Richtig! **${question.correct}**`
              : `✅ Correct! **${question.correct}**`
            : isDE
              ? `❌ Fast. Richtig: **${question.correct}**${question.hint ? `\n\n_${question.hint.de}_` : ''}`
              : `❌ Not quite. Correct: **${question.correct}**${question.hint ? `\n\n_${question.hint.en}_` : ''}`,
        createdAt: Date.now(),
      });

      if (finished) {
        setDailySessionActive(false);
        store.endQuiz();
      }
    },
    [reportAnswer, isDE],
  );

  // A drill counts as an active session so level-ups toast instead of opening
  // the celebration modal mid-question (.clinerules C2.7).
  useEffect(() => {
    if (!quiz) return;
    setDailySessionActive(true);
    return () => setDailySessionActive(false);
  }, [quiz]);

  // Route guard (defence in depth — `Layout` already gates this).
  if (!enabled || !isLearningRoute(pathname)) return null;

  const chips = suggestions(isDE);

  // Follow-ups continue the ACTUAL thread (derived from the last intent) rather
  // than restarting a fixed menu. Only shown once a reply has settled.
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.streaming);
  const followUps = lastAssistant?.intent ? followUpsFor(lastAssistant.intent, isDE) : [];
  const showFollowUps = followUps.length > 0 && !isStreaming;

  return (
    <>
      {/* ── launcher (collapsed state) ─────────────────────────────────── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={isDE ? 'Mero öffnen' : 'Open Mero'}
          title={isDE ? 'Mero öffnen (Strg+K)' : 'Open Mero (Ctrl+K)'}
          className="fixed right-4 bottom-24 z-[54] inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg transition hover:bg-accent-700 active:scale-95 sm:bottom-6"
        >
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
          {!status.reachable && !status.checking && (
            <span
              className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-danger-500 dark:border-ink-900"
              aria-hidden="true"
            />
          )}
        </button>
      )}

      {/* ── panel (expanded state) ─────────────────────────────────────── */}
      {open && (
        <aside
          aria-label={isDE ? 'Mero Lernbegleiter' : 'Mero learning companion'}
          className="fixed inset-y-0 right-0 z-[55] flex w-full flex-col border-l border-ink-200 bg-white shadow-2xl sm:w-[360px] dark:border-ink-800 dark:bg-ink-900"
        >
          <ChatHeader
            isDE={isDE}
            status={status}
            mood={mood}
            mode={mode}
            onToggleMode={() => setMode(mode === 'coach' ? 'practice' : 'coach')}
            onExplainPage={() => void send('/page')}
            preferenceCount={(settings.preferences ?? []).length}
            onClose={() => setOpen(false)}
            onClear={() => useChatStore.getState().clearHistory()}
          />

          {/* Offline notice — an actionable fix, not just a failure. */}
          {!status.reachable && !status.checking && (
            <div className="flex items-start gap-2 border-b border-warning-200 bg-warning-50 px-3 py-2 text-meta text-warning-900 dark:border-warning-800/50 dark:bg-warning-950/40 dark:text-warning-200">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {isDE ? 'Kein lokales Modell gefunden' : 'No local model found'}
                </p>
                <p className="mt-0.5 break-words">
                  {isDE
                    ? 'Mero antwortet trotzdem — mit geprüften App-Daten. Für freie Antworten starte Ollama.'
                    : "Mero still answers from real app data. For free-form replies, start Ollama."}{' '}
                  <button
                    type="button"
                    onClick={() => navigateTo('/settings')}
                    className="font-semibold underline underline-offset-2"
                  >
                    {isDE ? 'Einstellungen' : 'Settings'}
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                {!settings.onboarded && (
                  <OnboardingCard
                    payload={{
                      kind: 'onboarding',
                      canGenerate: status.reachable,
                      baseUrl: settings.baseUrl,
                    }}
                    isDE={isDE}
                    onAction={(to) => {
                      useChatStore.getState().markOnboarded();
                      void send(to === '/practice' ? 'quiz me' : to);
                    }}
                    onDismiss={() => useChatStore.getState().markOnboarded()}
                  />
                )}
                {settings.onboarded && (
                  <div className="rounded-lg bg-ink-100 px-3 py-2.5 dark:bg-ink-800">
                    <p className="text-body text-ink-900 dark:text-ink-100">
                      {isDE
                        ? 'Frag mich nach Grammatik, Wortschatz oder deinem Fortschritt — oder tippe /help.'
                        : 'Ask me about grammar, vocabulary or your progress — or type /help.'}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void send(chip)}
                      className="inline-flex min-h-[36px] items-center rounded-full border border-ink-200 bg-white px-3 py-1.5 text-meta font-medium text-ink-700 transition hover:border-accent-400 hover:text-accent-600 active:scale-95 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isDE={isDE}
                  mood={mood}
                  onAction={onAction}
                  // Retry only on the newest settled reply — retrying an old
                  // one from the middle of the thread is never what was meant.
                  onRetry={
                    !isStreaming && message.role === 'assistant' && index === messages.length - 1
                      ? (text) => void send(text)
                      : undefined
                  }
                />
              ))
            )}

            {showFollowUps && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {followUps.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="inline-flex min-h-[32px] items-center rounded-full border border-ink-200 bg-white px-3 py-1 text-meta font-medium text-ink-700 transition hover:border-accent-400 hover:text-accent-600 active:scale-95 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* `/help` listing — rendered locally, the model is never asked. */}
            {helpOpen && (
              <div className="rounded-md border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
                <p className="text-body font-semibold text-ink-900 dark:text-ink-100">
                  {isDE ? 'Befehle' : 'Commands'}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {COMMAND_HELP.map((c) => (
                    <li key={c.usage} className="text-meta">
                      <code className="font-mono text-ink-900 dark:text-ink-100">{c.usage}</code>
                      <span className="text-ink-500 dark:text-ink-400">
                        {' — '}
                        {isDE ? c.de : c.en}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="mt-2 inline-flex min-h-[32px] items-center rounded-md border border-ink-200 px-2.5 py-1 text-meta font-semibold text-ink-700 transition hover:bg-ink-50 active:scale-95 dark:border-ink-700 dark:text-ink-300"
                >
                  {isDE ? 'Schließen' : 'Close'}
                </button>
              </div>
            )}

            {/* The live question lives OUTSIDE the transcript, so the history
                reads as a clean record and the card is always the newest thing
                on screen. */}
            {activeQuestion && (
              <QuizCard
                payload={{ kind: 'quiz', question: activeQuestion, index: quiz?.index ?? 0, total: quiz?.deck.length ?? 1 }}
                isDE={isDE}
                onAnswer={onQuizAnswer}
              />
            )}
          </div>

          <ChatInput
            isDE={isDE}
            isStreaming={isStreaming}
            disabled={!enabled}
            onSend={(text) => void send(text)}
            onStop={stop}
          />
        </aside>
      )}
    </>
  );
}
