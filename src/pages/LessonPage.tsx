/**
 * src/pages/LessonPage.tsx — /lesson/:unitIndex
 *
 * Renders a unit's DOCUMENT content: the objectives, trilingual lexicon,
 * grammar blocks, traps, culture notes, dialogue and practice bank authored in
 * `src/data/curriculum/units/mNN.json` and rendered by `LessonSections`.
 *
 * Soft-locked exactly like the checkpoint routes: deep links always load, so a
 * learner who bookmarked a lesson (or a teacher sharing one) is never met with a
 * 404. The spine decides what is *recommended*, not what is reachable.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { A1_UNITS } from '../data/a1Path';
import { loadLesson } from '../data/curriculum/lessons';
import { LessonSections } from '../components/lesson/LessonSections';
import { LessonPedagogy } from '../components/lesson/LessonPedagogy';
import { LessonPracticeInline } from '../components/lesson/LessonPractice';
import { PremiumGate } from '../components/premium/PremiumGate';
import { useA1Path } from '../hooks/useA1Path';
import { theme } from '../config/theme';
import { A1_PATH_ROUTE } from '../data/cefrLevels';
import { EmptyState } from '../components/EmptyState';
import type { UnitLessonContent } from '../data/curriculum/schema';

/**
 * The document body. Split out so `<PremiumGate>` can wrap it cleanly and the
 * gate stays a one-liner at the bottom of this file.
 */
function LessonNotes() {
  const { unitIndex } = useParams();
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getUnitPhase } = useA1Path();

  const index = Number(unitIndex);
  const unit = Number.isFinite(index) ? A1_UNITS[index] : undefined;
  usePageTitle(unit ? `${unit.code} · ${isDE ? unit.title.de : unit.title.en}` : 'Lesson');

  /**
   * A locked lesson still opens and still teaches.
   *
   * This page used to be a dead end for anyone who reached it from a deep link
   * or an old bookmark, and the roadmap never linked anywhere. Now the roadmap
   * links HERE for every lesson, locked or not, so the page has to be honest
   * about locked state rather than pretending the gate does not exist: the
   * content renders, and a notice at the top says what unlocks it.
   */
  const phase = unit ? getUnitPhase(unit.index) : null;
  const isLocked = phase === 'locked';

  // The lesson is a lazily-imported chunk, so there is a real loading window on
  // the first open. `id` is the dependency: navigating between two lessons must
  // swap the content, not leave the previous unit's lesson on screen.
  const [lesson, setLesson] = useState<UnitLessonContent | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!unit) return;
    let cancelled = false;
    setLoading(true);
    setLesson(undefined);
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
  }, [unit?.id]);

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
          {lesson?.cefr ? ` · CEFR ${lesson.cefr}` : ''}
        </p>
        <h1 className="mt-1 text-h1 font-bold text-ink-900 dark:text-ink-50">
          {isDE ? unit.title.de : unit.title.en}
        </h1>
        <p className="mt-1 text-body text-ink-600 dark:text-ink-300">
          {isDE ? unit.theme.de : unit.theme.en}
        </p>
        <p className="mt-2 text-meta text-ink-500 dark:text-ink-400">
          {isDE ? unit.goal.de : unit.goal.en}
        </p>
      </header>

      {/* Locked notice. The content below still renders — soft lock means
          reachable, not hidden — so the notice explains the order rather than
          pretending this lesson does not exist. */}
      {isLocked && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-meta text-ink-600 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {isDE
              ? 'Diese Lektion ist noch gesperrt. Du kannst sie trotzdem lesen — pass einfach die vorherige Prüfung, um sie im Lernpfad freizuschalten.'
              : 'This lesson is still locked. You can read it anyway — just pass the previous checkpoint to unlock it on the path.'}
          </span>
        </p>
      )}

      {loading ? (
        // Skeleton mirrors the real block rhythm (a heading + a table) so the page
        // does not jump when the lesson chunk lands.
        <div className="mt-6 space-y-4" aria-busy="true">
          <div className="h-5 w-40 animate-pulse rounded-sm bg-ink-100 dark:bg-ink-800" />
          <div className="h-40 w-full animate-pulse rounded-lg bg-ink-100 dark:bg-ink-800" />
          <div className="h-32 w-full animate-pulse rounded-lg bg-ink-100 dark:bg-ink-800" />
        </div>
      ) : lesson ? (
        <>
          <LessonSections lesson={lesson} />
          {/* The teaching aids that used to be buried in the roadmap card: the
              honorifics table, the word-order comparison, the rule table. */}
          <LessonPedagogy pedagogy={unit.pedagogy} />
        </>
      ) : (
        <div className="mt-6">
          <EmptyState
            title={isDE ? 'Lektion noch nicht importiert' : 'Lesson not imported yet'}
            description={
              isDE
                ? 'Für diese Lektion gibt es noch keinen Inhalt.'
                : 'No lesson content has been imported for this unit yet.'
            }
          />
        </div>
      )}

      {/* Related practice, for everyone below xl. At xl and above the context
          rail renders the same list instead, so the two are never both visible. */}
      <LessonPracticeInline unitIndex={index} />

      {/* Previous / next. The old footer had two buttons that both said "back to
          the path"; one of those is now the header link, and the space is better
          spent letting a learner walk every lesson in order. */}
      <nav
        aria-label={isDE ? 'Lektionsnavigation' : 'Lesson navigation'}
        className="mt-10 flex items-stretch justify-between gap-3 border-t border-ink-200 pt-4 dark:border-ink-800"
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

        {index < A1_UNITS.length - 1 ? (
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

/**
 * `/lesson/:unitIndex/notes` — the PREMIUM tier.
 *
 * The whole point of this wrapper is that the paywall cannot be bypassed by
 * knowing the URL: the gate wraps the entire body, and the router still mounts
 * the page either way so a deep link never 404s.
 */
export function LessonPage() {
  return (
    <PremiumGate>
      <LessonNotes />
    </PremiumGate>
  );
}