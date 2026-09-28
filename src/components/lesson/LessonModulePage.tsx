/**
 * src/components/lesson/LessonModulePage.tsx — the interactive lesson surface
 *
 * This is the FREE tier, and it is deliberately built from the primitives the
 * existing learning modules already use, so a lesson looks and behaves like
 * /greetings or /numbers rather than like a document:
 *
 *   TabGroup            the Learn / Grammar / Practice strip
 *   SectionGrid         one titled block per step
 *   StandardStudyCard   the trilingual word card (one per lexicon entry)
 *   useExerciseSession  the existing quiz state machine — XP, SRS, option locking
 *   MultipleChoice      the existing MCQ renderer
 *   questionGenerator   buildMcq / drawWithoutReplacement
 *
 * WHY GENERATED QUESTIONS RATHER THAN ONLY THE AUTHORED BANK
 * The imported practice bank is heterogeneous: across the 15 lessons it spans ~15
 * `kind` values (Fill-in, Translation, Matching, Error Correction, Sentence
 * Unscramble, Dictation…) and only 3-5 of the 25 items in a rich lesson carry
 * `options`, so only those can be rendered as multiple choice. Rather than build
 * fifteen exercise types — or silently show the rest as read-only prose — the
 * practice tab does BOTH: it renders the authored MCQ items that are genuinely
 * multiple choice, and generates additional questions from the lesson's OWN
 * lexicon with the same generator the old pages use. Nothing is invented: every
 * question and every distractor is a word the curriculum actually lists.
 *
 * THE DOCUMENT VERSION IS NOT HERE
 * The NotebookLM lesson read as an article lives behind `<PremiumGate />`. This
 * page is what a free learner gets, and it is the more interactive of the two by
 * design.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { useExerciseSession, type ExerciseQuestion } from '../../hooks/useExerciseSession';
import { A1_UNITS, A1_UNIT_COUNT } from '../../data/a1Path';
import { loadLesson } from '../../data/curriculum/lessons';
import { StandardStudyCard } from '../StandardStudyCard';
import { SectionGrid } from '../SectionGrid';
import { TabGroup, type Tab } from '../TabGroup';
import { MultipleChoice } from '../exercises/MultipleChoice';
import { ExerciseRoundFooter } from '../exercises/ExerciseRoundFooter';
import { LessonPracticeInline } from './LessonPractice';
import { buildMcq, pickNUnique } from '../../utils/questionGenerator';
import { theme } from '../../config/theme';
import { A1_PATH_ROUTE } from '../../data/cefrLevels';
import { EmptyState } from '../EmptyState';
import { LoadingBlock } from '../common/LoadingBlock';
import type { LexiconEntry, UnitLessonContent } from '../../data/curriculum/schema';

/** A practice question for the engine. */
interface LessonQuestion extends ExerciseQuestion {
  /** Shown as the MCQ prompt. */
  prompt: string;
}

/** How many questions a round draws. */
const DECK_SIZE = 10;

/**
 * Build a round from a lesson, in priority order:
 *   1. AUTHORED MCQ — practice-bank items that genuinely carry an option list.
 *      These are the curriculum's own questions, so they come first.
 *   2. GENERATED — German→English and English→German from the lesson's lexicon,
 *      distractors drawn by `buildMcq` (unique by lemma, shuffled once).
 *
 * Drawn WITHOUT REPLACEMENT so a thin lesson never repeats a word in one round.
 */
