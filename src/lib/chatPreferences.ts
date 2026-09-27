/**
 * src/lib/chatPreferences.ts — standing style instructions from the learner.
 *
 * These are preferences about HOW to answer, never about WHAT is true. The
 * grounding block in the system prompt is appended AFTER them precisely so a
 * preference can never talk the model out of a fact: "explain simply" shortens
 * the answer, it does not license a vaguer one.
 */

import type { ChatPreference } from '../types/chatbot';

/** One prompt line per preference. */
const PREFERENCE_DIRECTIVE: Record<ChatPreference, string> = {
  simple:
    'STYLE: The learner asked for SIMPLE explanations. One idea per sentence, no grammar jargon, define any technical term the first time you use it.',
  examples:
    'STYLE: The learner asked for MORE EXAMPLES. Always give at least one concrete German example sentence after any rule you explain.',
  german_only:
    'STYLE: The learner asked for GERMAN ONLY. Do not add English or Nepali glosses — German only, with the rule stated in plain German.',
  slow_down:
    'STYLE: The learner asked you to GO SLOW. Ask one question at a time, repeat the key word, and leave room for them to answer before moving on.',
};

/** Render the active preferences as prompt lines. Empty string when none. */
export function preferenceDirectives(prefs: readonly ChatPreference[] | undefined): string {
  if (!prefs || prefs.length === 0) return '';
  return prefs
    .filter((p): p is ChatPreference => p in PREFERENCE_DIRECTIVE)
    .map((p) => PREFERENCE_DIRECTIVE[p])
    .join('\n');
}

/** Add a preference, keeping the array unique. */
export function addPreference(
  prefs: readonly ChatPreference[],
  pref: ChatPreference,
): ChatPreference[] {
  return prefs.includes(pref) ? [...prefs] : [...prefs, pref];
}

/** Remove a preference. */
export function removePreference(
  prefs: readonly ChatPreference[],
  pref: ChatPreference,
): ChatPreference[] {
  return prefs.filter((p) => p !== pref);
}

export function hasPreference(
  prefs: readonly ChatPreference[],
  pref: ChatPreference,
): boolean {
  return prefs.includes(pref);
}
