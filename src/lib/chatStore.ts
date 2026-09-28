/**
 * src/lib/chatStore.ts — the companion's UI state (zustand).
 *
 * WHY ZUSTAND AND NOT CONTEXT
 * ---------------------------
 * The chat state is written from outside the React tree: the health poller, the
 * streaming reader, and the per-user hydration all mutate it. Routing those
 * through a provider would mean threading a ref object through every layer or
 * rebuilding the whole subtree on every token. A store outside React keeps the
 * streaming path allocation-free.
 *
 * PER-USER ISOLATION (`.clinerules` C14)
 * -------------------------------------
 * State is a single object, but persistence is keyed per user via
 * `scopedKey`. `hydrateChat(userId)` is called by the provider on mount and on
 * identity change, so User A never sees User B's transcript — including after a
 * sign-out/sign-in swap, which is the case a naive "keep in memory" store gets
 * wrong.
 */

import { create } from 'zustand';
import { CHATBOT_CONFIG, CHATBOT_ENABLED, CHATBOT_STORAGE_KEY, DEFAULT_SETTINGS } from '../config/chatbot';
import { getChatbotDefaults } from '../data/chatbot/resolve';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
import { isAssessmentActive, subscribeAssessmentActive } from './assessmentSignal';
import type {
  ChatbotSettings,
  ChatMessage,
  ChatMode,
  ChatPreference,
  MeroMood,
  OllamaStatus,
  QuizQuestion,
} from '../types/chatbot';
import { createConversation, type ConversationState } from './conversationManager';
import type { PracticeMode } from './chatPractice';

/** One answered question in an in-chat drill. */
export interface QuizResult {
  question: QuizQuestion;
  given: string;
  correct: boolean;
}

/**
 * A live in-chat drill.
 *
 * SESSION-SCOPED AND NEVER PERSISTED. A half-finished drill must not resurrect
 * on the next page load: the SRS rows and XP were already written, so reviving
 * the question set would risk double-counting and re-asking something already
 * answered. The transcript keeps the record; the live card does not.
 */
export interface QuizSession {
  deck: QuizQuestion[];
  index: number;
  results: QuizResult[];
  mode: PracticeMode;
}

const INITIAL_STATUS: OllamaStatus = {
  reachable: false,
  checking: false,
  format: null,
  models: [],
  error: null,
};

interface ChatStore {
  messages: ChatMessage[];
  settings: ChatbotSettings;
  status: OllamaStatus;
  open: boolean;
  isStreaming: boolean;
  mood: MeroMood;
  conversation: ConversationState;
  /** Coach (default) or German-practice mode. */
  mode: ChatMode;
  /** A live in-chat drill, or null. Never persisted. */
  quiz: QuizSession | null;
  /**
   * Questions handed to the chat from OUTSIDE the panel, oldest first.
   *
   * This is the seam that lets `WhyButton` and the proactive triggers start a
   * conversation without importing `ChatSidebar` or threading a callback
   * through every quiz page. `ChatSidebar` drains it via `takePendingPrompt`.
   *
   * ── WHY A QUEUE AND NOT A SINGLE SLOT ──────────────────────────────────────
   * It was one `string | null`, overwritten unconditionally — and the triggers
   * genuinely collide. Streak-at-risk and level-up both fire off the same XP
   * and streak state, so a learner who levels up on a cold day queued two
   * nudges in one tick and the first was destroyed. The checkpoint trigger made
   * it worse by looping every failed unit into that one slot. A dropped nudge
   * is unrecoverable: there is no second chance at it, which is the opposite of
   * what the comment here used to promise.
   */
  pendingPrompts: string[];
  /**
   * A prompt was queued while a graded run was in flight, so its panel reveal
   * was withheld. Cleared — and the panel opened — the moment the run ends.
   * See `enqueuePrompt`.
   */
  deferredReveal: boolean;

