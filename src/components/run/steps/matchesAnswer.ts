/**
 * src/components/run/steps/matchesAnswer.ts
 *
 * Is this typed answer right?
 *
 * ── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────
 * It is the function that decides whether a learner is correct, and it runs for
 * every typed, dictation and repair step in every lesson. Keeping it beside the
 * components would make it untestable in isolation and unreadable in either
 * place.
 *
 * ── WHAT COUNTS AS CORRECT ──────────────────────────────────────────────────
 * `accepted` is the authority and `answer` is a member of it by construction, so
 * a wrong-but-accepted answer is impossible to express.
 *
 * Comparison folds case, accents, terminal punctuation, ß/ss and the typographic
 * apostrophe. Every one of those is something a learner genuinely produces:
 *
 *   · capitalisation — German sentences are capitalised, a noun inside one is not,
 *     and neither is a single-word answer typed at the start of an input;
 *   · accents — a learner on a phone keyboard without a dead key types `schon`;
 *   · ß/ss — `daß`/`dass` and `Straße`/`Strasse` are both encountered;
 *   · terminal punctuation — typing `Schlafzimmer.` instead of `Schlafzimmer`
 *     is not a wrong answer, it is the same answer with a full stop.
 *
 * Each of these is a case where being strict would teach the learner that the
 * app is fussy rather than that the German is right. The folds are applied to BOTH
 * sides, so a key written with different conventions still matches.
 */
export function normaliseAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Strip the combining diacritics NFD just separated out, but NOT the German
    // ones that are not decomposable this way — `ä` decomposes to a + ¨ and is
    // restored by the re-composition below if we ever add it. Folding to the
    // base letter is deliberate: `schön` and `schon` must match.
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[.,!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `input` is one of the acceptable answers for a step. */
export function matchesAnswer(input: string, answer: string, accepted: string[] = []): boolean {
  const target = normaliseAnswer(input);
  if (target === '') return false;
  return [answer, ...accepted].some((candidate) => normaliseAnswer(candidate) === target);
}
