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
  acquireAssessment,
  isAssessmentActive,
  releaseAssessment,
  subscribeAssessmentActive,
} from './assessmentSignal';
import { useChatStore } from './chatStore';
import { sanitizeHtml, isSafeHref } from './sanitizeHtml';
import { marked } from 'marked';
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

/* ── the graded-run guard is a DEPTH COUNTER ───────────────────────────────── */

// This is the regression that motivated reference counting at all. The panel
// used to be held shut by ONE boolean, and two owners exist: `useExerciseSession`
// claims for every deck-driven page, and `A1CheckpointPage` claims for its own
// `phase === 'playing'` window. Under a boolean, the FIRST release cleared the
// flag and re-opened the panel over a live run — the exact blocker the whole
// module was written to prevent, reintroduced by the fix's own shape.
console.log('\n— assessment guard (depth counting) —');
{
  const seen: boolean[] = [];
  const off = subscribeAssessmentActive((v) => seen.push(v));
  check('idle to start', isAssessmentActive(), false);

  acquireAssessment();
  check('one claim = active', isAssessmentActive(), true);
  acquireAssessment();
  check('two claims still active', isAssessmentActive(), true);

  releaseAssessment();
  // THE regression: releasing one of two owners must NOT clear the flag.
  check('one of two claims still active', isAssessmentActive(), true);
  releaseAssessment();
  check('last release clears', isAssessmentActive(), false);
  check('emitted only on the two real edges', seen, [true, false]);

  // A leaked/duplicated release must not drive the count negative, or the next
  // single claim would emit `true` while the flag already read `true`.
  releaseAssessment();
  check('a stray release cannot go negative', isAssessmentActive(), false);
  acquireAssessment();
  check('a claim after a stray release still works', isAssessmentActive(), true);
  releaseAssessment();
  off();
}

/* ── proactive nudges QUEUE instead of overwriting ─────────────────────────── */

// Also a real regression: `pendingPrompt` was a single slot written
// unconditionally, and streak-at-risk + level-up both fire off the same state —
// so the first nudge was silently destroyed whenever the second arrived in the
// same tick.
console.log('\n— proactive nudge queue —');
{
  const store = useChatStore.getState();
  useChatStore.setState({ pendingPrompts: [], open: false, deferredReveal: false });

  store.enqueuePrompt('first nudge');
  store.enqueuePrompt('second nudge');
  check('both nudges survive one tick', useChatStore.getState().pendingPrompts, [
    'first nudge',
    'second nudge',
  ]);

  // A second effect observing the same event re-queues identical text; sending
  // it twice reads as a stutter.
  store.enqueuePrompt('first nudge');
  check('an identical nudge collapses', useChatStore.getState().pendingPrompts, [
    'first nudge',
    'second nudge',
  ]);

  check('drains oldest first', store.takePendingPrompt(), 'first nudge');
  check('the next is still queued', useChatStore.getState().pendingPrompts, ['second nudge']);
  check('drains the second', store.takePendingPrompt(), 'second nudge');
  check('an empty queue drains to null', store.takePendingPrompt(), null);
  useChatStore.setState({ pendingPrompts: [] });
}

// The reveal is withheld mid-run — the panel must not sit on the Next button —
// and the text is still queued, because a dropped nudge is unrecoverable.
console.log('\n— reveal is deferred during a graded run —');
{
  const store = useChatStore.getState();
  acquireAssessment();
  store.enqueuePrompt('you missed the gate');
  check('panel stays shut mid-run', useChatStore.getState().open, false);
  check('the nudge is still queued', useChatStore.getState().pendingPrompts, ['you missed the gate']);
  check('the reveal is marked deferred', useChatStore.getState().deferredReveal, true);

  releaseAssessment();
  check('the withheld reveal flushes when the run ends', useChatStore.getState().open, true);
  check('and clears its own flag', useChatStore.getState().deferredReveal, false);
  useChatStore.setState({ pendingPrompts: [], open: false });
}

