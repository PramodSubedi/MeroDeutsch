/**
 * src/lib/conversationManager.ts — German chat-mode state.
 *
 * Framework-free on purpose: plain data + pure functions, so the React store
 * owns the lifecycle and this module stays trivially testable.
 *
 * WHAT IT ACTUALLY SOLVES
 * ----------------------
 * A 3B model loses the thread fast. Two cheap, high-value fixes:
 *
 *  1. LEVEL PINNING. "A1" is too coarse — a learner in module 2 (articles) can
 *     handle far more than one in module 1 (greetings). `levelForContext` maps
 *     the real CEFR preference + A1 position onto a sub-level so the model's
 *     output length and clause count actually track the course.
 *
 *  2. ANAPHORA RESOLUTION. German is heavy on pronouns; a beginner asking
 *     "Wie heißen Sie? — Anna. — Wo arbeitet sie?" gives the model a dangling
 *     "sie". `bindEntities`/`resolveAnaphora` rewrite the dangling pronoun to
 *     its referent BEFORE the text reaches the model, so it does not have to
 *     guess.
 */

export type UserLevel = 'A1.1' | 'A1.2' | 'A2.1';

export interface ConversationState {
  topic: string;
  turnCount: number;
  userLevel: UserLevel;
  /** pronoun -> the noun it refers to, e.g. { sie: 'Anna' }. */
  keyEntities: Record<string, string>;
}

export function createConversation(): ConversationState {
  return { topic: '', turnCount: 0, userLevel: 'A1.1', keyEntities: {} };
}

/**
 * Sub-level from the real CEFR preference + how far into the A1 spine they are.
 * Greetings/numbers learners (modules 0-2) get A1.1; articles+ (3+) get A1.2.
 * A CEFR of A2 or above is honoured outright rather than ignored.
 */
export function levelForContext(cefr: string, unitIndex: number): UserLevel {
  const level = cefr.trim().toUpperCase();
  if (level.startsWith('B')) return 'A2.1';
  if (level.startsWith('A2')) return 'A2.1';
  if (level.startsWith('A1')) return unitIndex >= 3 ? 'A1.2' : 'A1.1';
  return unitIndex >= 3 ? 'A1.2' : 'A1.1';
}

/** Level directive injected into the system prompt. */
export function levelDirective(level: UserLevel): string {
  switch (level) {
    case 'A1.1':
      return 'LEVEL: absolute beginner (A1.1). Reply in ONE short German sentence, then a simple English gloss. No subordinate clauses, no Perfekt.';
    case 'A1.2':
      return 'LEVEL: beginner (A1.2). Reply in 1-2 short German sentences. Present tense only. Add an English gloss if the learner mixes languages.';
    case 'A2.1':
      return 'LEVEL: A2.1. You may use two short German sentences and simple Perfekt. Still keep vocabulary A1-A2.';
  }
}

/* ── anaphora ─────────────────────────────────────────────────────────────── */

const PRONOUN_WORDS = ['er', 'sie', 'es', 'he', 'she', 'it'];

/** `Anna und sie` / `Anna, sie ist` -> bind sie -> Anna. */
function bindEntities(state: ConversationState, text: string): Record<string, string> {
  const entities = { ...state.keyEntities };
  // Capture the word before the pronoun, skipping common copulas/fillers.
  // NOTE: the connector group is NON-CAPTURING `(?:und|,|ist|is)`, so the
  // pronoun is group **2** — reading `match[3]` threw on every input.
  const pattern = /\b([A-ZÄÖÜ][\wÄÖÜäöüß-]{2,})\s*(?:und|,|ist|is)?\s*(er|sie|es|he|she|it)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const referent = match[1];
    const pronoun = match[2].toLowerCase();
    if (!PRONOUN_WORDS.includes(pronoun)) continue;
    if (referent.toLowerCase() === pronoun) continue;
    entities[pronoun] = referent;
  }
  return entities;
}

/** Rewrite dangling pronouns to their referent so the model never guesses. */
export function resolveAnaphora(state: ConversationState, text: string): string {
  const entries = Object.entries(state.keyEntities);
  if (!entries.length) return text;
  return text.replace(/\b(Er|Sie|Es|er|sie|es|he|she|it)\b/g, (match, word: string) => {
    const pronoun = word.toLowerCase();
    // German capitalises "sie/ihr" for the formal address — do not rewrite those.
    if (word === 'Sie') return match;
    const referent = state.keyEntities[pronoun];
    return referent ? referent : match;
  });
}

/** Coarse topic guess — the longest capitalised word, else the first noun-ish token. */
function guessTopic(text: string): string {
  const words = text.match(/[A-ZÄÖÜ][\wÄÖÜäöüß-]{2,}/g);
  if (words && words.length) {
    // Prefer a non-sentence-initial word if one exists (less likely to be "Ich").
    const candidate = words.find((w) => w.length > 3) ?? words[0];
    return candidate;
  }
  const first = text.trim().split(/\s+/)[0];
  return first ? first.replace(/[^\wÄÖÜäöüß-]/g, '') : '';
}

/**
 * Advance the conversation after one exchange. Pure — returns a new state.
 *
 * `retainEntities` prunes pronouns that have not been touched for a long
 * stretch so the map cannot grow without bound over a long session.
 */
export function advanceConversation(
  state: ConversationState,
  userMessage: string,
  opts: { level?: UserLevel } = {},
): ConversationState {
  const keyEntities = bindEntities(state, userMessage);
  const trimmed: Record<string, string> = {};
  let i = 0;
  for (const [k, v] of Object.entries(keyEntities)) {
    if (i++ >= 8) break; // hard cap — the model only needs a few
    trimmed[k] = v;
  }
  return {
    topic: guessTopic(userMessage) || state.topic,
    turnCount: state.turnCount + 1,
    userLevel: opts.level ?? state.userLevel,
    keyEntities: trimmed,
  };
}

/** Is this turn still German chat mode (vs. an English meta question)? */
export function looksGerman(message: string): boolean {
  const germanish =
    /\b(ich|du|sie|er|es|und|oder|aber|nicht|kein|haben|sein|heißen|wochen?|wo\b|wann|warum|wie)\b/i;
  const latinOnly = /^[A-Za-z\s'.,!?-]+$/;
  return germanish.test(message) || !latinOnly.test(message);
}
