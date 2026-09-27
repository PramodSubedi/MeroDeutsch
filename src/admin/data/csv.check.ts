/**
 * src/admin/data/csv.check.ts
 *
 *   npx tsx src/admin/data/csv.check.ts
 *
 * The property under test: NOTHING an admin exports can execute when the file
 * is opened in a spreadsheet.
 *
 * This exists because the control centre had TWO encoders that disagreed — the
 * review-queue export neutralised formula injection and the vocabulary export
 * only doubled quotes. Quoting alone does not stop `=1+1`; only a leading
 * apostrophe does. Divergent copies of a security control is the failure mode
 * this file is written against.
 */
import { csvCell, csvDocument, csvLine } from './csv';
import { toCsv as vocabCsv } from './vocabulary';
import { toCsv as queueCsv } from './reviewQueue';
import { usersToCsv } from './users';

let checks = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  checks += 1;
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

/**
 * The security property, stated once so each check below is unambiguous:
 * after the CSV quoting is stripped, no cell may BEGIN with a formula trigger.
 *
 * A cell that needs quoting comes back as `"'=HYPERLINK(..)"` — the apostrophe
 * is inside the quotes, which is correct: Excel strips the quotes and is then
 * left with a leading `'`, forcing text. So the check has to account for
 * quoting rather than just checking `.startsWith("'")`.
 */
function isDefused(cell: string): boolean {
  const unquoted = /^"(.*)"$/s.exec(cell)?.[1] ?? cell;
  return /^'/.test(unquoted);
}

console.log('\n=== 1. FORMULA TRIGGERS ARE NEUTRALISED ===');
for (const lead of ['=', '+', '-', '@']) {
  check(`${lead} is defused`, isDefused(csvCell(`${lead}1+1`)), csvCell(`${lead}1+1`));
}
check('=HYPERLINK is defused', isDefused(csvCell('=HYPERLINK("http://evil","x")')), csvCell('=HYPERLINK("http://evil","x")'));
check('=cmd|... is defused', isDefused(csvCell('=cmd|\' /C calc\'!A0')), csvCell('=cmd|\' /C calc\'!A0'));
check('a leading TAB is defused', isDefused(csvCell('\t=1+1')), JSON.stringify(csvCell('\t=1+1')));
check('a leading CR is defused', isDefused(csvCell('\r=1+1')), JSON.stringify(csvCell('\r=1+1')));
// The nastiest real-world payload: a formula that also contains a comma, so it
// needs quoting AND defusing together.
check('a formula containing a comma is both quoted and defused', csvCell('=a,b') === '"\'=a,b"', csvCell('=a,b'));

console.log('\n=== 2. ORDINARY VALUES ARE UNTOUCHED ===');
// The apostrophe must ONLY appear for real triggers, or every export becomes
// littered with stray quotes and stops being readable.
check('a plain word is unchanged', csvCell('Haus') === 'Haus', csvCell('Haus'));
check('a number is unchanged', csvCell(42) === '42', csvCell(42));
check('a zero is unchanged', csvCell(0) === '0', csvCell(0));
check('negatives ARE defused (they start with -)', csvCell(-5).startsWith("'"));
check('an interior - is fine', csvCell('well-known') === 'well-known', csvCell('well-known'));
check('an interior = is fine', csvCell('a=b') === 'a=b', csvCell('a=b'));
check('a German word is unchanged', csvCell('Mutter') === 'Mutter');
check('null becomes empty', csvCell(null) === '');
check('undefined becomes empty', csvCell(undefined) === '');
check('an empty string stays empty', csvCell('') === '');

