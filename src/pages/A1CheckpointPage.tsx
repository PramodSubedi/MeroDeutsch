/**
 * src/pages/A1CheckpointPage.tsx
 *
 * A1 unit checkpoint quiz (10-15 items), driven by the shared Lesson Engine
 * (`useExerciseSession` + `<MultipleChoice>`). Locked rules (C/D):
 *  - 10-15 items drawn from the unit's real curriculumService loaders.
 *  - pickNUnique -> no repeats until the pool cycles (without replacement).
 *  - Options shuffled AT creation AND re-shuffled once at session mount;
 *    stable after the question locks (engine guarantee).
 *  - >=80% passes (advances unlockedUnitIndex, persists best score).
 *  - <80%: score shown, Retry (anytime, no cooldown), Back to map.
 *  - Misses queued via the REAL addWrongAnswer (moduleType 'a1-checkpoint')
 *    — routed through the engine's single integration point.
 *  - Correct answers award XP via reportAnswer (existing XpContext -> toast).
 *  - TTS safety (C6): "Hear" speaks ONLY the prompt before the question locks;
 *    the answer is spoken only AFTER the answer is locked (MultipleChoice).
 *  - Level-ups render as non-blocking toasts (Layout treats /checkpoint as a
 *    quiz route).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock as LockIcon } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useA1Path } from '../hooks/useA1Path';
import { curriculumService } from '../services';
import { CHECKPOINT_PASS_THRESHOLD, A1_UNITS, type CheckpointSource, type Article } from '../data/a1Path';
import { TemplateResolver } from '../lib/templateResolver';
import { TEMPLATE_COUNTRIES } from '../data/templateCountries';
import { pickNUnique } from '../utils/questionGenerator';
import { shuffleArray } from '../utils/shuffleArray';
import { useExerciseSession, type ExerciseQuestion } from '../hooks/useExerciseSession';
import { playAudioUrl } from '../hooks/useSpeech';
import { MultipleChoice } from '../components/exercises/MultipleChoice';
import { useAssessmentActive } from '../hooks/useAssessmentActive';
import { triggerHaptic } from '../utils/haptic';
import { buildOptions, isUsableQuestion, toVocabEntry } from '../lib/checkpointDeck';
import { theme } from '../config/theme';
import { GenderBadge } from '../components/ui/GenderBadge';
import { hasSpecificHint } from '../data/hints';
import { A1_PATH_ROUTE } from '../data/cefrLevels';
import type { AlphabetItem, ArticleItem, CalendarItem, GreetingItem, NumberItem, VocabCard, VocabEntry } from '../types';
import type { GrammarDrill } from '../types/curriculum';

/** Shared empty array so `missedItemKeys` keeps a stable identity when there is
    no history — otherwise the deck-build effect would re-run on every render. */
const EMPTY_KEYS: readonly string[] = [];

/**
 * Fallback grammar pools for a module that declares no `grammarCategories`.
 * Kept as the original four so a misconfigured module still builds a real deck
 * instead of an empty one.
 */
const DEFAULT_GRAMMAR_CATEGORIES = ['sein', 'haben', 'weakVerb', 'cases'];

/**
 * Spec §3 audio pacing: Modules 1–5 play at 0.8x (slower, for beginners
 * building sound recognition), Modules 6–15 at 1.0x (native speed, because
 * those modules are about production and speed, not decoding).
 *
 * `unitIndex` is 0-based, so modules 1–5 are indices 0–4.
 */
const SLOW_AUDIO_MAX_MODULE_INDEX = 4;

function playbackRateForModule(unitIndex: number): number {
  return unitIndex <= SLOW_AUDIO_MAX_MODULE_INDEX ? 0.8 : 1.0;
}

/** Engine-compatible checkpoint question. */
interface CheckpointQuestion extends ExerciseQuestion {
  prompt: string;
  source: CheckpointSource;
  article?: Article; // only for article-precision rendering
  audioUrl?: string; // only for listening-gap questions
  /**
   * More specific than `source` for the hint lookup, when we know it.
   *
   * `MultipleChoice` is given `hintReason` and looks up
   * `a1-checkpoint:<hintReason>` in src/data/hints.ts. For grammar drills the
   * useful granularity is the DRILL CATEGORY (perfekt / modals / prefix / stem),
   * not the generic 'grammar-drill' source — so a learner who misses a Perfekt
   * auxiliary is told about sein vs. haben instead of being handed a word-order
   * hint that does not apply. Falls back to `source` when absent.
   */
  hintReason?: string;
}

interface LoadedData {
  greetings: GreetingItem[];
  numbers: NumberItem[];
  alphabet: AlphabetItem[];
  articles: ArticleItem[];
  calendar: CalendarItem[];
  vocabulary: VocabEntry[];
  grammar: Record<string, GrammarDrill[]>;
}

