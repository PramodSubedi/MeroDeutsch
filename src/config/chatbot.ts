/**
 * src/config/chatbot.ts — configuration + personality for the local companion.
 *
 * LOCAL-FIRST BY CONSTRUCTION
 * ----------------------------
 * There is no cloud fallback anywhere in this feature. The base URL points at
 * the learner's own machine; if nothing answers, the companion degrades to
 * deterministic `fallbackReply` text built by `responseHandlers.ts`. That is a
 * deliberate product decision, not an omission.
 *
 * THE CORS TRAP (read this before "why doesn't it work?")
 * -------------------------------------------------------
 * The app ships to `https://merodeutsch.pramods.com.np` — an HTTPS origin.
 * Ollama's default CORS allowlist only covers `http://localhost:*` and
 * `http://127.0.0.1:*`, so from the deployed site the browser BLOCKS the
 * request unless the learner opts in:
 *
 *   OLLAMA_ORIGINS="https://merodeutsch.pramods.com.np" ollama serve
 *
 * On mobile there is no `localhost` at all, so the companion is desktop-only
 * there. Both facts are surfaced in the UI rather than failing silently — see
 * `ollamaHealth.ts` and the header status dot.
 */

import type {
  ChatbotSettings,
  ChatPreference,
  LanguageMix,
  PersonalityIntensity,
} from '../types/chatbot';

/** localStorage base key. Per-user scoped via `scopedKey`, so it never
 *  collides with progress / review-queue / XP / A1-path keys (.clinerules
 *  C13/C14). */
export const CHATBOT_STORAGE_KEY = 'meroDeutschChatbot';

/**
 * `import.meta.env` is a Vite INJECTION and is absent under bare `tsx`, which is
 * what the `check:*` suites run on. Read defensively for the same reason, and in
 * the same shape, as `lib/qaBridge.ts` and `lib/supabase.ts` — a config module
 * that cannot be imported outside a bundler cannot be unit-tested at all.
 */