console.log('\n=== 3. RFC 4180 QUOTING STILL WORKS ===');
// Quoting is a separate concern from formula safety, and both must hold.
check('a comma forces quoting', csvCell('a,b').startsWith('"'), csvCell('a,b'));
check('a double quote is doubled', csvCell('say "hi"') === '"say ""hi"""', csvCell('say "hi"'));
check('a newline forces quoting', csvCell('a\nb').startsWith('"'));
// A German quotation mark is NOT an ASCII `"`, so it must not be doubled.
check('a German quotation mark is left alone', csvCell('„Haus"') === '"„Haus"""', JSON.stringify(csvCell('„Haus"')));

console.log('\n=== 4. LINES AND DOCUMENTS ===');
check('csvLine joins cells', csvLine(['a', 'b']) === 'a,b');
check('csvLine defuses each cell', csvLine(['=1', 'b']) === "'=1,b", csvLine(['=1', 'b']));
const doc = csvDocument(['x', 'y'], [[1, 2]]);
check('a document has a header row', doc.split('\n')[0] === 'x,y', doc);
check('a document has its data rows', doc.split('\n')[1] === '1,2', doc);
check('an empty document is just the header', csvDocument(['x'], []) === 'x');
check('an empty cell becomes empty', csvLine([null, 'b']) === ',b');

console.log('\n=== 5. THE VOCABULARY EXPORT IS NOW SAFE ===');
// This is the regression that motivated the shared encoder.
const injectedVocab = [
  {
    source: 'db' as const, id: 'v1', word: '=cmd|\' /C calc\'!A0', article: 'die',
    partOfSpeech: 'noun', level: 'A1', tags: ['t'],
    translationEn: '@SUM(1+1)', translationNp: '+1+1', exampleDe: '-1+1',
  },
];
const vOut = vocabCsv(injectedVocab as never);
check('a malicious word is defused', vOut.includes("'=cmd|"), vOut);
check('a malicious translation_en is defused', vOut.includes("'@SUM"), vOut);
check('a malicious translation_np is defused', vOut.includes("'+1+1"), vOut);
check('a malicious example is defused', vOut.includes("'-1+1"), vOut);
const vLines = vOut.split('\n').slice(1);
check('no vocabulary data line starts with a bare trigger', vLines.every((l) => !/^[=+\-@\t\r]/.test(l)), vOut);

console.log('\n=== 6. THE REVIEW-QUEUE EXPORT IS UNCHANGED IN BEHAVIOUR ===');
const qItem = {
  itemKey: '=1+1', moduleType: 'articles', username: 'u', userId: 'id',
  due: 'overdue' as const, overdueDays: 3, dueAt: null, boxLevel: 2,
  intervalDays: 1, errorCount: 1, errorTag: null, lastResult: null,
  userAnswer: '@x', correctAnswer: 'y',
};
const qOut = queueCsv([qItem as never]);
check('a malicious item_key is defused', qOut.includes("'=1+1"), qOut);
check('a malicious user_answer is defused', qOut.includes("'@x"), qOut);

console.log('\n=== 7. THE USERS EXPORT IS SAFE ===');
// `full_name` is learner-supplied, so this is the most likely injection point.
const uRow = {
  id: 'u1', username: '=1+1', fullName: '=cmd|\' /C calc\'!A0', plan: 'free',
  role: 'user', bannedAt: null, createdAt: null, totalXp: 0, level: 1,
  currentStreak: 0, longestStreak: 0, lastActivityDate: null, activeDays: null,
  lastActiveAt: null, unlockedUnitIndex: null, pathMode: null, queueSize: null,
  queueErrors: null,
};
const uOut = usersToCsv([uRow]);
check('a malicious username is defused', uOut.includes("'=1+1"), uOut);
check('a malicious full_name is defused', uOut.includes("'=cmd|"), uOut);
const uLines = uOut.split('\n').slice(1);
check('no users data line starts with a bare trigger', uLines.every((l) => !/^[=+\-@\t\r]/.test(l)), uOut);
check('the header is emitted', uOut.split('\n')[0].startsWith('id,username'), uOut.split('\n')[0]);
check('an empty user list is header-only', usersToCsv([]).split('\n').length === 1);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