/**
 * Build the option set for one question: the correct answer plus `count - 1`
 * distractors drawn at RANDOM from the pool.
 *
 * The decoys MUST be shuffled BEFORE they are sliced.
 *
 * This used to be `uniqueDecoys.slice(0, count - 1)` — a POSITIONAL take. The
 * pool returned by `curriculumService` is deterministically ordered (Dexie
 * primary-key order for vocab; `sort` order for content pools), so every single
 * question in a deck was handed the SAME first three distractors. Only their
 * display position changed, because `useExerciseSession` shuffles options once
 * at mount. The result read as "the same question over and over" even though the
 * prompts were different.
 *
 * Concrete example this fixes — the 8-item greeting pool, old behaviour:
 *   'Hallo'           -> Hallo | Guten Morgen | Guten Tag | Guten Abend
 *   'Auf Wiedersehen' -> Auf Wiedersehen | Hallo | Guten Morgen | Guten Tag
 *   'Entschuldigung'  -> Entschuldigung | Hallo | Guten Morgen | Guten Tag
 *
 * Matches the convention already used in `templateResolver.ts` and
 * `ClockDrill.tsx` (`shuffleArray(distractors).slice(0, n)`).
 */

// `buildOptions`, `toVocabEntry` and `isUsableQuestion` now live in
// `lib/checkpointDeck` so they can be unit-tested without mounting this page.
// That is not tidiness: the bug that emptied 14 of 16 checkpoints lived in this
// file, and it shipped precisely because nothing here was under test.

// The origin-statement country pool is shared with SentenceBuilderPage — see
// src/data/templateCountries.ts. This copy was previously 4 countries while
// that one had 5, so the Gate A fallback silently offered a smaller distractor
// pool than the sentence builder.

