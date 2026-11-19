/** Mero, the on-device learning companion. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MeroAvatar } from './MeroAvatar';

import { useLearningContext } from '../../context/LearningContext';
import { useChatbotTriggers } from '../../hooks/useChatbotTriggers';
import { useChatStore, useChatEnabled, nextMessageId, type QuizSession } from '../../lib/chatStore';
import { classifyIntent, extractQuotedTerm } from '../../lib/intentRouter';
import { followUpsFor, handleIntent } from '../../lib/responseHandlers';
import { lookupVocab, type VocabHit } from '../../lib/vocabLookup';
import { buildPracticeDeck, isAnswerCorrect } from '../../lib/chatPractice';
import { buildPageContext } from '../../lib/pageContext';
import { buildReport } from '../../lib/weeklyReport';
import { parseCommand, COMMAND_HELP } from '../../lib/slashCommands';
import { setDailySessionActive } from '../../lib/dailySessionSignal';
import { useAnswerReporter } from '../../hooks/useExerciseSession';
import { triggerConfetti } from '../../utils/confetti';
import {
  advanceConversation,
  levelForContext,
} from '../../lib/conversationManager';
import { isLearningRoute } from '../../config/chatbot';
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
  const isBusy = useChatStore((s) => s.isBusy);
  const mood = useChatStore((s) => s.mood);
  const conversation = useChatStore((s) => s.conversation);
  const setConversation = useChatStore((s) => s.setConversation);
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);
  // Read the HEAD of the queue, not a boolean. The effect must re-run as each
  // prompt is consumed, or a second queued nudge would sit unsent until some
  // unrelated state change happened to re-render this component.
  const pendingPrompt = useChatStore((s) => s.pendingPrompts[0] ?? null);
  const quiz = useChatStore((s) => s.quiz);
  // The live drill question. Declared with the other selectors — a hook below
  // the early `return null` would change hook order as the route changes.
  const activeQuestion = useChatStore((s) => s.quiz?.deck[s.quiz.index] ?? null);
  const [helpOpen, setHelpOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDE = snapshot.isDE;
  // The build flag, the admin's global switch and the learner's own toggle. The
  // sidebar renders nothing at all when any of them is off — an openable panel
  // that cannot talk to anything is worse than no panel.
  const enabled = useChatEnabled();

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
    if (isBusy) return; // never interrupt a reply already in flight
    if (!onLearningRoute) return; // answer it when they come back, not into the void
    const queued = useChatStore.getState().takePendingPrompt();
    if (queued) sendRef.current(queued);
  }, [pendingPrompt, isBusy, onLearningRoute]);

  // Mero noticing things on his own (failed checkpoint, streak at risk, new
  // weakest skill, level up).
  useChatbotTriggers(snapshot);

  /* ── the send pipeline ──────────────────────────────────────────────── */
  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || useChatStore.getState().isBusy) return;

      const store = useChatStore.getState();
      const { addMessage, setMood: setFace } = store;

      const turnId = nextMessageId();
      const turnIsCurrent = () => useChatStore.getState().messages.some((message) => message.id === turnId);
      addMessage({ id: turnId, role: 'user', content: text, createdAt: Date.now() });
      setFace('thinking');

      // ── SLASH COMMANDS short-circuit the router ───────────────────────
      // Explicit commands take precedence over matching the learner's wording.
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
        store.endQuiz();
        setFace('idle');
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

      store.setBusy(true);
      try {
        let vocabHit: VocabHit | null = null;
        if (intent === 'vocab_lookup') {
          vocabHit = await lookupVocab(lookupTerm ?? text);
          if (!turnIsCurrent()) return;
        }

        const page = buildPageContext(pathname, snapshot);
        const report = intent === 'report' ? buildReport(snapshot) : undefined;

        const nextConversation = intent === 'conversation'
          ? advanceConversation(conversation, text, {
              level: levelForContext(snapshot.cefr, snapshot.a1.unitIndex),
            })
          : conversation;
        if (nextConversation !== conversation) setConversation(nextConversation);

        const plan = handleIntent({
          intent,
          message: text,
          context: snapshot,
          vocabHit,
          conversation: nextConversation,
          page,
          report,
        });

        let intro: string | undefined;
        if (intent === 'start_quiz') {
          if (store.activeQuestion()) {
            addMessage({
              id: nextMessageId(),
              role: 'assistant',
              content: isDE ? 'Unsere Runde läuft noch!' : 'We’re already playing! The next question is below.',
              createdAt: Date.now(),
            });
            setFace('happy');
            return;
          }
          const deck = await buildPracticeDeck({
            count: 3,
            mode: mode === 'practice' ? 'listen' : 'choice',
            ctx: snapshot,
          });
          if (!turnIsCurrent()) return;
          intro = deck.some((question) => question.source === 'weak_item')
            ? (isDE ? 'Ein paar Antworten von neulich bekommen eine zweite Chance.' : 'I picked something you missed recently. Let’s give it another go.')
            : (isDE ? 'Drei kleine Fragen für dich. Los geht’s!' : 'Three little questions. Ready, set, hoot!');
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

        addMessage({
          id: nextMessageId(),
          role: 'assistant',
          content: intro ?? plan.fallbackReply,
          createdAt: Date.now(),
          intent,
          inReplyTo: text,
          audioUrl: vocabHit?.audioUrl ?? undefined,
          payload: plan.payload,
          action: plan.suggestedAction,
        });
        setFace(plan.mood);
      } catch {
        if (!turnIsCurrent()) return;
        addMessage({
          id: nextMessageId(),
          role: 'assistant',
          content: isDE ? 'Das hat gerade nicht geklappt. Versuch es noch einmal.' : 'I couldn’t finish that. Give it another try.',
          createdAt: Date.now(),
        });
        setFace('concerned');
      } finally {
        if (turnIsCurrent()) store.setBusy(false);
      }
    },
    [snapshot, conversation, isDE, mode, setConversation, pathname],
  );

  // The pending-prompt effect above is declared before `send`, so it reaches it
  // through this ref rather than a stale closure.
  sendRef.current = send;

  const stop = useCallback(() => {
    useChatStore.getState().endQuiz();
    useChatStore.getState().setMood('idle');
  }, []);

  const petMero = () => {
    const store = useChatStore.getState();
    store.setMood('happy');
    const content = snapshot.review.due > 0
      ? (isDE ? 'Huhu! Lust auf eine Wiederholungsrunde?' : 'Hoot! I’ve got some review for us when you’re ready.')
      : settings.intensity === 'serious'
        ? (isDE ? 'Bereit zum Üben.' : 'Ready to practise.')
        : (isDE ? 'Huhu! Jetzt sind meine Federn ganz zerzaust.' : 'Hoot! You ruffled my feathers.');
    if (store.messages.at(-1)?.content !== content) {
      store.addMessage({ id: nextMessageId(), role: 'assistant', content, createdAt: Date.now() });
    }
  };

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
      const feedback = correct
        ? (isDE ? `✅ Richtig! **${question.correct}**` : `✅ Correct! **${question.correct}**`)
        : (isDE ? `Fast. Richtig: **${question.correct}**` : `Not quite. Correct: **${question.correct}**`)
          + (question.hint ? `\n\n_${isDE ? question.hint.de : question.hint.en}_` : '');
      store.addMessage({
        id: nextMessageId(),
        role: 'assistant',
        content: finished ? `${feedback}\n\n${quizSummary(useChatStore.getState().quiz, isDE)}` : feedback,
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
  const showFollowUps = followUps.length > 0 && !isBusy;

  return (
    <>
      {/* ── launcher (collapsed state) ─────────────────────────────────── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={isDE ? 'Mero öffnen' : 'Open Mero'}
          title={isDE ? 'Mero öffnen (Strg+K)' : 'Open Mero (Ctrl+K)'}
          // `mb-(--mobile-content-clearance)` rather than the old literal
          // `bottom-24` (96px): the bar grew to 65px plus its safe-area inset, so
          // a fixed 96px offset left the launcher sitting 6px above a bar that
          // now reaches the screen edge — and on a notched phone, inside the
          // home-indicator region. Offsetting by the SAME token the page
          // clearance uses means the launcher can never end up under the bar.
          // `sm:mb-0 sm:bottom-6` keeps the original desktop position.
          className="fixed right-4 bottom-0 z-[54] mb-[calc(var(--mobile-content-clearance)+0.5rem)] inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg transition hover:bg-accent-700 active:scale-95 sm:bottom-6 sm:mb-0"
        >
          <MeroAvatar mood={mood} size={42} />
        </button>
      )}

      {/* ── panel (expanded state) ─────────────────────────────────────── */}
      {open && (
        <aside
          aria-label={isDE ? 'Mero Lernbegleiter' : 'Mero learning companion'}
          className="fixed inset-y-0 right-0 z-[56] flex w-full flex-col border-l border-ink-200 bg-white shadow-2xl sm:w-[360px] dark:border-ink-800 dark:bg-ink-900"
        >
          <ChatHeader
            isDE={isDE}
            mood={mood}
            mode={mode}
            onToggleMode={() => setMode(mode === 'coach' ? 'practice' : 'coach')}
            onPet={petMero}
            onExplainPage={() => void send('/page')}
            preferenceCount={(settings.preferences ?? []).length}
            onClose={() => setOpen(false)}
            onClear={() => useChatStore.getState().clearHistory()}
          />

          {/* Offline notice — an actionable fix, not just a failure. */}

          {/* transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                {!settings.onboarded && (
                  <OnboardingCard
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
                    !isBusy && message.role === 'assistant' && index === messages.length - 1
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
                    className="inline-flex min-h-11 items-center rounded-full border border-ink-200 bg-white px-3 py-1 text-meta font-medium text-ink-700 transition hover:border-accent-400 hover:text-accent-600 active:scale-95 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

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
                  className="mt-2 inline-flex min-h-11 items-center rounded-md border border-ink-200 px-2.5 py-1 text-meta font-semibold text-ink-700 transition hover:bg-ink-50 active:scale-95 dark:border-ink-700 dark:text-ink-300"
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
                key={quiz?.index}
                payload={{ kind: 'quiz', question: activeQuestion, index: quiz?.index ?? 0, total: quiz?.deck.length ?? 1 }}
                isDE={isDE}
                onAnswer={onQuizAnswer}
              />
            )}
          </div>

          <div className="flex gap-2 border-t border-ink-200 px-3 py-2 dark:border-ink-800">
            <button type="button" disabled={Boolean(activeQuestion) || isBusy} onClick={() => void send('/quiz')} className="min-h-11 rounded-full bg-accent-600 px-3 text-body font-semibold text-white disabled:opacity-50">
              {isDE ? 'Mit Mero spielen' : 'Play with Mero'}
            </button>
            {activeQuestion && (
              <button type="button" onClick={stop} className="min-h-11 rounded-full px-3 text-body text-ink-700 dark:text-ink-200">
                {isDE ? 'Runde beenden' : 'End round'}
              </button>
            )}
          </div>
          <ChatInput
            isDE={isDE}
            busy={isBusy}
            disabled={!enabled}
            onSend={(text) => void send(text)}
          />
        </aside>
      )}
    </>
  );
}
