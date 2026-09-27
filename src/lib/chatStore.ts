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
import { CHATBOT_CONFIG, CHATBOT_STORAGE_KEY, DEFAULT_SETTINGS } from '../config/chatbot';
import { getItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';
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
   * A question handed to the chat from OUTSIDE the panel.
   *
   * This is the seam that lets `WhyButton` and the proactive triggers start a
   * conversation without importing `ChatSidebar` or threading a callback
   * through every quiz page. `ChatSidebar` drains it via `takePendingPrompt`.
   */
  pendingPrompt: string | null;

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
  /** Read-and-clear, so a queued prompt is never sent twice. */
  takePendingPrompt: () => string | null;
  addMessage: (message: ChatMessage) => void;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearHistory: () => void;
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
  pendingPrompt: null,
  quiz: null,

  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  setStatus: (status) => set({ status }),
  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setMood: (mood) => set({ mood }),
  setConversation: (conversation) => set({ conversation }),
  setMode: (mode) => set({ mode }),

  // Opening AND queueing together is deliberate: a proactive nudge that does
  // not reveal the panel is a nudge nobody ever sees.
  enqueuePrompt: (text) => set({ pendingPrompt: text, open: true }),
  takePendingPrompt: () => {
    const next = get().pendingPrompt;
    if (next) set({ pendingPrompt: null });
    return next;
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

  useChatStore.setState({
    // Merge rather than replace, so a newly-added setting field still gets its
    // default for users who saved before it existed.
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    // A transcript restored mid-stream would render a permanently typing
    // bubble, so the flag is cleared on load.
    messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-CHATBOT_CONFIG.storedMessages) : [],
    isStreaming: false,
    conversation: createConversation(),
    // Session-scoped, never persisted: reopening the app should not silently
    // drop the learner into German-drill mode.
    mode: 'coach',
    pendingPrompt: null,
    // A drill in flight does NOT survive a reload: its answers were already
    // written to the SRS queue, so reviving it risks double-counting.
    quiz: null,
  });
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