function buildQuestions(
  specs: { type: CheckpointSource; count: number }[],
  data: LoadedData,
  unitIndex: number,
  priorityKeys?: readonly string[]
): CheckpointQuestion[] {
  const out: CheckpointQuestion[] = [];
  const priority = new Set(priorityKeys ?? []);

  /**
   * Priority-aware without-replacement draw.
   *
   * Every candidate whose question key is in `priorityKeys` (the items missed on
   * the previous FAILED attempt) is taken FIRST, then the remaining slots are
   * filled by the ordinary random draw.
   *
   * This is the whole point of the Retry button. The deck used to be a fresh
   * uniform random draw, so the 4 questions a learner had just failed were
   * usually NOT in the next 12 — the retry measured luck, not learning. A key
   * that is no longer available (pool changed, item filtered out) is skipped,
   * degrading gracefully to the old behaviour.
   *
   * `getKey` MUST return the exact `key` assigned to the question below, or
   * the priority set will never match.
   */
  const pick = <T,>(items: T[], count: number, getKey: (x: T) => string): T[] => {
    if (priority.size === 0) {
      return pickNUnique({ items, count: Math.min(count, items.length), getKey });
    }
    const seen = new Set<string>();
    const forced: T[] = [];
    const rest: T[] = [];
    for (const item of items) {
      const k = getKey(item);
      if (seen.has(k)) continue;
      seen.add(k);
      if (priority.has(k)) forced.push(item);
      else rest.push(item);
    }
    const take = Math.max(0, count - forced.length);
    return [...forced, ...pickNUnique({ items: rest, count: Math.min(take, rest.length), getKey })];
  };

  for (const spec of specs) {
    switch (spec.type) {
      case 'greeting-translation':
        pick(data.greetings, spec.count, (g) => `greeting:${g.de}`).forEach((g) =>
          out.push({
            key: `greeting:${g.de}`,
            prompt: g.en,
            speakPrompt: g.en,
            speakAfter: g.de,
            options: buildOptions(g.de, data.greetings.map((x) => x.de), 4),
            correctAnswer: g.de,
            source: 'greeting-translation',
          })
        );
        break;
      case 'number-conversion':
        // Resolver-based fallback for origin statements when the dynamic pool is sparse.
        if (data.numbers.length < 2) {
          TemplateResolver.generateOriginExercises(TEMPLATE_COUNTRIES, ['ich', 'du'], spec.count).forEach((exercise) => {
            out.push({
              key: `template-origin:${exercise.id}`,
              prompt: exercise.sentenceEn,
              speakPrompt: exercise.sentenceEn,
              speakAfter: exercise.sentenceDe,
              options: buildOptions(exercise.sentenceDe, [
                ...exercise.distractors,
                ...TEMPLATE_COUNTRIES.map((country) => `${country.caseGovernance?.prep_aus ?? 'aus'} ${country.lemma}`),
              ], 4),
              correctAnswer: exercise.sentenceDe,
              source: 'number-conversion',
            });
          });
          break;
        }
        // Gate A (first contact) focuses on numbers 0–12; the full range is
        // offered later as optional practice (Band D bonus), not on the gate.
        pick(
          data.numbers.filter((n) => Number(n.n) <= 12),
          spec.count,
          (n) => `number:${n.de}`
        ).forEach((n) =>
          out.push({
            key: `number:${n.de}`,
            prompt: String(n.n),
            speakPrompt: String(n.n),
            speakAfter: n.de,
            options: buildOptions(n.de, data.numbers.map((x) => x.de), 4),
            correctAnswer: n.de,
            source: 'number-conversion',
          })
        );
        break;
      case 'alphabet-letter':
        pick(data.alphabet, spec.count, (a) => `letter:${a.id}`).forEach((a) =>
          out.push({
            key: `letter:${a.id}`,
            prompt: a.letter,
            speakPrompt: a.speak, // letter name is the PROMPT, not the answer word
            speakAfter: a.speakWord,
            options: buildOptions(a.speakWord, data.alphabet.map((x) => x.speakWord), 4),
            correctAnswer: a.speakWord,
            source: 'alphabet-letter',
          })
        );
        break;
      case 'article-precision':
        pick(data.articles, spec.count, (a) => `article:${a.noun}`).forEach((a) =>
          out.push({
            key: `article:${a.noun}`,
            prompt: a.noun, // noun WITHOUT article -> TTS safe before lock (C6)
            speakPrompt: a.noun,
            speakAfter: `${a.art} ${a.noun}`,
            options: ['der', 'die', 'das'],
            correctAnswer: a.art,
            source: 'article-precision',
            article: a.art,
          })
        );
        break;
      case 'grammar-drill': {
        // Keep each drill's CATEGORY. `data.grammar` is a Record keyed by
        // category, but `Object.values(...).flat()` drops that key — so a flat
        // array cannot tell a Perfekt drill from a modal one. Pairing them back
        // up lets the question carry an accurate `hintReason`, which is what
        // picks the specific hint in src/data/hints.ts.
        const drills = Object.entries(data.grammar).flatMap(([category, list]) =>
          list.map((g) => ({ drill: g, category }))
        );
        // STABLE key (prompt-based, index-free). It used to embed the draw index
        // `i`, which changes every round — so the same drill got a different
        // `key` (and therefore a different SRS dedupe id) on each attempt,
        // letting the review queue accumulate duplicates of one question. The
        // index is still used for nothing else here.
        pick(drills, spec.count, (g) => `grammar:${unitIndex}:${g.drill.prompt}`).forEach((g) =>
          out.push({
            key: `grammar:${unitIndex}:${g.drill.prompt}`,
            prompt: g.drill.prompt,
            speakPrompt: g.drill.prompt,
            speakAfter: g.drill.correct,
            options: [...g.drill.options],
            correctAnswer: g.drill.correct,
            source: 'grammar-drill',
            hintReason: g.category,
          })
        );
        break;
      }
      case 'word-order': {
        // The `wordOrder` pool, read through the same grammar-drill loader —
        // same content_type, so no new service method and no new fetch path.
        // Every option is a full sentence, so the learner judges the whole
        // arrangement instead of spotting a missing word. TTS safety (C6): the
        // prompt is the English instruction and the German sentences are NOT
        // spoken until after the answer is locked, because two of the three
        // options are grammatical-looking decoys.
        const drills = data.grammar.wordOrder ?? [];
        pick(drills, spec.count, (g) => `wordorder:${g.prompt}:${g.correct}`).forEach((g) =>
          out.push({
            key: `wordorder:${unitIndex}:${g.prompt}:${g.correct}`,
            prompt: g.prompt,
            speakPrompt: g.prompt,
            speakAfter: g.correct,
            options: [...g.options],
            correctAnswer: g.correct,
            source: 'word-order',
            hintReason: 'wordOrder',
          })
        );
        break;
      }
      case 'calendar-translation':
        pick(data.calendar, spec.count, (c) => `calendar:${c.de}`).forEach((c) =>
          out.push({
            key: `calendar:${c.de}`,
            prompt: c.en,
            speakPrompt: c.en,
            speakAfter: c.de,
            options: buildOptions(c.de, data.calendar.map((x) => x.de), 4),
            correctAnswer: c.de,
            source: 'calendar-translation',
          })
        );
        break;
      case 'vocab-translation':
        pick(data.vocabulary, spec.count, (v) => `vocab:${v.id}`).forEach((v) =>
          out.push({
            key: `vocab:${v.id}`,
            prompt: v.en,
            speakPrompt: v.en,
            speakAfter: v.de,
            options: buildOptions(v.de, data.vocabulary.map((x) => x.de), 4),
            correctAnswer: v.de,
            source: 'vocab-translation',
          })
        );
        break;
      case 'vocab-translation-ne':
        pick(data.vocabulary, spec.count, (v) => `vocab-ne:${v.id}`).forEach((v) =>
          out.push({
            key: `vocab-ne:${v.id}`,
            prompt: v.ne || v.en,
            // TTS safety (C2.6): NO pre-lock prompt audio. This case previously
            // set `speakPrompt: v.de`, which is also `correctAnswer` — the
            // answer was read aloud before the learner could choose. Its
            // sibling `vocab-translation` speaks the ENGLISH prompt, but
            // `speakText` always synthesizes with a `de-DE` voice, so reading
            // the Nepali/English prompt back would be gibberish. Omitting the
            // field is the honest fix: MultipleChoice renders no pre-lock
            // speaker when it is absent, and the answer is still spoken after
            // lock via `speakAfter`.
            speakAfter: v.de,
            options: buildOptions(v.de, data.vocabulary.map((x) => x.de), 4),
            correctAnswer: v.de,
            source: 'vocab-translation-ne',
          })
        );
        break;
      case 'listening-gap':
        pick(data.vocabulary.filter((v) => Boolean(v.audioUrl)), spec.count, (v) => `listen:${v.id}`).forEach((v) => {
          out.push({
            key: `listen:${v.id}`,
            prompt: 'Höre und wähle das richtige Wort',
            speakPrompt: v.de,
            speakAfter: v.de,
            options: buildOptions(v.de, data.vocabulary.map((x) => x.de), 4),
            correctAnswer: v.de,
            source: 'listening-gap',
            audioUrl: v.audioUrl,
          });
        });
        break;
      default:
        break;
    }
  }
  // Shuffle FIRST so sources interleave (without this the deck would run
  // greetings → numbers → articles in blocks), then stable-sort the missed
  // items to the front. `sort` is stable, so the shuffle inside each rank group
  // survives — a retry stays varied, it just opens with what you got wrong.
  const rank = (q: CheckpointQuestion) => (priority.has(q.key) ? 0 : 1);
  return shuffleArray(
    out.filter((q) =>
      isUsableQuestion(q, (bad) =>
        console.warn(
          `[a1-checkpoint] dropped unplayable question "${bad.key}" (source=${bad.source}) ` +
            `— prompt=${JSON.stringify(bad.prompt)} answer=${JSON.stringify(bad.correctAnswer)} ` +
            `options=${Array.isArray(bad.options) ? bad.options.length : 0}`,
        ),
      ),
    ),
  ).sort((a, b) => rank(a) - rank(b));
}

