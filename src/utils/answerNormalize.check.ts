/**
 * Quick sanity check for the speech grader. Run with:
 *   npx tsx src/utils/answerNormalize.check.ts
 *
 * Kept in the repo (rather than a throwaway) because the fuzzy tolerance and
 * the diff alignment are the kind of thing that silently drifts: a change that
 * still "feels right" for a human can start failing a common German word.
 */
import { speechDiffIndices, isCloseMatch } from './answerNormalize';

const CASES: Array<[spoken: string, target: string, expectClose: boolean]> = [
  // The ASR false-negatives this tolerance exists for.
  ['Hous', 'Haus', true],
  ['haus', 'Haus', true],
  ['hauss', 'Haus', true],
  ['Wasser', 'Wasser', true],
  ['Vater', 'Vater', true],
  ['Katze', 'Katze', true],
  // ß / umlaut transcription differences must be forgiven.
  ['Strasse', 'Straße', true],
  ['Uber', 'Über', true],
  // One-edit tolerance applies even to short words — this is PRE-EXISTING
  // shipped behaviour (max(1, 20% of length)), documented rather than changed
  // here. A 5-letter word tolerates 1 wrong letter, which is lenient by design:
  // over-penalising a correct-but-accented attempt is the worse failure.
  ['Katse', 'Katze', true],
  ['Vatter', 'Vater', true],
  // Two or more edits, and total nonsense, must fail.
  ['katzzz', 'Katze', false],
  ['xyz', 'Buch', false],
  ['Buch', 'Buch', true],
];

let failures = 0;
for (const [spoken, target, expectClose] of CASES) {
  const got = isCloseMatch(spoken, target);
  if (got !== expectClose) {
    failures += 1;
    console.error(`FAIL isCloseMatch(${JSON.stringify(spoken)}, ${JSON.stringify(target)}) = ${got}, want ${expectClose}`);
  }
}

// The diff must mark the character the speaker actually got wrong, and must
// return indices into the ORIGINAL word (so the UI can highlight it directly).
const DIFFS: Array<[spoken: string, target: string, wantMarked: string]> = [
  ['Hous', 'Haus', 'H[a]us'],
  ['Katse', 'Katze', 'Kat[z]e'],
  ['Vatter', 'Vater', 'V[a]ter'], // one stray spoken vowel -> the A is flagged
  ['haus', 'Haus', 'Haus'], // identical after folding -> nothing marked
  // ß expands under folding (6 chars -> 7), so indices would not line up and
  // the helper must decline rather than mis-highlight.
  ['Strasze', 'Straße', 'Straße'],
];

for (const [spoken, target, wantMarked] of DIFFS) {
  const bad = speechDiffIndices(spoken, target);
  const marked = target
    .split('')
    .map((c, i) => (bad.includes(i) ? `[${c}]` : c))
    .join('');
  if (marked !== wantMarked) {
    failures += 1;
    console.error(`FAIL diff(${JSON.stringify(spoken)}, ${JSON.stringify(target)}) = ${marked}, want ${wantMarked}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`answerNormalize: ${CASES.length + DIFFS.length} checks passed`);