console.log('\n— markdown HTML sanitiser —');
{
  // Each case is a way a reply could execute. A sanitiser is only as good as
  // the inputs nobody thought of, so these are adversarial rather than happy
  // path. The assertion is the EXACT output, not merely "nothing scary" — a
  // sanitiser that also ate the sentence would pass the weaker check.
  const xss: Array<[string, string, string]> = [
    ['<script>alert(1)</script>', 'script dropped with its body', ''],
    ['<SCRIPT SRC=//evil>x</SCRIPT>', 'uppercase script dropped', ''],
    ['<img src=x onerror=alert(1)>', 'img is not in the allowlist', ''],
    ['<a href="javascript:alert(1)">x</a>', 'javascript: href dropped', '<a>x</a>'],
    ['<a href="&#106;avascript:alert(1)">x</a>', 'entity-encoded javascript: dropped', '<a>x</a>'],
    ['<a href="java&colon;script:alert(1)">x</a>', 'named-entity javascript: dropped', '<a>x</a>'],
    ['<a href="java\tscript:alert(1)">x</a>', 'tab-split javascript: dropped', '<a>x</a>'],
    ['<a href="data:text/html,x">x</a>', 'data: href dropped', '<a>x</a>'],
    ['<a href="  JaVaScRiPt:alert(1)">x</a>', 'mixed case + leading space dropped', '<a>x</a>'],
    ['<a href="//evil.example">x</a>', 'protocol-relative dropped', '<a>x</a>'],
    ['<a onclick="alert(1)" href="/glossary">x</a>', 'event handler dropped, href kept', '<a href="/glossary">x</a>'],
    ['<iframe src="//evil"></iframe>', 'iframe dropped', ''],
    ['<style>body{display:none}</style>', 'style dropped with its body', ''],
    ['<svg onload=alert(1)>', 'svg dropped', ''],
    ['<div onmouseover=alert(1)>hi</div>', 'disallowed tag dropped, text kept', 'hi'],
    ['<p title=\'x" onerror="alert(1)\'>hi</p>', 'quote-breakout cannot add an attribute', '<p>hi</p>'],
    ['<!--<script>alert(1)</script>-->', 'comment removed before parsing', ''],
    ['<script>alert(1)', 'unterminated script at end of string', ''],
    ['<p>ok</p><script>alert(1)</script><p>ok</p>', 'a payload between two good tags', '<p>ok</p><p>ok</p>'],
  ];
  for (const [input, label, expected] of xss) {
    check(label, sanitizeHtml(input), expected);
  }
  // The allowlist is only useful if it does not silently eat the reply.
  check('plain markdown survives', sanitizeHtml('<p>Der <strong>Akkusativ</strong> braucht <em>den</em>.</p>'),
    '<p>Der <strong>Akkusativ</strong> braucht <em>den</em>.</p>');
  check('a safe relative link survives', sanitizeHtml('<a href="/glossary">Glossary</a>'),
    '<a href="/glossary">Glossary</a>');
  check('https survives', sanitizeHtml('<a href="https://dwds.de">DWDS</a>'),
    '<a href="https://dwds.de">DWDS</a>');
  check('mailto survives', sanitizeHtml('<a href="mailto:a@b.de">mail</a>'),
    '<a href="mailto:a@b.de">mail</a>');
  check('a fragment survives', sanitizeHtml('<a href="#top">top</a>'), '<a href="#top">top</a>');
  check('lists survive', sanitizeHtml('<ul><li>one</li><li>two</li></ul>'), '<ul><li>one</li><li>two</li></ul>');
  check('an empty string is empty', sanitizeHtml(''), '');
  // `marked` output for this markdown, end-to-end through the real pipeline.
  // Trimmed because `marked` terminates a block with a newline.
  check('real marked output is unchanged by the sanitiser',
    sanitizeHtml(marked.parse('**bold** and `code`', { async: false }) as string).trim(),
    '<p><strong>bold</strong> and <code>code</code></p>');

  // The scheme check is the crux of the link rule, so it is pinned directly.
  check('isSafeHref rejects javascript:', isSafeHref('javascript:alert(1)'), false);
  check('isSafeHref rejects an empty value', isSafeHref(''), false);
  check('isSafeHref accepts a relative path', isSafeHref('/glossary'), true);
  check('isSafeHref accepts a fragment', isSafeHref('#top'), true);
  check('isSafeHref accepts mailto', isSafeHref('mailto:a@b.de'), true);
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`}`);
if (failures > 0) process.exit(1);