  setOpen: (open: boolean) => void;
  toggle: () => void;
  setStatus: (status: OllamaStatus) => void;
  setSettings: (patch: Partial<ChatbotSettings>) => void;
  setStreaming: (isStreaming: boolean) => void;
  setMood: (mood: MeroMood) => void;
  setConversation: (conversation: ConversationState) => void;
  setMode: (mode: ChatMode) => void;
  /** Begin a drill. A deck with no usable questions is rejected, not shown. */
  startQuiz: (deck: QuizQuestion[], mode: PracticeMode) => boolean;
  /**
   * Record an answer, advance, and report what happened.
   *
   * Returns the result so the caller can write it to the real SRS queue and
   * award XP through the app's own reporter — the store must not import those
   * hooks, so the recording path stays in one place.
   */
  answerQuiz: (given: string, isCorrect: boolean) => QuizResult | null;
  /** The question currently on screen, or null. */
  activeQuestion: () => QuizQuestion | null;
  endQuiz: () => void;
  togglePreference: (pref: ChatPreference) => void;
  markOnboarded: () => void;
  /** Open the panel and queue `text` to be sent as the next message. */
  enqueuePrompt: (text: string) => void;
  /** Read-and-clear the OLDEST queued prompt, so nothing is sent twice or lost. */
  takePendingPrompt: () => string | null;
  addMessage: (message: ChatMessage) => void;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearHistory: () => void;

  /**
   * The ADMIN's global on/off, from `app_config.chatbot_enabled`.
   *
   * ── WHY THIS IS IN THE STORE AND NOT PERSISTED ─────────────────────────────
   * It is a global, but it is NOT persisted per user alongside `settings`.
   * `persistChat` writes the whole settings object, so a persisted copy would be
   * frozen at whatever the flag said the day that user last opened the app —
   * and re-enabling the companion in the control centre would silently fail for
   * exactly the people who had it on. In memory only, re-read on every boot.
   *
   * Defaults to `true` so the companion works before (and if) resolution runs. A
   * global switch must not be able to blank the feature by being slow.
   */
  adminEnabled: boolean;
  setAdminEnabled: (enabled: boolean) => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  messages: [],
  settings: DEFAULT_SETTINGS,
  status: INITIAL_STATUS,
  open: false,
  isStreaming: false,
  mood: 'idle',
  conversation: createConversation(),
  mode: 'coach',
  pendingPrompts: [],
  deferredReveal: false,
  quiz: null,
  adminEnabled: true,

  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  setStatus: (status) => set({ status }),
  setAdminEnabled: (adminEnabled) => set({ adminEnabled }),
  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setMood: (mood) => set({ mood }),
  setConversation: (conversation) => set({ conversation }),
  setMode: (mode) => set({ mode }),

  // Opening AND queueing together is deliberate: a proactive nudge that does
  // not reveal the panel is a nudge nobody ever sees.
  //
  // THE EXCEPTION, and it is not a nicety. `useChatbotTriggers` fires the
  // "I didn't pass the checkpoint" nudge the moment a run is RECORDED, which
  // is while the learner is still on the checkpoint page holding Next. The
  // panel is `fixed inset-y-0 right-0 sm:w-[360px]`, and at 1440px it covered
  // the Next button outright (measured: panel left edge 1070, button 1157-1223,
  // `elementFromPoint` returned a chat paragraph). The learner could not
  // advance, and Retry / "Back to map" were covered too, so they could not
  // leave either.
  //
  // So while a graded run is in flight the prompt is still QUEUED — it is not
  // dropped, because a dropped nudge is the original sin — but the reveal is
  // deferred. `setOpen` is subscribed below and fires the moment the run ends.
  // ChatSidebar's own header states the rule this enforces: "Nothing auto-opens
  // it" mid-question.
  enqueuePrompt: (text) => {
    // A panel that is ALREADY open when a run starts must get out of the way,
    // not just stay out of the way. `autoOpenOnMistake` fires from the review
    // queue on ordinary page load, so by the time the learner opens a
    // checkpoint the panel can already be covering it — and the
    // `isAssessmentActive()` guard below cannot help, because the prompt was
    // enqueued before the run existed.
    //
    // Measured: panel left edge 1070, Next button 1157-1223 at 1440px, and
    // `elementFromPoint` on the button returned a chat paragraph. The learner
    // could neither advance, retry, nor leave.
    //
    // A duplicate is the SAME nudge re-queued by a second effect in the same
    // commit (two triggers can both observe the same new level). Sending the
    // same question twice reads as a stutter, so identical text collapses onto
    // one entry. Genuinely DIFFERENT nudges still queue behind each other.
    const queue = get().pendingPrompts;
    const pendingPrompts = queue.includes(text) ? queue : [...queue, text];

    if (isAssessmentActive()) {
      set({ open: false, pendingPrompts, deferredReveal: true });
    } else {
      set({ pendingPrompts, open: true });
    }
  },
  takePendingPrompt: () => {
    const [next, ...rest] = get().pendingPrompts;
    if (next !== undefined) set({ pendingPrompts: rest });
    return next ?? null;
  },

