/**
 * src/lib/promptBuilder.ts — assemble the model request.
 *
 * PURE FUNCTIONS ONLY. No hooks, no fetch, no storage. Given the same inputs
 * this produces the same prompt, which is what makes grounding debuggable.
 *
 * WHY A BUDGETED CONTEXT BLOCK
 * ----------------------------
 * A 3B model has ~8k tokens. System prompt + history + context + reply has to
 * fit or the server silently truncates — usually from the END, which would eat
 * exactly the grounding we added last. So `fitToBudget` trims the context
 * block (least-important-first) BEFORE it is ever sent.
 *
 * `maxContextChars` is tuned so the block is the FIRST thing to shrink. XP and
 * module position are a few characters; the weak-item list is not.
 */

import { CHATBOT_CONFIG, INTENSITY_DIRECTIVE, MERO_PERSONALITY } from '../config/chatbot';
import { preferenceDirectives } from './chatPreferences';
import type { ChatbotSettings, ContextSnapshot, ResponsePlan } from '../types/chatbot';
import type { WireMessage } from './ollamaClient';
import { levelDirective, resolveAnaphora, type ConversationState } from './conversationManager';
import type { PageContext } from './pageContext';

export interface PromptOptions {
  context: ContextSnapshot;
  plan: ResponsePlan;
  settings: ChatbotSettings;
  conversation?: ConversationState;
  /** Assembled screen context; appended so "explain this page" is answerable. */
  page?: PageContext | null;
}

/**
 * Trim a context block to fit, marking that it was cut.
 *
 * Sections are newline-separated `-`/`1.` bullets, so dropping whole trailing
 * lines keeps the block readable instead of leaving a half-sentence.
 */
export function fitToBudget(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text.split('\n');
  const kept: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > maxChars) break;
    kept.push(line);
    used += line.length + 1;
  }
  const note = `…(context trimmed — ${lines.length - kept.length} line(s) omitted to fit the model context)`;
  return `${kept.join('\n')}\n${note}`;
}

function languageRules(ctx: ContextSnapshot, settings: ChatbotSettings): string {
  if (ctx.isDE) {
    return 'LANGUAGE: Reply in GERMAN. The learner chose "Nur Deutsch" — do NOT add English or Nepali helper text.';
  }
  if (settings.languageMix === 'de_en') {
    return 'LANGUAGE: Reply in English, quoting German terms and examples. No Nepali.';
  }
  return 'LANGUAGE: Reply in English, quoting German terms. Add a one-line Nepali gloss when the learner seems stuck.';
}

export function buildSystemPrompt(opts: PromptOptions): string {
  const { context, plan, settings, conversation, page } = opts;

  const level = conversation?.userLevel;
  const prefs = preferenceDirectives(settings.preferences);
  const header = [
    `You are ${MERO_PERSONALITY.name}, a ${MERO_PERSONALITY.species} and the study companion inside MeroDeutsch, a German-learning app used by beginners.`,
    `Traits: ${MERO_PERSONALITY.traits.join(', ')}.`,
    INTENSITY_DIRECTIVE[settings.intensity],
    level ? levelDirective(level) : '',
    languageRules(context, settings),
    // The learner's standing preferences, AFTER the level but BEFORE the
    // grounding block — so they shape the style without ever outranking a fact.
    prefs,
  ]
    .filter(Boolean)
    .join('\n');

  const hardRules = [
    'HARD RULES:',
    '1. The <learner_data> block below is the ONLY source of truth about this learner. Never invent XP, levels, streaks, scores, or mistakes.',
    '2. If you do not know a fact, say you are not sure. A wrong confident answer is worse than "I don\'t know".',
    '3. Be brief. This is a sidebar, not an essay. Default to 1-3 sentences.',
    '4. If you correct the learner, correct exactly ONE thing and briefly.',
    '5. Never speak German text with an audio-like tone marker or pretend to play audio.',
  ].join('\n');

  const style = [
    'STYLE: Markdown is fine (short lists, **bold**). You may use these in character, but never repeat the same one twice in a row:',
    ...MERO_PERSONALITY.catchphrases.map((c) => `- ${c}`),
  ].join('\n');

  const greeting = context.userName ? `Learner name: ${context.userName}.` : 'Learner is a guest (not signed in).';

  const block = fitToBudget(
    [`<learner_data>`, greeting, `Page: ${context.currentPathname}`, plan.contextBlock].join('\n\n'),
    CHATBOT_CONFIG.contextBudgetChars,
  );

  // The screen context is appended OUTSIDE the trimmed block: it is small, it
  // is the whole point of an "explain this page" question, and losing it to
  // budget trimming would be the worst possible place to lose information.
  const pageBlock = page
    ? [
        '<page_context>',
        ...page.facts,
        'Answer about THIS screen. Do not give a generic lesson when the page has specifics.',
        '</page_context>',
      ].join('\n')
    : '';

  return [header, '', hardRules, '', style, '', block, '</learner_data>', pageBlock]
    .filter(Boolean)
    .join('\n');
}

/**
 * Wrap the learner's message with the conversational scaffolding a 3B model
 * needs: the resolved topic, and an instruction to stay on level.
 */
export function buildUserPrompt(
  message: string,
  context: ContextSnapshot,
  conversation?: ConversationState,
): string {
  const resolved = conversation ? resolveAnaphora(conversation, message) : message;
  const parts = [resolved];
  if (conversation?.topic && conversation.topic.toLowerCase() !== resolved.toLowerCase()) {
    parts.push(`(Conversation topic so far: ${conversation.topic})`);
  }
  parts.push(
    `Answer the learner's actual question. Keep it at their level (${context.cefr || 'A1'}).`,
  );
  return parts.join('\n\n');
}

/** Cap stored history at the newest N messages, oldest first. */
export function recentHistory(
  messages: readonly { role: WireMessage['role']; content: string }[],
  turns: number = CHATBOT_CONFIG.historyTurns,
): WireMessage[] {
  const usable = messages.filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim(),
  );
  return usable.slice(-turns).map((m) => ({ role: m.role, content: m.content }));
}
