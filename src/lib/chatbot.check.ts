/**
 * src/lib/chatbot.check.ts — regression checks for the companion's PURE layer.
 *
 * Run with `npm run check:chatbot` (tsx; the browser tsconfig excludes every
 * `*.check.ts` under `src`, the same mechanism as `utils/answerNormalize.check.ts`).
 *
 * This file exists because everything here is a RULE SYSTEM, and rule systems
 * fail SILENTLY: a missing keyword does not throw, it quietly returns
 * `casual_chat` and the learner gets a greeting instead of an answer. Every
 * assertion below is a case that was wrong at some point during development.
 *
 * (Renamed from `intentRouter.check.ts` when follow-ups, markdown stripping and
 * the German level mapper were added — the check outgrew the one module.)
 */

import { classifyIntent } from './intentRouter';
import { followUpsFor } from './responseHandlers';
import { stripMarkdown } from '../components/chat/ChatMarkdown';
import { isAnswerCorrect } from './chatPractice';
import { parseCommand, isCommand } from './slashCommands';
import { preferenceDirectives } from './chatPreferences';
import { buildReport } from './weeklyReport';
import {
  advanceConversation,
  createConversation,
  levelForContext,
  resolveAnaphora,
} from './conversationManager';
import type { ContextSnapshot, Intent } from '../types/chatbot';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label} -> ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

/* ── intent routing ──────────────────────────────────────────────────────── */

const freshGuest = {
  isAuthenticated: false,
  isDE: false,
  review: { total: 0, due: 0, recent: [] },
  weakestSkill: null,
} as unknown as ContextSnapshot;

const routing: Array<[string, string, ContextSnapshot | undefined]> = [
  ['How am I doing?', 'progress_check', undefined],
  ["How's it going?", 'progress_check', undefined],
  ['Wie weit bin ich?', 'progress_check', undefined],
  ['Show me my XP', 'progress_check', undefined],
  ['What should I practise?', 'practice_suggestion', undefined],
  ['What should I practice?', 'practice_suggestion', undefined],
  ['Was sollte ich üben?', 'practice_suggestion', undefined],
  ['Where am I in the course?', 'curriculum_help', undefined],
  ['Which unit comes next?', 'curriculum_help', undefined],
  ['Why was I wrong?', 'explain_mistake', undefined],
  ['What is the rule for den?', 'grammar_question', undefined],
  ['How do I say thank you?', 'vocab_lookup', undefined],
  ['How do you say thank you?', 'vocab_lookup', undefined],
  ['What does "Hund" mean?', 'vocab_lookup', undefined],
  ["I'm frustrated", 'motivation', undefined],
  ['Which model should I use?', 'settings', undefined],
  ['Hallo!', 'conversation', undefined],
  ['asdfqwer', 'casual_chat', undefined],
  ['', 'casual_chat', undefined],
  // REGRESSION: a default-state context must not hijack unrelated questions.
  ['How am I doing?', 'progress_check', freshGuest],
  ['Where am I in the course?', 'curriculum_help', freshGuest],
  ['Hallo!', 'conversation', freshGuest],
  ['asdfqwer', 'casual_chat', freshGuest],
];

console.log('— intent routing —');
for (const [input, expected, context] of routing) {
  check(`route ${JSON.stringify(input)}${context ? ' [freshGuest]' : ''}`, classifyIntent(input, context), expected);
}

/* ── follow-ups ──────────────────────────────────────────────────────────── */

