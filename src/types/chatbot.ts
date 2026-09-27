/**
 * src/types/chatbot.ts
 *
 * Types for the local-first AI learning companion ("Mero", the owl).
 *
 * DESIGN NOTE — WHY THERE ARE TWO LAYERS
 * ---------------------------------------
 * `ContextSnapshot` is PLAIN SERIALIZABLE DATA. It is what `promptBuilder`
 * turns into text for the model, and what `responseHandlers` reads to build a
 * deterministic `fallbackReply`. It deliberately holds NO functions and NO
 * React references, so it can be unit-tested without a provider and prompt
 * building stays a pure function of its input.
 *
 * The navigation actions live on the React context value instead (see
 * `context/LearningContext.tsx`), never in here.
 * kept in an irrelevant type-only module rather than duplicated, because a
 * drifting copy here would silently desync the card from the real dataset.
 *
 * `verbatimModuleSyntax` guarantees these are erased — this file imports no
 * runtime code, so it stays a leaf in the module graph.
 */

import type { VocabHit } from '../lib/vocabLookup';
import type { RuleRow } from '../data/curriculum/schema';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  /** Stable id. */
  id: string;
  role: ChatRole;
  content: string;
  /** Epoch ms. */
  createdAt: number;
  /** True while tokens are still streaming into this message. */
  streaming?: boolean;
  /** The classified intent that produced this assistant turn. */
  intent?: Intent;
  /** A navigation the companion offered on this turn. */
  action?: { label: string; to: string };
  /**
   * Real audio for this turn (a `VocabCard.audioUrl`). When present the
   * "listen" button plays the bundled clip instead of synthesising speech, so
   * the learner hears the app's own recorded pronunciation.
   */
  audioUrl?: string;
  /** The learner message this turn answers — powers "retry". */
  inReplyTo?: string;
  /** True when this is an offline/error message, not model output. */
  error?: boolean;
  /**
   * A structured card to render INSTEAD of (or alongside) the text.
   *
   * Optional and additive on purpose: a transcript persisted before payloads
   * existed has no `payload`, and still renders perfectly as plain markdown.
   */
  payload?: ChatPayload;
}

/**
 * What the learner is asking for.
 *
 * `explain_mistake` is checked BEFORE `grammar_question`: "why was I wrong about
 * the article?" is both, but the mistake-specific handler is more useful. See
 * `intentRouter.ts` for the full precedence order.
 */
export type Intent =
  | 'explain_mistake'
  | 'practice_suggestion'
  | 'vocab_lookup'
  | 'grammar_question'
  | 'progress_check'
  | 'curriculum_help'
  | 'motivation'
  | 'settings'
  | 'start_quiz'
  | 'page_help'
  | 'report'
  | 'conversation'
  | 'casual_chat';

/** The wire protocol spoken by the local model server. */
export type OllamaWireFormat = 'ollama' | 'openai';

export interface OllamaStatus {
  reachable: boolean;
  checking: boolean;
  format: OllamaWireFormat | null;
  models: string[];
  /** Human-readable reason when `reachable` is false (CORS, not running, …). */
  error: string | null;
}

/** Playfulness dial. `serious` is the "just tell me the grammar" mode. */
export type PersonalityIntensity = 'serious' | 'balanced' | 'playful';

/** Which helper languages Mero mixes into its replies. */
export type LanguageMix = 'de_en' | 'de_en_ne';

export interface ChatbotSettings {
  enabled: boolean;
  /**
   * Runtime-overridable Ollama/LM Studio base URL.
   *
   * NOT env-only on purpose: `import.meta.env` is baked at BUILD time, so a
   * deployed build (https://merodeutsch.pramods.com.np) could never be
   * re-pointed at a learner's own machine. Persisted per user; falls back to
   * the env var, which is only a sane default for `npm run dev` locally.
   */
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  intensity: PersonalityIntensity;
  /** Nudge the sidebar open after a run of wrong answers. */
  autoOpenOnMistake: boolean;
  languageMix: LanguageMix;
  /**
   * Standing instructions the learner has given Mero, injected into every
   * system prompt ("explain simply", "German only", "more examples").
   *
   * Stored as a Set-like array so it survives JSON persistence. They are
   * preferences about HOW to answer, never about the facts — the grounding
   * block still wins over any of them.
   */
  preferences: ChatPreference[];
  /** False until the learner has seen the first-run welcome. */
  onboarded: boolean;
}

/** A persistent, learner-chosen style instruction. */
export type ChatPreference = 'simple' | 'examples' | 'german_only' | 'slow_down';

/** A single review-queue item, trimmed to what is worth spending tokens on. */
export interface ReviewSnippet {
  itemKey: string;
  moduleType: string;
  userAnswer: string;
  correctAnswer: string;
  errorCount: number;
  errorTag: string | null;
}

/** Everything the companion is allowed to know about the learner right now. */
export interface ContextSnapshot {
  /** Real auth identity — `null` for guests. Never a placeholder string. */
  userName: string | null;
  isAuthenticated: boolean;
  /** True in "Nur Deutsch" mode: hide EN/NE helper text (`.clinerules` C1.5). */
  isDE: boolean;

  // Where they are
  currentPathname: string;
  currentModuleLabel: string | null;

  // Gamification
  xp: { totalXp: number; level: number; rank: string; xpToNextLevel: number; xpProgress: number };
  streak: { current: number; longest: number };

  // Review / weaknesses
  review: { total: number; due: number; recent: ReviewSnippet[] };
  skills: SkillSnapshot[];
  weakestSkill: WeakestSkillSnapshot | null;
  weakItems: WeakItemSnapshot[];