function readEnv(key: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = env?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** Feature flag. `VITE_CHATBOT_ENABLED=false` compiles the feature out. */
export const CHATBOT_ENABLED =
  String(readEnv('VITE_CHATBOT_ENABLED') ?? 'true').toLowerCase() !== 'false';

const envUrl = (readEnv('VITE_OLLAMA_BASE_URL') ?? '').trim();
const envModel = (readEnv('VITE_OLLAMA_DEFAULT_MODEL') ?? '').trim();

export const CHATBOT_CONFIG = {
  defaultBaseUrl: envUrl || 'http://localhost:11434',
  defaultModel: envModel || 'qwen2.5:3b',
  /** Tried in order when the configured model is not installed locally. */
  fallbackModels: ['qwen2.5:3b', 'llama3.2:3b', 'phi3.5:3.8b', 'gemma2:2b'],
  temperature: 0.7,
  maxTokens: 1500,
  /**
   * Approximate context budget in CHARACTERS (~4 chars/token). Deliberately
   * well under a 3B model's 8k window so system prompt + history + this block
   * + the reply all fit. `promptBuilder.fitToBudget` enforces it.
   */
  contextBudgetChars: 6000,
  /** Turns of history replayed to the model. */
  historyTurns: 10,
  /** Messages kept in persisted history. */
  storedMessages: 20,
  /** Health poll interval while the sidebar is open. */
  healthCheckIntervalMs: 30_000,
  /** Abort a generation that runs too long. */
  requestTimeoutMs: 60_000,
  /** Probed first; short so a wrong URL fails fast. */
  healthTimeoutMs: 2500,
} as const;

export const DEFAULT_SETTINGS: ChatbotSettings = {
  enabled: true,
  baseUrl: CHATBOT_CONFIG.defaultBaseUrl,
  model: CHATBOT_CONFIG.defaultModel,
  temperature: CHATBOT_CONFIG.temperature,
  maxTokens: CHATBOT_CONFIG.maxTokens,
  intensity: 'balanced',
  autoOpenOnMistake: true,
  languageMix: 'de_en_ne',
  preferences: [],
  onboarded: false,
};

/** Each preference maps to one prompt line — see `lib/chatPreferences.ts`. */
export const PREFERENCE_OPTIONS: ReadonlyArray<{
  id: ChatPreference;
  en: string;
  de: string;
  hint: string;
}> = [
  { id: 'simple', en: 'Explain simply', de: 'Einfach erklären', hint: 'Shorter sentences, less jargon.' },
  { id: 'examples', en: 'More examples', de: 'Mehr Beispiele', hint: 'Always add a German example.' },
  { id: 'german_only', en: 'German only', de: 'Nur Deutsch', hint: 'No English or Nepali gloss.' },
  { id: 'slow_down', en: 'Go slow', de: 'Langsamer', hint: 'One idea at a time, more repetition.' },
];

export const INTENSITY_OPTIONS: ReadonlyArray<{
  id: PersonalityIntensity;
  en: string;
  de: string;
}> = [
  { id: 'serious', en: 'Serious — just the grammar', de: 'Seriös — nur die Grammatik' },
  { id: 'balanced', en: 'Balanced — a little cheeky', de: 'Ausgewogen — etwas frech' },
  { id: 'playful', en: 'Very playful — maximum teasing', de: 'Sehr verspielt — maximal neckisch' },
];

export const LANGUAGE_MIX_OPTIONS: ReadonlyArray<{ id: LanguageMix; en: string; de: string }> = [
  { id: 'de_en', en: 'Deutsch + English', de: 'Deutsch + English' },
  { id: 'de_en_ne', en: 'Deutsch + English + नेपाली', de: 'Deutsch + English + नेपाली' },
];

/**
 * Mero's personality.
 *
 * `catchphrases` is a SUGGESTION LIST, not a script: the system prompt tells
 * the model to draw on these but never repeat one twice in a row. Hard-coding
 * one as a fixed response is exactly what makes a mascot feel like a robot.
 */
export const MERO_PERSONALITY = {
  name: 'Mero',
  species: 'Eule (owl)',
  traits: ['playful', 'teasing', 'challenging', 'encouraging', 'knowledgeable'],
  catchphrases: [
    'Na, wer hat denn da wieder den Artikel vergessen? 🦉',
    'Nicht schlecht! Aber beim nächsten Mal ohne Raten, ja? 😏',
    'Perfekt! Dein Gehirn wächst gerade Federn. 🪶',
    'Der Akkusativ beißt nicht — er knurrt nur. 🦷',
  ],
} as const;

/** Per-intensity system-prompt directives. */
export const INTENSITY_DIRECTIVE: Record<PersonalityIntensity, string> = {
  serious:
    'TONE: Serious and precise. No jokes, no emojis, no teasing. Answer the question and stop.',
  balanced:
    'TONE: Warm and a little cheeky. Occasional dry joke, at most one emoji per reply. Never sarcastic about genuine effort.',
  playful:
    'TONE: Playful, teasing and challenging. Banter freely, tease about repeated mistakes, 1-2 emojis. NEVER cruel — the learner is a beginner and must feel encouraged, never mocked.',
};

/**
 * Where the companion is allowed to appear.
 *
 * Matched as PREFIXES, not exact strings, because the learning surface includes
 * dynamic segments (`/checkpoint/3`, `/lesson/7`, `/lesson/7/notes`) that a
 * static string list can never match.
 *
 * Deliberately EXCLUDED: `/settings`, `/auth`, `/welcome`, `/analytics`,
 * `/import`, `/privacy`, `/terms`, `/help`, `/feedback` — a study aid has no
 * business on a settings or legal page.
 */
const LEARNING_ROUTE_PREFIXES: readonly string[] = [
  '/home',
  '/learn',
  '/alphabet',
  '/numbers',
  '/calendar',
  '/articles',
  '/greetings',
  '/glossary',
  '/vocab-trainer',
  '/dictation',
  '/grammar',
  '/pronunciation',
  '/roleplay',
  '/practice',
  '/article-sprint',
  '/rapid-fire',
  '/rapid-blitz',
  '/stories',
  '/sentence-builder',
  '/games',
  '/email-builder',
  '/dashboard',
  '/checkpoint',
  '/lesson',
];

/** Is this route a learn/practice/checkpoint surface? */
export function isLearningRoute(pathname: string): boolean {
  return LEARNING_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Strip a trailing slash so `/articles/` and `/articles` agree. */
export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}



