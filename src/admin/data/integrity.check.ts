/**
 * Self-check for the content-integrity checks.
 *
 * The misalignment detector is the important one: it is what caught 47 rows
 * whose "English" translation was a German word. A heuristic like that is easy
 * to write so that it fires constantly (noise, and the admin stops looking) or
 * never fires (silent). The cases below pin BOTH failure directions, and the
 * false-positive guards get as much attention as the true positives.
 *
 * Run: npx tsx src/admin/data/integrity.check.ts
 */
import {
  buildFindings,
  findDuplicateTerms,
  isMisalignedTranslation,
  normaliseTerm,
  type VocabRow,
} from './integrity';

const failures: string[] = [];
let checks = 0;

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

let seq = 0;
const row = (over: Partial<VocabRow> = {}): VocabRow => ({
  id: `v${++seq}`,
  word: 'Haus',
  partOfSpeech: 'noun',
  translationEn: 'house',
  translationNp: 'घर',
  exampleDe: 'Das Haus ist groß.',
  level: 'A1',
  ...over,
});

console.log('\n=== 1. NORMALISATION ===');
check('trims and case-folds', normaliseTerm('  Haus ') === 'haus');
check('collapses inner whitespace', normaliseTerm('guter   Tag') === 'guter tag');
check('null is an empty string', normaliseTerm(null) === '');
check('undefined is an empty string', normaliseTerm(undefined) === '');

console.log('\n=== 2. MISALIGNED TRANSLATIONS (the real defect) ===');
// A German vocabulary set, which is what the check runs against.
const heads = new Set(['haus', 'ich', 'sie', 'der', 'das', 'gehen', 'dürfen', 'arm', 'essen', 'böse']);

check('a German word in the English slot is flagged', isMisalignedTranslation('gehen', 'Ich', heads));
check('a different German word is flagged', isMisalignedTranslation('dürfen', 'Sie', heads));
check('case does not hide it', isMisalignedTranslation('gehen', 'ich', heads));
check('surrounding space does not hide it', isMisalignedTranslation('gehen', '  Ich  ', heads));
check('a genuine English translation is not flagged', !isMisalignedTranslation('Haus', 'house', heads));
check('a real cognate pair is NOT flagged', !isMisalignedTranslation('Arm', 'arm', heads), 'Arm/arm is correct');
check('an unknown word is not flagged', !isMisalignedTranslation('gehen', 'to walk', heads));
check('a blank translation is not flagged', !isMisalignedTranslation('gehen', '', heads));
check('a null translation is not flagged', !isMisalignedTranslation('gehen', null, heads));
check('a blank word is not flagged', !isMisalignedTranslation('', 'Ich', heads));
check('a null word is not flagged', !isMisalignedTranslation(null, 'Ich', heads));
// The guard against crying wolf: ordinary rows must produce nothing.
const clean = [row(), row({ word: 'Kind', translationEn: 'child' }), row({ word: 'rot', translationEn: 'red' })];
check('ordinary rows produce no misalignment finding', !buildFindings(clean).some((f) => f.code === 'translation-not-english'));

console.log('\n=== 3. THE LIVE DEFECT, AS A FIXTURE ===');
// The exact shape found in production: a run of rows tagged `noun` whose
// translation is a German function word.
//
// The German function words must ALSO appear as vocabulary rows here, because
// that is how the detector works in production — it builds its headword set from
// the vocabulary itself. The live table has ~1,000 entries including "Der",
// "Ich" and "Sie", which is exactly why 47 rows trip the check there and a
// 4-row toy fixture that omits them trips nothing. A fixture that does not
// model that dependency would have "passed" while proving nothing.
const corrupt = [
  row({ word: 'Der', partOfSpeech: 'article', translationEn: 'the', translationNp: 'यो' }),
  row({ word: 'Ich', partOfSpeech: 'pronoun', translationEn: 'I', translationNp: 'म' }),
  row({ word: 'Sie', partOfSpeech: 'pronoun', translationEn: 'you', translationNp: 'तपाईं' }),
  row({ word: 'aufhören', partOfSpeech: 'noun', translationEn: 'Der', translationNp: '', exampleDe: '' }),
  row({ word: 'dürfen', partOfSpeech: 'noun', translationEn: 'Sie', translationNp: '', exampleDe: '' }),
  row({ word: 'gehen', partOfSpeech: 'noun', translationEn: 'Ich', translationNp: '', exampleDe: '' }),
  row({ word: 'Haus', partOfSpeech: 'noun', translationEn: 'house', translationNp: 'घर', exampleDe: 'Das Haus.' }),
];
const corruptFindings = buildFindings(corrupt);
const mis = corruptFindings.find((f) => f.code === 'translation-not-english');
check('the corrupt run is detected', !!mis, JSON.stringify(corruptFindings.map((f) => f.code)));
check('exactly 3 of 7 rows are flagged', mis?.count === 3, String(mis?.count));
check('the clean rows are not flagged', !mis?.samples.some((s) => s.label.startsWith('Haus')));
check('the clean German rows are not flagged', !mis?.samples.some((s) => s.label.startsWith('Der (')));
check('it is ranked as an error', mis?.severity === 'error');