/**
 * Sign-in gate for guests who deep-link a checkpoint.
 *
 * Extracted from `A1CheckpointPage` deliberately: when this markup lived
 * inline, it sat behind an early `return` that executed BEFORE the page's
 * hooks. Because `useAuth` starts `isAuthenticated === false` and flips true
 * after the async `supabase.auth.getSession()`, any hard load / refresh /
 * bookmark of `/checkpoint/0` while signed in re-rendered with a different
 * hook count and React threw ("Rendered more hooks than during the previous
 * render") — a hard crash on the page that gates the whole A1 campaign.
 *
 * As its own component it owns zero hooks, so the parent can call all of
 * its hooks unconditionally.
 */
function CheckpointSignInGate({ isDE }: { isDE: boolean }) {
  return (
    <div className={theme.page.container}>
      <div className={theme.panel.surface}>
        {/* Aliased to LockIcon: a bare `<Lock>` resolves to the DOM's window.Lock. */}
        <LockIcon className="h-8 w-8 text-ink-500" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold text-ink-900 dark:text-ink-50">
          {isDE ? 'Checkpoints' : 'Checkpoints'}
        </h1>
        <p className="mt-2 text-body text-ink-600 dark:text-ink-300">
          {isDE
            ? 'Checkpoints gehören zum geführten Lernpfad. Bitte melden Sie sich an, um fortzufahren.'
            : 'Checkpoints are part of the guided learning path. Please sign in to continue.'}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link to="/auth" className={theme.button.primary}>
            {isDE ? 'Anmelden / Registrieren' : 'Sign in / Register'}
          </Link>
          <Link to="/home" className={theme.button.secondary}>
            {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * A module with no checkpoint (a future optional/support module). A hard deep
 * link still loads (soft lock) — show a friendly "optional" screen, not an
 * error. Every module in the current 15-module curriculum DOES carry a
 * checkpoint, so this only renders for a misconfigured/out-of-range index.
 */
function CheckpointNoGate({ isDE, code }: { isDE: boolean; code: string }) {
  return (
    <div className={theme.page.container}>
      <div className={theme.panel.surface}>
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">
          {isDE ? `Modul ${code}` : `Module ${code}`}
        </h1>
        <p className="mt-2 text-body text-ink-600 dark:text-ink-300">
          {isDE
            ? 'Dieses Modul hat keine Pflichtprüfung – es ist optionale Unterstützung.'
            : 'This module has no checkpoint — it is optional support content, no gate required.'}
        </p>
        <Link to={A1_PATH_ROUTE} className={`${theme.button.primary} mt-5`}>
          {isDE ? 'Zurück zum Lernpfad' : 'Back to learning path'}
        </Link>
      </div>
    </div>
  );
}

export function A1CheckpointPage() {
  const { unitIndex: rawIndex } = useParams<{ unitIndex: string }>();
  const unitIndex = useMemo(() => {
    const parsed = parseInt(rawIndex ?? '0', 10);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    return Math.max(0, Math.min(safe, A1_UNITS.length - 1));
  }, [rawIndex]);

  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { markCheckpointResult, isUnitUnlocked, isCheckpointComplete, attemptsByUnit } = useA1Path();

  const unit = A1_UNITS[unitIndex];
  const { isAuthenticated } = useAuth();

  // Unit-derived (never a hardcoded 0) so every checkpoint shows its own name.
  usePageTitle(unit ? `Checkpoint ${unitIndex + 1} · ${unit.title.en}` : 'Checkpoint');

  // ───────────────────────────────────────────────────────────────────────
  // ALL HOOKS FIRST, UNCONDITIONALLY.
  //
  // This block used to sit BELOW two early `return`s (guest gate + no-gate
  // band). `useAuth` starts `isAuthenticated === false` and flips to true
  // after the async `supabase.auth.getSession()`, so a hard load / refresh /
  // bookmark of `/checkpoint/0` while signed in re-rendered this component
  // with a DIFFERENT hook count and React threw "Rendered more hooks than
  // during the previous render" — a hard crash on the page that gates the
  // whole A1 campaign. Hook order must never depend on auth/band state.
  // The gate UIs live in `CheckpointSignInGate` / `CheckpointNoGate` above.
  // ───────────────────────────────────────────────────────────────────────
  const unlocked = isUnitUnlocked(unitIndex);
  const alreadyPassed = isCheckpointComplete(unitIndex);

  const [phase, setPhase] = useState<'loading' | 'ready' | 'playing'>('loading');
  const [questions, setQuestions] = useState<CheckpointQuestion[]>([]);
  /** Increments on retry so the deck-build effect re-runs with a fresh draw. */
  const [runId, setRunId] = useState(0);

  /**
   * Tell the companion a graded run is in flight, for as long as it is.
   *
   * The Mero panel is `fixed inset-y-0 right-0 sm:w-[360px]`. When the
   * "I didn't pass the checkpoint" nudge fired — which it does the instant a
   * run is recorded, i.e. while the learner is still holding Next — the panel
   * opened over the Next button and swallowed the click. At 1440px the panel
   * covered it outright, so a learner could not advance, retry, or leave.
   *
   * Mirrors `useExerciseSession`'s existing `setDailySessionActive` pattern, and
   * is driven from state (not from the recording effect) so the flag also
   * covers the ordinary case of a learner sitting on the last question, and so
   * it clears on unmount if they navigate away mid-run.
   *
   * This page ALSO gets a claim from `useExerciseSession` below, which drives
   * the questions. Two overlapping claims is exactly why `assessmentSignal`
   * counts them rather than holding a boolean: the panel stays shut until the
   * last holder releases, and a premature release here can no longer cut the
   * session's claim short.
   */
  useAssessmentActive(phase === 'playing');

  /**
   * Question keys missed on the previous FAILED attempt.
   *
   * Read at the moment the deck is BUILT (not stored in component state) so a
   * retry always picks up the newest list, including one written by another tab
   * via the Dexie/BroadcastChannel path. The deck builder takes these first,
   * which is what turns "Retry" from a coin flip into a re-test of the exact
   * items that were wrong. Cleared by useA1Path once the gate is passed.
   */
  const missedItemKeys = attemptsByUnit[unitIndex]?.missedItemKeys ?? EMPTY_KEYS;
  const attemptRecord = attemptsByUnit[unitIndex];

  // ---- Lesson Engine session (owns lock/score/reporting) ----
  const session = useExerciseSession<CheckpointQuestion>({
    questions,
    module: 'a1-checkpoint',
    getOptions: (q) => q.options,
  });
  const { index, answered, score, results } = session;

  // Guard so markCheckpointResult fires exactly once per run.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (
      phase === 'playing' &&
      questions.length > 0 &&
      answered >= questions.length &&
      !recordedRef.current
    ) {
      recordedRef.current = true;
      // Report the keys we actually got wrong so the next attempt can re-test
      // them. `results` maps question key -> boolean (the engine's own record),
      // so this cannot drift from what the learner was shown.
      const missed = questions.filter((q) => results[q.key] === false).map((q) => q.key);
      // The gate verdict, as a single tactile event. This is the highest-value
      // haptic in the app: a pass unlocks a unit, a fail sends work to the
      // review queue, and either way the learner should feel the outcome
      // arrive rather than read it. It rides the existing once-per-run guard
      // above, so it can neither double-fire under StrictMode nor fire again
      // on a re-render of the result screen.
      //
      // The threshold test is the SCREEN's expression, verbatim, and that is
      // load-bearing rather than incidental. An exact `ratio >= 0.8` is not
      // equivalent to the displayed `Math.round(ratio * 100) >= 80`: the rounding
      // can promote a 79.5% run to a pass. They disagree for deck sizes of 44,
      // 49, 54 and 59 items — far above the 10-15 decks the curriculum builds
      // today, but reachable if the item count is ever raised. Recomputing the
      // verdict here would let the buzz say "fail" while the screen says
      // "passed", which is worse than having no haptic at all.
      const ratio = questions.length > 0 ? score / questions.length : 0;
      triggerHaptic(
        Math.round(ratio * 100) >= Math.round(CHECKPOINT_PASS_THRESHOLD * 100)
          ? 'success'
          : 'error'
      );
      markCheckpointResult(
        unitIndex,
        ratio,
        missed
      );
    }
  }, [phase, answered, questions, score, results, unitIndex, markCheckpointResult]);

  useEffect(() => {
    if (!isAuthenticated || !unit?.checkpoint) {
      setPhase('ready');
      return;
    }
    if (!unlocked) {
      setPhase('ready');
      return;
    }
    let cancelled = false;
    const build = async () => {
      const specs = unit.checkpoint!.specs;
      const needed = new Set(specs.map((s) => s.type));
      // Per-MODULE grammar categories, from the curriculum config.
      //
      // This was a hardcoded `['sein','haben','weakVerb','cases']` for every
      // module, which silently ignored the `stem`, `modals` and `prefix` pools
      // that already existed in content_items — so Module 8 (V2), Module 9
      // (separable verbs) and Module 13 (modals) could not be assessed on the
      // very grammar they teach.
      //
      // The module's OWN categories are always unioned with the four baseline
      // ones, never swapped for them. That matters because the cloud
      // `content_items` table only ever received the baseline four: `stem`,
      // `modals` and `prefix` exist in the bundled offline snapshot but have
      // never been seeded to the cloud. Unioning means an online learner with a
      // partial cloud pool still gets a full 12-item deck (topped up from the
      // baseline) instead of a short one, while still getting the module-specific
      // drills once the cloud is backfilled. Categories are deduped; the reduce
      // below is keyed by category, so a repeated key simply overwrites itself.
      const grammarCategories = Array.from(
        new Set([...(unit.grammarCategories ?? []), ...DEFAULT_GRAMMAR_CATEGORIES]),
      );
      const vocabularyNeeded = needed.has('vocab-translation') || needed.has('vocab-translation-ne') || needed.has('listening-gap');
      // Two DIFFERENT shapes arrive here, and conflating them is what used to
      // break every deck:
      //
      //   getVocabularyByCategories → VocabEntry[]  (already {id,de,en,ne})
      //   getVocabularyFiltered     → VocabCard[]   ({lemma, translation{en,np}})
      //
      // The old code cast BOTH to `any` and read `c.lemma` / `c.translation`,
      // which are `undefined` on a VocabEntry. Every question built from that
      // pool had `prompt: ''`, `correctAnswer: undefined` and exactly one empty
      // option — an unanswerable question with no error shown. The `as any`
      // also silenced the type checker that would have caught it.
      //
      // `toVocabEntry` normalises either shape, drops any row that still lacks
      // German or English text, and stamps `level` back on (the deck's
      // `VocabEntry` contract wants it; the normaliser is deliberately not
      // opinionated about levels). A bad row can never reach the builder.
      const rawVocabulary: Array<VocabEntry | VocabCard> = vocabularyNeeded
        ? unit.vocabCategories?.length || unit.vocabPos
          ? await curriculumService.getVocabularyByCategories(
              unit.vocabCategories ?? [],
              unit.vocabPos,
              60
            )
          : await curriculumService.getVocabularyFiltered({ level: 'A1', limit: 120 })
        : [];
      const vocabulary: VocabEntry[] = rawVocabulary
        .map(toVocabEntry)
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .map((v) => ({ ...v, level: 'A1' as const }));
      const data: LoadedData = {
        greetings: needed.has('greeting-translation') ? await curriculumService.getGreetings() : [],
        numbers: needed.has('number-conversion') ? await curriculumService.getNumbers() : [],
        alphabet: needed.has('alphabet-letter') ? await curriculumService.getAlphabet() : [],
        articles: needed.has('article-precision') ? await curriculumService.getArticles() : [],
        calendar: needed.has('calendar-translation') ? await curriculumService.getCalendar() : [],
        vocabulary,
        grammar: needed.has('grammar-drill')
          ? (await Promise.all(grammarCategories.map((c) => curriculumService.getGrammarDrills(c)))).reduce(
              (acc, drills, i) => {
                acc[grammarCategories[i]!] = drills;
                return acc;
              },
              {} as Record<string, GrammarDrill[]>
            )
          : {},
      };
      // Prioritise the items missed last time so a retry re-tests them.
      const deck = buildQuestions(specs, data, unitIndex, missedItemKeys);
      if (!cancelled) {
        setQuestions(deck);
        setPhase('ready');
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
    // `missedItemKeys` is a stable array reference from the path state, so
    // including it makes the effect re-run when a retry updates the list.
    // The unit's `vocab*` / `grammarCategories` values are listed explicitly:
    // they come from the immutable A1_UNITS config, so their references are
    // stable per unit and adding them cannot cause an extra rebuild — but
    // omitting them would leave the dep list lying about what the effect reads.
  }, [
    unlocked,
    unitIndex,
    isAuthenticated,
    unit?.checkpoint,
    unit?.vocabCategories,
    unit?.vocabPos,
    unit?.grammarCategories,
    runId,
    missedItemKeys,
  ]);

  const startRun = useCallback(() => {
    recordedRef.current = false;
    setPhase('playing');
  }, []);

  const retry = useCallback(() => {
    setQuestions([]);
    setPhase('loading');
    setRunId((r) => r + 1); // fresh without-replacement draw
  }, []);

  const total = questions.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= Math.round(CHECKPOINT_PASS_THRESHOLD * 100);
  const finished = phase === 'playing' && total > 0 && answered >= total;

  const missedItems = useMemo(
    () =>
      questions
        .map((q) => ({ q, correct: results[q.key] }))
        .filter((entry): entry is { q: CheckpointQuestion; correct: boolean } =>
          entry.correct === false
        ),
    [questions, results]
  );

  // ───────────────────────────────────────────────────────────────────────
  // RENDER-ONLY gates. Everything above this line is hooks, and it always all
  // runs — so a guest -> authed transition (or any other state flip) can
  // never change this component's hook count.
  // ───────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <CheckpointSignInGate isDE={isDE} />;
  }

  // A SUPPORT band (Band B) carries no checkpoint — the hard deep link still
  // loads (soft lock), so show a friendly "optional" screen, not an error.
  if (!unit || !unit.checkpoint) {
    return <CheckpointNoGate isDE={isDE} code={unit?.code ?? '?'} />;
  }

  // ---- Locked (soft-lock) screen ----
  if (!unlocked) {
    // The band that must be passed to unlock this one = the previous CORE band
    // (bands before may include the SUPPORT band B, which has no gate).
    const prevBand = (() => {
      for (let i = unitIndex - 1; i >= 0; i--) {
        const b = A1_UNITS[i];
        if (b && b.checkpoint) return b;
      }
      return undefined;
    })();
    const prevCode = prevBand?.code ?? 'A';
    return (
      <div className={theme.page.container}>
        <div className={theme.panel.surface}>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">
            {isDE ? unit.title.de : unit.title.en}
          </h1>
          <div className="mt-4 text-center">
            <span className="text-4xl" aria-hidden="true">🔒</span>
            <p className="mt-2 text-ink-600 dark:text-ink-300">
              {isDE
                ? `Dieses Band ist gesperrt. Bestehe Pforte ${prevCode}, um dieses Band freizuschalten.`
                : `This band is locked. Pass Gate ${prevCode} to unlock it.`}
            </p>
            <Link to={A1_PATH_ROUTE} className={`${theme.button.primary} mt-4 inline-flex min-h-[44px]`}>
              {isDE ? 'Zurück zum Lernpfad' : 'Back to learning path'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (phase === 'loading' || (phase === 'ready' && questions.length === 0)) {
    return (
      <div className={theme.page.container}>
        <div className="text-center text-ink-500 dark:text-ink-400">
          {isDE ? 'Fragen werden geladen…' : 'Loading checkpoint questions…'}
        </div>
      </div>
    );
  }

  // ---- Ready / start ----
  if (phase === 'ready') {
    return (
      <div className={theme.page.container}>
        <div className={theme.panel.surface}>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">
            {isDE ? unit.title.de : unit.title.en}
            <span className="ml-2 text-body font-medium text-ink-500 dark:text-ink-400">
              ({isDE ? unit.theme.de : unit.theme.en})
            </span>
          </h1>
          <p className="mt-2 text-body text-ink-600 dark:text-ink-300">
            {isDE
              ? `${total} Aufgaben · brauche ${Math.round(CHECKPOINT_PASS_THRESHOLD * 100)}% zum Bestehen`
              : `${total} questions · need ${Math.round(CHECKPOINT_PASS_THRESHOLD * 100)}% to pass`}
          </p>
          {alreadyPassed && (
            <p className="mt-2 text-body text-success-700 dark:text-success-300">
              {isDE ? 'Bereits bestanden ✓' : 'Already passed ✓'}
            </p>
          )}
          {/* A previous failed attempt changes what this run will be, so say so
              before the learner commits — the deck opens with their misses. */}
          {!alreadyPassed && attemptRecord && attemptRecord.missedItemKeys.length > 0 && (
            <p className="mt-2 text-body text-warning-700 dark:text-warning-300">
              {isDE
                ? `Letzter Versuch: ${Math.round(attemptRecord.lastScore * 100)}% · Diese Runde beginnt mit deinen ${attemptRecord.missedItemKeys.length} Fehlern.`
                : `Last attempt: ${Math.round(attemptRecord.lastScore * 100)}% · this run starts with your ${attemptRecord.missedItemKeys.length} mistakes.`}
            </p>
          )}
          {unitIndex === 2 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <GenderBadge article="der" />
              <GenderBadge article="die" />
              <GenderBadge article="das" />
              <GenderBadge article="plural" />
            </div>
          )}
          <button
            type="button"
            onClick={startRun}
            className={`${theme.button.primary} mt-6 w-full text-lg`}
          >
            {isDE ? 'Puffer starten' : 'Start checkpoint'}
          </button>
          <Link to={A1_PATH_ROUTE} className={`${theme.button.secondary} mt-3 w-full text-center`}>
            {isDE ? 'Zurück zum Lernpfad' : 'Back to learning path'}
          </Link>
        </div>
      </div>
    );
  }

  // ---- Finished / result ----
  if (finished) {
    return (
      <div className={theme.page.container}>
        <div className={theme.panel.surface}>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">
            {isDE ? unit.title.de : unit.title.en}
          </h1>
          <div
            className={`mt-4 text-center ${passed ? 'text-success-700 dark:text-success-300' : 'text-danger-700 dark:text-danger-300'}`}
          >
            <div className="text-3xl font-bold">{percent}%</div>
            <p className="mt-1">
              {passed
                ? isDE
                  ? '✅ Puffer bestanden!'
                  : '✅ Checkpoint passed!'
                : isDE
                  ? '❌ Noch nicht bestanden — übe die Fehler.'
                  : '❌ Not passed — review your mistakes.'}
            </p>
          </div>

          {missedItems.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-body font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                  {isDE ? 'Fehleranalyse' : 'Mistakes to review'}
                </h2>
                <span className="rounded-full bg-danger-100 px-2.5 py-0.5 text-meta font-semibold text-danger-700 dark:bg-danger-900/40 dark:text-danger-300">
                  {missedItems.length}/{total}
                </span>
              </div>
              {missedItems.map(({ q }) => (
                <div
                  key={q.key}
                  className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-meta dark:border-danger-900/50 dark:bg-danger-950/30"
                >
                  <span aria-hidden="true" className="mt-0.5 font-bold text-danger-600 dark:text-danger-300">✗</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink-700 dark:text-ink-300">{q.prompt}</div>
                    <div className="mt-0.5 text-success-700 dark:text-success-300">
                      ✓ {q.correctAnswer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-2">
            <button type="button" onClick={retry} className={`${theme.button.primary} w-full`}>
              {isDE ? 'Erneut versuchen' : 'Retry'}
            </button>
            <Link to={A1_PATH_ROUTE} className={`${theme.button.secondary} w-full text-center`}>
              {isDE ? 'Zurück zum Lernpfad' : 'Back to map'}
            </Link>
          </div>

          {/* Attempt history — makes a 3rd-attempt 80% pass read as earned
              rather than lucky, and sets the expectation that retrying is
              normal. Also states WHAT the retry will do, so the button below
              is not a mystery. */}
          {attemptRecord && attemptRecord.attempts > 1 && (
            <div className="mt-4 rounded-md border border-ink-200 bg-ink-50 p-3 text-meta dark:border-ink-800 dark:bg-ink-800/60">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-ink-700 dark:text-ink-200">
                  {isDE
                    ? `${attemptRecord.attempts} Versuche · Bestwert ${Math.round(attemptRecord.best * 100)}%`
                    : `${attemptRecord.attempts} attempts · best ${Math.round(attemptRecord.best * 100)}%`}
                </span>
                {!passed && missedItems.length > 0 && (
                  <span className="text-ink-500 dark:text-ink-400">
                    {isDE
                      ? '· Der nächste Versuch beginnt mit genau diesen Fehlern.'
                      : '· Your next attempt starts with exactly these mistakes.'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Playing (engine-driven) ----
  return (
    <div className={theme.page.container}>
      <MultipleChoice
        session={session}
        renderPrompt={(q) => (
          <>
            {q.prompt}
            {q.source === 'article-precision' && (
              <span className="ml-2 align-top">
                <GenderBadge article={q.article ?? 'der'} dot labeled={false} />
              </span>
            )}
            {q.source === 'listening-gap' && q.audioUrl && (
              <button
                type="button"
                onClick={() => playAudioUrl(q.audioUrl as string)}
                className="ml-3 inline-flex items-center gap-1 rounded-sm bg-accent-100 px-3 py-1.5 text-body font-medium text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300"
                aria-label={isDE ? 'Audio abspielen' : 'Play audio'}
              >
                🔊 {isDE ? 'Anhören' : 'Listen'}
              </button>
            )}
          </>
        )}
        hideFooter
        // Prefer the drill CATEGORY's hint, but only when one actually exists —
        // otherwise keep the generic 'grammar-drill' hint, which is a real hint
        // and far better than getHint()'s universal "check the article or word
        // order" fallback. Without this guard, adding `hintReason: <category>`
        // unconditionally would have made 'a1-checkpoint:grammar-drill' dead.
        hintReason={
          hasSpecificHint('a1-checkpoint', session.current?.hintReason)
            ? session.current?.hintReason
            : session.current?.source
        }
        speechRate={playbackRateForModule(unitIndex)}
      />
      {/* Footer with Back + engine-driven Next/Finish */}
      <div className="mx-auto mt-3 flex max-w-3xl justify-between gap-2 px-1">
        <Link to={A1_PATH_ROUTE} className={theme.button.secondary}>
          {isDE ? 'Zurück' : 'Back'}
        </Link>
        {session.locked && (
          <button type="button" onClick={session.next} className={theme.button.primary}>
            {index >= total - 1 ? (isDE ? 'Fertig' : 'Finish') : isDE ? 'Weiter' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}