  // Curriculum position
  a1: {
    /** Module they are working in (0-based, 0..14). */
    unitIndex: number;
    unitTitle: string;
    unitTitleDE: string;
    /** Highest module whose checkpoint is passed. */
    unlockedUnitIndex: number;
    completedCount: number;
    totalLearnNodes: number;
    /** Best checkpoint score per unit, 0..1. */
    checkpointBest: Record<number, number>;
    passedCheckpoints: number;
    /** The node the Home "Push" CTA would send them to. */
    pushNode: { label: string; labelDE: string; to: string } | null;
  };

  /** Persisted CEFR preference, defaults to A1. */
  cefr: string;
}

/** What an intent handler produces. */
export interface ResponsePlan {
  intent: Intent;
  /**
   * Factual block injected into the system prompt. This is what GROUNDS the
   * model — without it a 3B model will invent plausible-sounding progress.
   */
  contextBlock: string;
  /**
   * Deterministic answer used when the model is unreachable, erroring, or the
   * feature is disabled. Also the honest answer for pure data questions.
   */
  fallbackReply: string;
  /** A navigation the companion suggests the learner take. */
  suggestedAction?: { label: string; to: string };
  /**
   * A structured card for the UI to render with the reply. The handler knows
   * the facts (a real VocabCard, the module's real rule rows); the model only
   * supplies the prose around them.
   */
  payload?: ChatPayload;
  /** Suggested avatar mood. */
  mood: MeroMood;
}

/** The owl's seven moods (see `components/chat/MeroAvatar.tsx`). */
export type MeroMood =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'teasing'
  | 'proud'
  | 'concerned'
  | 'sleeping';

/**
 * A rich, interactive reply — the "card" that replaces a wall of text.
 *
 * WHY A UNION INSTEAD OF MARKDOWN
 * -------------------------------
 * A 3B model asked to "show me the word" returns a paragraph that scrolled off
 * the top of a 360px sidebar. These payloads let the companion hand the UI
 * STRUCTURED facts and let the component render them with the app's own design
 * tokens — the gender badge is `GenderBadge`, the rule table is
 * `GrammarRuleTable`, the audio button is the shared one. Nothing is rebuilt.
 *
 * `ChatMessage.payload` is OPTIONAL, so transcripts persisted before this
 * existed keep rendering as plain text — no migration, no broken history.
 */

export type ChatPayload =
  | { kind: 'vocab'; hit: VocabHit }
  | { kind: 'rules'; title: { en: string; de: string }; rows: RuleRow[] }
  | {
      kind: 'progress';
      level: number;
      totalXp: number;
      xpToNextLevel: number;
      rank: string;
      streak: number;
      skills: SkillSnapshot[];
      dueCount: number;
    }
  | {
      kind: 'error';
      itemKey: string;
      /** Reused to pick the micro-hint, like the review queue's error tag. */
      moduleType: string;
      userAnswer: string;
      correctAnswer: string;
      errorCount: number;
      errorTag: string | null;
      /** Where to practise this, derived from the error tag. */
      route: string | null;
    }
  | { kind: 'report'; summary: ReportSection[] }
  | { kind: 'onboarding'; canGenerate: boolean; baseUrl: string }
  | { kind: 'quiz'; question: QuizQuestion; index: number; total: number };

/** One block of a weekly report. */
export interface ReportSection {
  title: string;
  value: string;
}

/**
 * A question asked INSIDE the chat with tap-to-answer buttons.
 *
 * `speakPrompt` exists for hear-then-type mode and is deliberately the PROMPT
 * only — the correct answer is never a speakable field (.clinerules C2.6/C6).
 * `options` are shuffled once, at build time, and never re-sorted afterwards.
 */
export interface QuizQuestion {
  /** Stable within one deck, used as the React key and the SRS item key. */
  itemKey: string;
  /** Reuses the app's moduleType vocabulary so the SRS keys line up. */
  moduleType: string;
  prompt: string;
  /** The German term, for the "listen" button. Prompt only. */
  speakPrompt: string;
  /** Choice buttons. Empty for `type` mode. */
  options: string[];
  correct: string;
  mode: 'choice' | 'type' | 'listen';
  /**
   * Micro-hint from `data/hints.ts`, shown after a wrong answer. Carried as
   * the trilingual `HintText` so the card can honour Nur-DE at render time
   * instead of the deck freezing one language at build time.
   */
  hint?: { en: string; de: string };
  /** Where this came from, for the card's provenance line. */
  source: 'weak_item' | 'vocabulary' | 'curriculum';
}

/**
 * Which hat the owl is wearing.
 *
 *   coach   — the default: answers questions, explains mistakes, reports progress.
 *   practice — free German conversation at the learner's sub-level. Every
 *             message is treated as practice EXCEPT the meta questions
 *             (progress / where am I / what should I practise), because a
 *             learner switching to practice mode to drill still needs to be
 *             able to ask "Where am I?" and get an answer.
 */
export type ChatMode = 'coach' | 'practice';


export interface SkillSnapshot {
  category: string;
  accuracy: number;
  correct: number;
  total: number;
}

export interface WeakestSkillSnapshot {
  category: string;
  accuracy: number;
  total: number;
  /** The route that best trains this skill (from `SKILL_ROUTES`). */
  route: string;
}

export interface WeakItemSnapshot {
  itemKey: string;
  moduleType: string;
  errorCount: number;
  correctAnswer: string;
  /**
   * What the learner actually wrote. Kept because it makes the single best
   * distractor for an in-chat drill: offering their own wrong answer back is
   * far more useful than three random words.
   */
  userAnswer: string;
}