console.log('\n=== 4. MISSING FIELDS ===');
const gappy = [row({ translationNp: '' }), row({ exampleDe: '' }), row({ translationNp: null, exampleDe: '   ' })];
const g = buildFindings(gappy);
check('a blank Nepali translation is a warning', g.find((f) => f.code === 'missing-translation-np')?.severity === 'warning');
check('whitespace counts as blank', (g.find((f) => f.code === 'missing-example-de')?.count ?? 0) === 2, String(g.find((f) => f.code === 'missing-example-de')?.count));
const noCore = [row({ word: '' }), row({ translationEn: null }), row({ level: '  ' })];
const nc = buildFindings(noCore);
check('a missing core field is an ERROR, not a warning', nc.find((f) => f.code === 'missing-core-field')?.severity === 'error');
check('all three core gaps are counted', nc.find((f) => f.code === 'missing-core-field')?.count === 3, String(nc.find((f) => f.code === 'missing-core-field')?.count));

console.log('\n=== 5. DUPLICATES ARE A REVIEW ITEM, NOT AN ERROR ===');
const dupes = findDuplicateTerms([row({ word: 'Danke' }), row({ word: 'danke' }), row({ word: 'Haus' })]);
check('a repeated headword groups together', dupes.get('danke')?.length === 2, String(dupes.get('danke')?.length));
check('a unique word is not a duplicate group', !dupes.has('haus'));
const d = buildFindings([row({ word: 'Danke' }), row({ word: 'danke' })]);
check('duplicates are reported at info severity', d.find((f) => f.code === 'duplicate-word')?.severity === 'info');
check('duplicates are never an error', !d.some((f) => f.severity === 'error'));
// "Essen" and "essen" are genuinely different words. Calling that an ERROR
// would be a false positive, which is exactly why this is info.
check(
  'Essen/essen is reported but not as an error',
  buildFindings([row({ word: 'Essen' }), row({ word: 'essen' })]).find((f) => f.code === 'duplicate-word')?.severity === 'info',
);

console.log('\n=== 6. ORDERING AND SHAPE ===');
const everything = buildFindings([
  ...corrupt,
  row({ translationNp: '' }),
  row({ exampleDe: '' }),
  row({ word: 'Danke' }),
  row({ word: 'danke' }),
]);
const sev = everything.map((f) => f.severity);
check('errors sort above warnings', sev.lastIndexOf('error') < sev.indexOf('warning'), sev.join(','));
check('every finding has a non-empty count', everything.every((f) => f.count > 0));
check('every finding has a title and detail', everything.every((f) => f.title.length > 0 && f.detail.length > 0));
check('finding ids are unique', new Set(everything.map((f) => f.id)).size === everything.length);
// Same dependency again: 'Ich' must be a headword before it can be detected as
// a translation, so one establishing row is included.
const many = [
  row({ word: 'Ich', partOfSpeech: 'pronoun', translationEn: 'I' }),
  ...Array.from({ length: 40 }, () => row({ word: 'gehen', partOfSpeech: 'noun', translationEn: 'Ich' })),
];
const capped = buildFindings(many, 5).find((f) => f.code === 'translation-not-english')!;
check('samples are capped at the requested size', capped.samples.length === 5, String(capped.samples.length));
check('the COUNT is the true number, not the sample size', capped.count === 40, String(capped.count));

console.log('\n=== 7. EMPTY AND DEGENERATE INPUT ===');
check('no rows produce no findings', buildFindings([]).length === 0);
check('an empty headword set flags nothing', !isMisalignedTranslation('gehen', 'Ich', new Set()));
check('a single row is never a duplicate', findDuplicateTerms([row()]).size === 0);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
