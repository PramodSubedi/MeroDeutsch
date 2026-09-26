/**
 * src/utils/answerNormalize.ts
 *
 * Shared answer normalizer for typed + spoken drills (Listen & Type, Dictation,
 * Greetings, Numbers, Calendar, Pronunciation).
 *
 * The exact same body was copy-pasted into four pages under four different
 * local names, which meant any matching-rule change had to be made four times
 * and silently drifted if it wasn't. One definition keeps grading consistent.
 *
 * It now also owns the SPOKEN-answer comparator. PronunciationPage used to carry
 * its own private `normalizeForCompare` + Levenshtein, so dictation graded
 * speech-normalised text with one rule while pronunciation graded the same text
 * with another — and a word that counted as correct in one tool could be marked
 * wrong in the other.
 */
export function normalizeAnswer(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Fold a German word down to its letters, for comparing what the SPEECH
 * RECOGNISER heard against the spelling:
 *   - lowercased
 *   - accents/diacritics stripped (ä→a, ö→o, ü→u)
 *   - ß→ss, because "Straße" is transcribed as "Strasse" and vice versa
 *
 * Deliberately NOT the same as `normalizeAnswer`: typing drills should accept
 * the diacritics as written, because reproducing them is the skill being
 * tested. Speech recognition simply cannot recover them reliably.
 */
export function normalizeForSpeech(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (ä→a, ö→o, ü→u)
    .replace(/ß/g, 'ss');
}

/** Classic Levenshtein edit distance (iterative, two-row DP). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Fuzzy match for Web Speech transcripts.
 *
 * ASR routinely transcribes correct-but-accented speech with 1–2 character
 * differences ("haus" → "hauss"/"hous"). Exact equality alone produces false
 * negatives that penalise CORRECT pronunciation, which is worse than being
 * slightly lenient.
 *
 * Tolerance: at most 1 edit for short words, ~20% of length for longer ones.
 */
export function isCloseMatch(spoken: string, target: string): boolean {
  const a = normalizeForSpeech(spoken);
  const b = normalizeForSpeech(target);
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;
  const maxDist = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.2));
  return levenshtein(a, b) <= maxDist;
}

/**
 * Which characters of `target` did the speaker most likely get wrong?
 *
 * Returns ascending indices into the ORIGINAL `target` string, so the UI can
 * highlight the real spelling directly.
 *
 * Returns `[]` — meaning "show no per-character hint" — in every case where a
 * character-level reading would be misleading:
 *   - the two fold to the same string (nothing to mark)
 *   - the fold is not length-preserving, e.g. "Straße" (6 chars) folds to
 *     "strasse" (7). Indices into the folded string would point at the wrong
 *     characters of the real word, so we decline rather than mis-highlight.
 *   - the inputs are too far apart to align meaningfully.
 *
 * This is the difference between "wrong" and "learnable": a learner who says
 * "Hous" for "Haus" needs to be told the U, not just marked incorrect.
 */
export function speechDiffIndices(spoken: string, target: string): number[] {
  const a = normalizeForSpeech(spoken);
  const b = normalizeForSpeech(target);

  if (a === b) return [];
  // Length must be preserved for folded indices to index the original.
  if (a.length === 0 || b.length === 0) return [];
  if (b.length !== target.length) return [];
  // Too far apart for a character-level reading to mean anything.
  if (levenshtein(a, b) > Math.max(2, Math.floor(b.length / 2))) return [];

  // Longest common subsequence, then backtrack. On the way back, every target
  // index that is never aligned to a matching spoken character is a mistake:
  // either substituted (something else was said in its place) or dropped.
  const rows = a.length + 1;
  const cols = b.length + 1;
  const lcs: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      lcs[i][j] =
        a[i - 1] === b[j - 1]
          ? lcs[i - 1][j - 1] + 1
          : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  const bad = new Set<number>();
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && lcs[i][j] === lcs[i - 1][j - 1] + 1) {
      // Aligned — this character was pronounced correctly.
      i--;
      j--;
      continue;
    }
    if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      // The spoken string has a character the target does not. The TARGET
      // character at j-1 is therefore left unaligned: it was either replaced by
      // this stray sound or dropped outright, and in both cases it is the one to
      // flag. Marking it here is what the first version missed — it assumed an
      // inserted character never affected the target, so "Vatter" for "Vater"
      // came back with nothing highlighted at all.
      bad.add(j - 1);
      i--;
    } else {
      // Target character cannot be aligned at all.
      bad.add(j - 1);
      j--;
    }
  }
  // Anything the target still has left is a deletion — the speaker dropped it.
  while (j > 0) {
    bad.add(j - 1);
    j--;
  }

  const indices = Array.from(bad).sort((x, y) => x - y);
  // Guard: the fold must be index-aligned for these to address the original.
  return b.length === target.length ? indices : [];
}