function buildDeck(lesson: UnitLessonContent, unitCode: string): LessonQuestion[] {
  const lexicon = (lesson.lexicon ?? []).filter((e) => e.word && e.en);
  const questions: LessonQuestion[] = [];

  for (const item of lesson.practiceBank ?? []) {
    if (!item.options || item.options.length < 2 || !item.answer) continue;
    questions.push({
      key: `${unitCode}-bank-${item.prompt.slice(0, 32)}`,
      prompt: item.prompt,
      correctAnswer: item.answer,
      options: item.options,
      // The prompt is safe to speak BEFORE the answer locks; the answer is not.
      speakPrompt: item.prompt,
      speakAfter: item.answer,
    });
  }

  // English glosses must be distinct, or two options can both be correct.
  const distinct = new Map<string, LexiconEntry>();
  for (const entry of lexicon) {
    const key = entry.en.trim().toLowerCase();
    if (!distinct.has(key)) distinct.set(key, entry);
  }
  const pool = [...distinct.values()];
  if (pool.length >= 4) {
    const picks = pickNUnique({ items: pool, count: Math.min(DECK_SIZE, pool.length), getKey: byWord });
    for (const entry of picks) {
      questions.push({
        key: `${unitCode}-de-${entry.word}`,
        prompt: `What does "${entry.en}" mean in German?`,
        correctAnswer: entry.word,
        options: buildMcq({
          correctItem: entry,
          allItems: pool,
          getKey: (e: LexiconEntry) => e.word,
          count: 4,
        }).map((e) => e.word),
        speakPrompt: `What does ${entry.en} mean in German?`,
        speakAfter: entry.word,
      });
      questions.push({
        key: `${unitCode}-en-${entry.word}`,
        prompt: `What does "${entry.word}" mean in English?`,
        correctAnswer: entry.en,
        options: buildMcq({
          correctItem: entry,
          allItems: pool,
          getKey: (e: LexiconEntry) => e.word,
          count: 4,
        }).map((e) => e.en),
        speakPrompt: entry.word,
        speakAfter: entry.en,
      });
    }
  }

  return pickNUnique({ items: questions, count: Math.min(DECK_SIZE, questions.length) });
}

/** Stable key for a lexicon entry — `pickNUnique`/`buildMcq` both dedupe on it. */
function byWord(entry: LexiconEntry): string {
  return entry.word;
}

/** "die Lampe" — the article is part of what a learner must recall. */
function withArticle(entry: LexiconEntry): string {
  if (!entry.article || entry.article === 'plural') return entry.word;
  return `${entry.article} ${entry.word}`;
}

/**
 * The grammar tab: the lesson's own grammar blocks, rendered compactly.
 *
 * Deliberately NOT the document view. This reuses the same `GrammarRuleTable`
 * the /articles and /grammar pages use for a rule table, and renders prose notes
 * as short lines — a study aid you read on the page, not an article. The article
 * version of the same material is the premium notes route.
 *
 * ASCII artwork (the `callout` field) is rendered in a scrollable <pre>, for the
 * same reason LessonSections does it: those runs are 70+ characters with no break
 * opportunity and would push the whole page sideways on a phone.
 */
