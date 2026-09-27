/**
 * src/lib/intentModel.ts — optional model-assisted intent classification.
 *
 * WHEN THIS RUNS — and, more importantly, WHEN IT DOES NOT
 * --------------------------------------------------------
 * Only when the rule router scores ZERO and a model server is reachable. That
 * restriction is the whole point:
 *
 *   · The common cases (the starter chips, "why was I wrong", "where am I")
 *     stay 100% deterministic and instant.
 *   · Nothing here can re-route a question the rules already understood, so a
 *     flaky model can never turn a progress question into a practice answer.
 *   · With no server it returns null immediately and the caller keeps
 *     `casual_chat` — the offline path is unchanged.
 *
 * WHY NOT JUST ASK THE MODEL ALWAYS
 * ---------------------------------
 * Latency (a second round trip before every real answer), and a real chance of
 * a confident wrong label. The rules are free and correct for the phrases the
 * app itself suggests; this is only for free-form German the rules miss.
 */

import { chat, type OllamaClientConfig } from './ollamaClient';
import type { Intent } from '../types/chatbot';

/** Every label the model is allowed to return. Mirrors the router's union. */
const ALLOWED: readonly Intent[] = [
  'explain_mistake',
  'practice_suggestion',
  'vocab_lookup',
  'grammar_question',
  'progress_check',
  'curriculum_help',
  'motivation',
  'settings',
  'conversation',
];

const PROMPT = [
  'Classify the learner message below into exactly ONE label from this list:',
  ALLOWED.join(', '),
  '',
  'Labels:',
  'explain_mistake = asks why an answer was wrong',
  'practice_suggestion = asks what to study/practise',
  'vocab_lookup = asks the meaning/translation of a word',
  'grammar_question = asks about a German rule',
  'progress_check = asks about XP, level, streak or overall progress',
  'curriculum_help = asks where they are in the course / what is next',
  'motivation = expresses frustration or low mood',
  'settings = asks to change the assistant, model or server',
  'conversation = anything else, especially German small talk',
  '',
  'Reply with the label only. No punctuation, no explanation.',
].join('\n');

/** How long a reclassification is allowed to delay the real answer. */
const CLASSIFY_TIMEOUT_MS = 2500;

/**
 * Returns a better intent, or `null` to keep whatever the rules decided.
 * Never throws.
 */
export async function classifyWithModel(
  message: string,
  config: OllamaClientConfig,
  signal?: AbortSignal,
): Promise<Intent | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const reply = await chat(
      [
        { role: 'system', content: PROMPT },
        { role: 'user', content: message.slice(0, 300) },
      ],
      // temperature 0 and a hard token cap: this is a label, not an essay.
      { ...config, temperature: 0, maxTokens: 12, timeoutMs: CLASSIFY_TIMEOUT_MS },
      controller.signal,
    );

    // Tolerate "Label: progress_check", quotes, or trailing junk.
    const found = reply.toLowerCase().match(/[a-z_]{3,}/);
    if (!found) return null;
    const candidate = found[0] as Intent;
    return ALLOWED.includes(candidate) ? candidate : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