console.log('\n— follow-ups —');
const ALL_INTENTS: Intent[] = [
  'explain_mistake',
  'practice_suggestion',
  'vocab_lookup',
  'grammar_question',
  'progress_check',
  'curriculum_help',
  'motivation',
  'settings',
  'start_quiz',
  'page_help',
  'report',
  'conversation',
  'casual_chat',
];
for (const intent of ALL_INTENTS) {
  const en = followUpsFor(intent, false);
  const de = followUpsFor(intent, true);
  const ok = en.length > 0 && en.every((s) => s.trim().length > 0) && de.length > 0 && de.every((s) => s.trim().length > 0);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  followUps(${intent}) -> ${en.length} en / ${de.length} de`);
}
// Every follow-up must be its own string, or React renders duplicate-key errors.
check('followUps(casual_chat) unique', new Set(followUpsFor('casual_chat', false)).size, 2);

/* ── markdown stripping (what TTS actually reads) ───────────────────────── */

console.log('\n— markdown stripping —');
check('bold', stripMarkdown('Der Akkusativ braucht **den**.'), 'Der Akkusativ braucht den.');
check('italic', stripMarkdown('nicht *der*'), 'nicht der');
check('link text kept, url dropped', stripMarkdown('see [the glossary](/glossary)'), 'see the glossary');
check('list bullets dropped', stripMarkdown('- one\n- two'), 'one\ntwo');
// A fenced block's CONTENTS are dropped too: code is not prose worth speaking.
check('code fence and its contents dropped', stripMarkdown('```\nignored\n```\nkept'), 'kept');
check('heading dropped', stripMarkdown('## Rule\nbody'), 'Rule\nbody');

/* ── German level mapping ────────────────────────────────────────────────── */

console.log('\n— level mapping —');
check('A1 + early module', levelForContext('A1', 0), 'A1.1');
check('A1 + later module', levelForContext('A1', 5), 'A1.2');
check('unset + later module', levelForContext('', 5), 'A1.2');
check('A2 honoured', levelForContext('A2', 0), 'A2.1');
check('B1 honoured', levelForContext('B1', 0), 'A2.1');

/* ── anaphora ────────────────────────────────────────────────────────────── */

console.log('\n— anaphora —');
const bound = advanceConversation(createConversation(), 'Ich heiße Anna und sie ist Lehrerin');
check('sie bound to Anna', bound.keyEntities.sie, 'Anna');
check(
  'dangling sie resolved',
  resolveAnaphora(bound, 'Wo arbeitet sie?'),
  'Wo arbeitet Anna?',
);
check(
  'formal Sie is never rewritten',
  resolveAnaphora(bound, 'Sie ist nett.'),
  'Sie ist nett.',
);

/* ── new intents reach the router ────────────────────────────────────────── */
console.log('\n— new intents —');
check('route "quiz me"', classifyIntent('quiz me'), 'start_quiz');
check('route "Prüf mich"', classifyIntent('Prüf mich'), 'start_quiz');
check('route "explain this page"', classifyIntent('explain this page'), 'page_help');
// REGRESSION: page_help and explain_mistake both match this phrase. The page
// reading is the more specific one and must win the tie.
check('route "Erkläre mir diese Seite"', classifyIntent('Erkläre mir diese Seite'), 'page_help');
check('a plain mistake question is unaffected', classifyIntent('Why was I wrong?'), 'explain_mistake');
check('route "weekly report"', classifyIntent('weekly report'), 'report');
check('route "Wochenbericht"', classifyIntent('Wochenbericht'), 'report');

/* ── slash commands ──────────────────────────────────────────────────────── */
console.log('\n— slash commands —');
check('/why forces explain_mistake', parseCommand('/why').intent, 'explain_mistake');
check('/practice forces start_quiz', parseCommand('/practice').intent, 'start_quiz');
check('/vocab carries its argument', parseCommand('/vocab Hund').argument, 'Hund');
check('/page forces page_help', parseCommand('/page').intent, 'page_help');
// The important negative: a slash in the MIDDLE is not a command.
check('"3/4" is not a command', isCommand('3/4'), false);
check('"der/die/das" is not a command', isCommand('der/die/das'), false);
check('"/nonsense" is not a command', isCommand('/nonsense'), false);
check('"/STOP" is case-insensitive', parseCommand('/STOP').command, 'stop');

/* ── answer scoring ──────────────────────────────────────────────────────── */
console.log('\n— answer scoring —');
// TYPED answers may omit the article.
check('typed: exact match', isAnswerCorrect('der Hund', 'der Hund', 'type'), true);
check('typed: article omitted still correct', isAnswerCorrect('Hund', 'der Hund', 'type'), true);
check('typed: case and spacing tolerated', isAnswerCorrect('  DER   hund ', 'der Hund', 'type'), true);
check('typed: wrong answer rejected', isAnswerCorrect('die', 'der Hund', 'type'), false);
check('typed: substring is NOT correct', isAnswerCorrect('Hun', 'Hund', 'type'), false);
// REGRESSION: in a CHOOSE question the article IS the answer. Normalising it
// away marked every article question correct.
check('choice: exact match', isAnswerCorrect('der Hund', 'der Hund', 'choice'), true);
check('choice: wrong article is WRONG', isAnswerCorrect('der Hund', 'die Hund', 'choice'), false);
check('choice: das vs der rejected', isAnswerCorrect('der Geschäft', 'das Geschäft', 'choice'), false);
check('choice: omitted article rejected', isAnswerCorrect('Hund', 'der Hund', 'choice'), false);
// `listen` is a TYPE-IN flow (the card renders an input, not buttons), so it
// keeps the same article rule as `type` — an omitted article is forgiven, a
// wrong one is not.
check('listen: typed flow tolerates an omitted article', isAnswerCorrect('Hund', 'der Hund', 'listen'), true);
check('listen: wrong article is still wrong', isAnswerCorrect('die Hund', 'der Hund', 'listen'), false);
check('typed: WRONG article is not forgiven', isAnswerCorrect('die Hund', 'der Hund', 'type'), false);
check('typed: bare word with no article in the answer', isAnswerCorrect('hund', 'hund', 'type'), true);

/* ── preferences reach the prompt ────────────────────────────────────────── */
console.log('\n— preferences —');
check('no preferences = no directive', preferenceDirectives([]), '');
check('unknown preference ignored', preferenceDirectives(['bogus' as never]), '');
check('simple is injected', preferenceDirectives(['simple']).includes('SIMPLE'), true);
check(
  'two preferences both present',
  preferenceDirectives(['simple', 'examples']).split('\n').length,
  2,
);

/* ── report is built from the snapshot, never invented ───────────────────── */
console.log('\n— report —');
const bare = { isDE: false, xp: { level: 3, totalXp: 700, rank: 'X' }, streak: { current: 2, longest: 5 }, a1: { unitIndex: 0, unitTitle: 'Greetings', passedCheckpoints: 0, completedCount: 1, totalLearnNodes: 4, pushNode: null }, skills: [], review: { total: 0, due: 0, recent: [] } } as unknown as ContextSnapshot;
const rows = buildReport(bare);
check('report has a level row', rows.some((r) => r.title === 'Level' && r.value.includes('700')), true);
check('report quotes the real level', rows.some((r) => r.value.includes('level 3') || r.value.includes('3')), true);
check('empty queue omits the queue row', rows.some((r) => r.title === 'Review queue'), false);

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`}`);
if (failures > 0) process.exit(1);