function GrammarTab({ lesson, isDE }: { lesson: UnitLessonContent; isDE: boolean }) {
  return (
    <>
      {(lesson.grammar ?? []).map((block, i) => (
        <SectionGrid
          key={i}
          title={block.title?.de || block.title?.en || (isDE ? 'Regel' : 'Rule')}
          description={isDE ? 'Grammatikmechanik dieser Lektion.' : 'Grammar mechanics for this lesson.'}
          bare
        >
          <div className="space-y-3">
            {(block.notes ?? [])
              .map((n) => n.de || n.en || '')
              .filter(Boolean)
              .map((note, j) => (
                <p key={j} className="break-words text-body text-ink-700 dark:text-ink-200">
                  {note}
                </p>
              ))}
            {block.callout && (
              <pre className="overflow-x-auto rounded-md bg-ink-50 p-3 font-mono text-meta text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                {block.callout}
              </pre>
            )}
            {(block.bullets ?? []).length > 0 && (
              <ul className="space-y-1.5">
                {(block.bullets ?? []).map((bullet, j) => (
                  <li key={j} className="flex gap-2 text-body text-ink-700 dark:text-ink-200">
                    <span className={theme.gender.der.text}>•</span>
                    <span className="break-words">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* The block's own table is `{columns, rows}`, NOT the `RuleRow`
                shape `GrammarRuleTable` takes, so it is rendered here rather
                than forced into that component with invented titles. */}
            {block.table && (
              <div className="overflow-x-auto rounded-md border border-ink-200 dark:border-ink-700">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr className="bg-ink-50 dark:bg-ink-800">
                      {block.table.columns.map((column, c) => (
                        <th
                          key={c}
                          className="px-3 py-2 text-left text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.table.rows.map((row, r) => (
                      <tr key={r} className="border-t border-ink-200 dark:border-ink-800">
                        {row.map((cell, c) => (
                          <td key={c} className="px-3 py-2 align-top text-ink-700 dark:text-ink-200">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionGrid>
      ))}
    </>
  );
}

export function LessonModulePage() {
  const { unitIndex } = useParams();
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getUnitPhase } = useA1Path();

  const index = Number(unitIndex);
  const unit = Number.isFinite(index) ? A1_UNITS[index] : undefined;
  const isLocked = unit ? getUnitPhase(unit.index) === 'locked' : false;

  const [lesson, setLesson] = useState<UnitLessonContent | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('learn');
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!unit) return;
    let cancelled = false;
    setLoading(true);
    setLesson(undefined);
    setTab('learn');
    loadLesson(unit.id).then(
      (loaded) => {
        if (cancelled) return;
        setLesson(loaded);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [unit]);

  // `round` is in the deps on purpose: a new round must produce a NEW deck, and
  // without it "Play again" would reshuffle nothing.
  const deck = useMemo(
    () => (lesson && unit ? buildDeck(lesson, unit.code) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, unit?.code, round]
  );

  const session = useExerciseSession<LessonQuestion>({ questions: deck, module: 'a1-lesson' });

  if (!unit) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <EmptyState
          title={isDE ? 'Lektion nicht gefunden' : 'Lesson not found'}
          description={isDE ? 'Diese Nummer gibt es nicht.' : 'That lesson number does not exist.'}
        />
        <Link to={A1_PATH_ROUTE} className={`${theme.button.secondary} mt-4`}>
          {isDE ? 'Zurück zum Lernpfad' : 'Back to the learning path'}
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <LoadingBlock label={isDE ? 'Lektion wird geladen…' : 'Loading lesson…'} />
      </main>
    );
  }

  if (!lesson || (lesson.lexicon ?? []).length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <EmptyState
          title={isDE ? 'Lektion noch nicht importiert' : 'Lesson not imported yet'}
          description={
            isDE
              ? 'Für diese Lektion gibt es noch keinen Inhalt.'
              : 'No lesson content has been imported for this unit yet.'
          }
        />
        <Link to={A1_PATH_ROUTE} className={`${theme.button.secondary} mt-4`}>
          {isDE ? 'Zurück zum Lernpfad' : 'Back to the learning path'}
        </Link>
      </main>
    );
  }

  const lexicon = lesson.lexicon ?? [];
  // v3 tags words the learner PRODUCES vs only RECOGNISES. Splitting the card
  // grid on that is the whole point of importing the tag, so "active" words are
  // the ones the generated questions drill.
  const active = lexicon.filter((e) => e.frequency === 'active');
  const passive = lexicon.filter((e) => e.frequency !== 'active');
  const primary = active.length > 0 ? active : lexicon;
  const secondary = active.length > 0 ? passive : [];



  const tabs: Tab[] = [
    { id: 'learn', label: isDE ? 'Lernen' : 'Learn' },
    ...(lesson.grammar?.length ? [{ id: 'grammar', label: isDE ? 'Grammatik' : 'Grammar' }] : []),
    ...(deck.length ? [{ id: 'practice', label: isDE ? 'Üben' : 'Practice' }] : []),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        to={A1_PATH_ROUTE}
        className="inline-flex min-h-[44px] items-center gap-2 text-meta font-medium text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {isDE ? 'Lernpfad' : 'Learning path'}
      </Link>

      <header className="mt-2">
        <p className="text-micro font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">
          {isDE ? `Lektion ${index + 1}` : `Lesson ${index + 1}`}
          {lesson.cefr ? ` · CEFR ${lesson.cefr}` : ''}
        </p>
        <h1 className="mt-1 text-h1 font-bold text-ink-900 dark:text-ink-50">
          {isDE ? unit.title.de : unit.title.en}
        </h1>
        <p className="mt-1 text-body text-ink-600 dark:text-ink-300">
          {isDE ? unit.theme.de : unit.theme.en}
        </p>
      </header>

      {isLocked && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-meta text-ink-600 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {isDE
              ? 'Diese Lektion ist noch gesperrt. Du kannst sie trotzdem lernen — pass einfach die vorherige Prüfung, um sie im Lernpfad freizuschalten.'
              : 'This lesson is still locked. You can study it anyway — just pass the previous checkpoint to unlock it on the path.'}
          </span>
        </p>
      )}

      {/* The premium deep-dive. The interactive tabs below ARE the lesson; this
          is the article version of the same material, and it is the paid tier. */}
      <Link
        to={`/lesson/${index}/notes`}
        className={`${theme.button.secondary} mt-4 w-full items-center justify-between gap-3`}
      >
        <span className="min-w-0 text-left">
          <span className="block text-micro uppercase tracking-wider text-warning-700 dark:text-warning-300">
            Premium
          </span>
          <span className="block truncate">
            {isDE ? 'Lektüre-Notizen zur Lektion' : 'Read the full lesson notes'}
          </span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <div className="mt-6">
        <TabGroup tabs={tabs} activeTab={tab} onTabChange={setTab} />
      </div>

      {tab === 'learn' && (
        <>
          {lesson.objectives && lesson.objectives.en.length > 0 && (
            <SectionGrid
              title={isDE ? 'Lernziele' : 'Learning objectives'}
              description={isDE ? 'Was du am Ende kannst.' : 'What you will be able to do.'}
              bare
            >
              <ul className="space-y-1.5">
                {lesson.objectives.en.map((item, i) => (
                  <li key={i} className="flex gap-2 text-body text-ink-700 dark:text-ink-200">
                    <span className={theme.gender.der.text}>▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SectionGrid>
          )}

          <SectionGrid
            title={
              active.length > 0
                ? isDE
                  ? `Aktive Wörter (${primary.length})`
                  : `Active words (${primary.length})`
                : isDE
                  ? `Vokabeln (${primary.length})`
                  : `Vocabulary (${primary.length})`
            }
            description={
              active.length > 0
                ? isDE
                  ? 'Wörter, die du selbst benutzen sollst.'
                  : 'Words you are expected to use yourself.'
                : isDE
                  ? 'Alle Wörter dieser Lektion.'
                  : 'Every word in this lesson.'
            }
            bare
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {primary.map((entry, i) => (
                <StandardStudyCard
                  key={`${entry.word}-${i}`}
                  badge={i + 1}
                  german={withArticle(entry)}
                  phonetic={entry.ipa}
                  nepali={entry.ne}
                  english={entry.en}
                  contextNote={entry.examples?.[0]?.de}
                  langMode={langMode}
                />
              ))}
            </div>
          </SectionGrid>

          {secondary.length > 0 && (
            <SectionGrid
              title={
                isDE
                  ? `Passiv — nur erkennen (${secondary.length})`
                  : `Passive — recognise only (${secondary.length})`
              }
              description={
                isDE ? 'Diese Wörter lernst du zum Verstehen.'                 : 'These words are for understanding.'
              }
              bare
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {secondary.map((entry, i) => (
                  <StandardStudyCard
                    key={`${entry.word}-${i}`}
                    badge={i + 1}
                    german={withArticle(entry)}
                    phonetic={entry.ipa}
                    nepali={entry.ne}
                    english={entry.en}
                    langMode={langMode}
                  />
                ))}
              </div>
            </SectionGrid>
          )}
        </>
      )}

      {tab === 'grammar' && <GrammarTab lesson={lesson} isDE={isDE} />}

      {tab === 'practice' && (
        <section className="mt-6">
          {deck.length === 0 ? (
            <p className="text-body text-ink-500 dark:text-ink-400">
              {isDE
                ? 'Für diese Lektion gibt es keine Übungsfragen.'
                : 'No practice questions for this lesson.'}
            </p>
          ) : (
            <>
              <MultipleChoice
                session={session}
                columns={2}
                renderPrompt={(q) => <span>{q.prompt}</span>}
              />
              <ExerciseRoundFooter
                session={session}
                onPlayAgain={() => setRound((n) => n + 1)}
                nextLabel={isDE ? 'Nächste →' : 'Next →'}
              />
            </>
          )}
        </section>
      )}

      <LessonPracticeInline unitIndex={index} />

      <nav
        aria-label={isDE ? 'Lektionsnavigation' : 'Lesson navigation'}
        className="mt-8 flex items-stretch justify-between gap-3 border-t border-ink-200 pt-4 dark:border-ink-800"
      >
        {index > 0 ? (
          <Link
            to={`/lesson/${index - 1}`}
            className={`${theme.button.secondary} min-w-0 flex-1 justify-start gap-2 px-3`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-micro uppercase tracking-wider text-ink-500">
                {isDE ? 'Vorherige' : 'Previous'}
              </span>
              <span className="block truncate">
                {isDE ? A1_UNITS[index - 1]!.title.de : A1_UNITS[index - 1]!.title.en}
              </span>
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {index < A1_UNIT_COUNT - 1 ? (
          <Link
            to={`/lesson/${index + 1}`}
            className={`${theme.button.secondary} min-w-0 flex-1 justify-end gap-2 px-3 text-right`}
          >
            <span className="min-w-0">
              <span className="block text-micro uppercase tracking-wider text-ink-500">
                {isDE ? 'Nächste' : 'Next'}
              </span>
              <span className="block truncate">
                {isDE ? A1_UNITS[index + 1]!.title.de : A1_UNITS[index + 1]!.title.en}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
    </main>
  );
}