  startQuiz: (deck, mode) => {
    // An empty deck would render a card with no question; refuse it so the
    // caller can say "not enough material" instead.
    if (!deck.length) return false;
    set({ quiz: { deck, index: 0, results: [], mode }, open: true });
    return true;
  },

  answerQuiz: (given, isCorrect) => {
    const quiz = get().quiz;
    if (!quiz) return null;
    const question = quiz.deck[quiz.index];
    if (!question) return null;
    const result: QuizResult = { question, given, correct: isCorrect };
    // Advancing past the end is the completion signal: `activeQuestion()`
    // starts returning null and the sidebar posts the score.
    set({ quiz: { ...quiz, index: quiz.index + 1, results: [...quiz.results, result] } });
    return result;
  },

  activeQuestion: () => {
    const quiz = get().quiz;
    if (!quiz) return null;
    return quiz.deck[quiz.index] ?? null;
  },

  endQuiz: () => set({ quiz: null }),

  togglePreference: (pref) => {
    const current = get().settings.preferences ?? [];
    const next = current.includes(pref)
      ? current.filter((p) => p !== pref)
      : [...current, pref];
    set({ settings: { ...get().settings, preferences: next } });
  },

  markOnboarded: () => set({ settings: { ...get().settings, onboarded: true } }),

  addMessage: (message) =>
    set({ messages: [...get().messages, message].slice(-CHATBOT_CONFIG.storedMessages) }),

  patchMessage: (id, patch) =>
    set({
      messages: get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }),

  clearHistory: () => set({ messages: [], conversation: createConversation() }),
}));

/**
 * FLUSH THE DEFERRED REVEAL.
 *
 * When a graded run ends, a nudge that was queued mid-run finally gets to show
 * itself. Subscribed at MODULE scope, not from a component, on purpose: a run
 * can end because the learner navigated away, and in that case no component of
 * ours is guaranteed to be mounted to act as the wake-up.
 *
 * Idempotent by construction — the flag is cleared in the same `set` that opens
 * the panel, so a burst of end-events cannot re-open a panel the learner has
 * since closed on purpose.
 */
subscribeAssessmentActive((active) => {
  const { deferredReveal, open } = useChatStore.getState();

  if (active) {
    // A RUN JUST STARTED. Any open panel is now sitting on top of the learner's
    // question and its Next button, so it gets out of the way — unconditionally
    // and without discarding the transcript, which is the learner's data.
    //
    // This is the half of the rule `enqueuePrompt` cannot cover. A prompt may
    // have been enqueued on an EARLIER page load (`autoOpenOnMistake` reads the
    // review queue at mount), long before any run existed, so the panel is
    // already open by the time the first question renders. Guarding only the
    // enqueue would leave that case wide open.
    if (open) useChatStore.setState({ open: false });
    return;
  }

  // THE RUN ENDED. A nudge withheld during the run finally gets to show itself.
  // Guarded on the queue being non-empty: with a queue, a later enqueue may have
  // replaced the set of pending nudges, and opening an empty panel would show the
  // learner a blank drawer with no explanation for why it appeared.
  if (!deferredReveal || open) return;
  if (useChatStore.getState().pendingPrompts.length === 0) {
    useChatStore.setState({ deferredReveal: false });
    return;
  }
  useChatStore.setState({ deferredReveal: false, open: true });
});

/* ── persistence ──────────────────────────────────────────────────────────── */

interface Persisted {
  settings: ChatbotSettings;
  messages: ChatMessage[];
}

let hydratedFor: string | null = null;

function storageKey(userId: string): string {
  return scopedKey(CHATBOT_STORAGE_KEY, userId);
}

