/**
 * src/utils/answerNormalize.ts
 *
 * Shared answer normalizer for typed drills (Listen & Type, Dictation,
 * Greetings, Numbers, Calendar).
 *
 * The exact same body was copy-pasted into four pages under four different
 * local names, which meant any matching-rule change had to be made four times
 * and silently drifted if it wasn't. One definition keeps grading consistent.
 */
export function normalizeAnswer(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}