/** Load this user's settings + transcript into the store. Safe to call often. */
export function hydrateChat(userId: string): void {
  if (hydratedFor === userId) return;
  hydratedFor = userId;

  let parsed: Partial<Persisted> = {};
  const raw = getItem(storageKey(userId));
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<Persisted>;
    } catch {
      parsed = {};
    }
  }

  // The admin-resolved defaults go UNDER the learner's saved settings, never
  // over them. That ordering is the whole contract: an admin sets the floor that
  // a NEW learner starts from, and a learner who has already chosen something
  // keeps it. Reversing these two spreads would silently overwrite a saved
  // choice on every boot, which is the one thing `chatbot_*` must never do.
  //
  // `getChatbotDefaults()` reads an in-memory holder that resolution fills in
  // before this is called — `LearningContext` awaits resolution first. It falls
  // back to the bundled values if it is called early, so the order is an
  // optimisation, not a correctness requirement for the learner.
  const adminDefaults = getChatbotDefaults();

  useChatStore.setState({
    // Merge rather than replace, so a newly-added setting field still gets its
    // default for users who saved before it existed.
    settings: {
      ...DEFAULT_SETTINGS,
      baseUrl: adminDefaults.baseUrl,
      model: adminDefaults.model,
      intensity: adminDefaults.intensity,
      languageMix: adminDefaults.languageMix,
      autoOpenOnMistake: adminDefaults.autoOpenOnMistake,
      ...(parsed.settings ?? {}),
    },
    // A transcript restored mid-stream would render a permanently typing
    // bubble, so the flag is cleared on load.
    messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-CHATBOT_CONFIG.storedMessages) : [],
    isStreaming: false,
    conversation: createConversation(),
    // Session-scoped, never persisted: reopening the app should not silently
    // drop the learner into German-drill mode.
    mode: 'coach',
    // Never restore a withheld reveal across a reload: the run that caused it
    // is long gone, so honouring it would pop a panel the learner never asked
    // for on a page they have not even opened yet. The queued text goes with
    // it — a nudge addressed to a run that no longer exists is not worth
    // replaying into a fresh session.
    pendingPrompts: [],
    deferredReveal: false,
    // A drill in flight does NOT survive a reload: its answers were already
    // written to the SRS queue, so reviving it risks double-counting.
    quiz: null,
  });
}

/**
 * Is the companion actually usable right now?
 *
 * THREE switches, ANDed:
 *
 *   CHATBOT_ENABLED  compiled out at build time (`VITE_CHATBOT_ENABLED=false`)
 *   adminEnabled    the global switch in `app_config`
 *   settings.enabled the learner's own personal toggle
 *
 * This is a DERIVED read, never a write. Folding the global into
 * `settings.enabled` would persist it into localStorage, and the learner would be
 * stuck with a companion that looks broken long after the admin switched it back
 * on.
 *
 * ── WHY EVERY SELECTOR RUNS, EVEN WHEN THE BUILD FLAG IS OFF ────────────────
 * All three are called UNCONDITIONALLY and only then combined. Writing this as
 * `CHATBOT_ENABLED && useChatStore(...) && useChatStore(...)` is a
 * rules-of-hooks violation and a real crash, not a style warning: with the build
 * flag off, a component that called this hook on the first render and not the
 * next (or vice versa) would hit "Rendered more hooks than during the previous
 * render" and unmount the tree. `CHATBOT_ENABLED` is a constant, so the hook
 * count is stable in practice today — which is exactly why the bug would survive
 * casual testing and surface only in a kill-switch build.
 */
export function useChatEnabled(): boolean {
  const adminEnabled = useChatStore((s) => s.adminEnabled);
  const personal = useChatStore((s) => s.settings.enabled);
  return CHATBOT_ENABLED && adminEnabled && personal;
}

/** Write settings + transcript back. Called from the provider on change. */
export function persistChat(userId: string): void {
  const { settings, messages } = useChatStore.getState();
  const payload: Persisted = { settings, messages };
  setItem(storageKey(userId), JSON.stringify(payload));
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

let counter = 0;

/** Collision-resistant id without depending on `crypto.randomUUID`. */
export function nextMessageId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}-${counter}`;
}
