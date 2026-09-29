/**
 * src/components/lesson/LessonRunPage.tsx
 *
 * `/lesson/:n` when the `lesson_render` switch says `run`.
 *
 * ── WHAT CHANGED FROM THE PASS-THROUGH ──────────────────────────────────────
 * This used to render `LessonModulePage` verbatim, so that an operator who
 * flipped the flag early got a working lesson rather than a crash. The step-flow
 * renderer now exists, so the pass-through has gone — in the same change that
 * makes the branch real, which is why there is never a version of this file that
 * is both reachable and unfinished.
 *
 * The load is unchanged in shape from every other lesson consumer
 * (`loadLesson(unit.id)`), and the fallback is deliberately the LEGACY page: a
 * unit whose lesson file has no `steps[]` — one the migration has not reached —
 * must still show its content, in the renderer that is known to handle it.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { A1_UNITS, getNodeByRoute } from '../../data/a1Path';
import { useA1Path } from '../../hooks/useA1Path';
import { loadLesson } from '../../data/curriculum/lessons';
import type { Run, Step } from '../../data/curriculum/steps';
import type { UnitLessonContent } from '../../data/curriculum/schema';
import { SkeletonLoader } from '../SkeletonLoader';
import { StepRunner } from '../run/StepRunner';
import { LessonModulePage } from './LessonModulePage';

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'legacy' }
  | { status: 'ready'; run: Run };
/** Wrap a lesson's steps as a `linear` run. */
function toRun(unitId: string, lesson: UnitLessonContent): Run {
  return {
    id: `${unitId}-lesson`,
    title: A1_UNITS.find((u) => u.id === unitId)?.title ?? { en: unitId, de: unitId },
    mode: 'linear',
    steps: (lesson.steps ?? []) as Step[],
  };
}

export function LessonRunPage() {
  const params = useParams<{ unitIndex?: string }>();
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const raw = params.unitIndex;
  const index = Number(raw);
  const unit = Number.isInteger(index) ? A1_UNITS[index] : undefined;
  // Finishing a run ticks the unit's `learn` node.
  //
  // The id is RESOLVED FROM THE ROUTE, never constructed. The sixteen units do not
  // agree on a naming convention: m06–m16 use `mNN-learn`, but m01–m05 use their
  // topic instead — `m01-greetings`, `m02-numbers`, `m03-alphabet`, `m04-family`,
  // `m05-articles`. Building `` `${unit.id}-learn` `` completed a node that does
  // not exist in five of the sixteen units, and `completeNode` accepts an unknown
  // id without complaint, so it failed silently.
  //
  // Going through `getNodeByRoute` rather than reading the unit also means this
  // follows the spine: if a learn node is ever repointed again, completion follows
  // it rather than needing a second edit in a second place.
  //
  // Currently REDUNDANT, and deliberately so: `A1PathVisitTracker` completes a
  // learn node on ARRIVAL, so the node is already ticked by the time anyone
  // reaches the last screen, and `completeNode` is a no-op for an id that is
  // already complete. It is wired now because the tracker is wrong — arrival is
  // not completion — and when the tracker stops completing learn nodes this line
  // is already correct.
  const { completeNode } = useA1Path();
  const onComplete = useCallback(() => {
    const learnNode = getNodeByRoute(`/lesson/${index}`);
    if (learnNode) completeNode(learnNode.id);
  }, [completeNode, index]);

  usePageTitle(unit ? `${unit.title.en} · Mero Deutsch` : 'Mero Deutsch');

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    if (!unit) {
      setLoaded({ status: 'missing' });
      return;
    }
    let cancelled = false;
    setLoaded({ status: 'loading' });
    void loadLesson(unit.id).then((lesson) => {
      if (cancelled) return;
      // No lesson file, or one the migration has not reached: the legacy renderer
      // is the one that can still draw this content, so hand back to it rather
      // than showing an empty run.
      if (!lesson?.steps?.length) {
        setLoaded({ status: lesson ? 'legacy' : 'missing' });
        return;
      }
      setLoaded({ status: 'ready', run: toRun(unit.id, lesson) });
    });
    return () => {
      cancelled = true;
    };
  }, [unit]);

  if (loaded.status === 'loading') return <SkeletonLoader />;
  if (loaded.status === 'ready') {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        <StepRunner run={loaded.run} onComplete={onComplete} />
        {/* ── THE NOTES LINK ──
            The exercises and the reading are two surfaces on purpose: this page
            drills, and `/lesson/:n/notes` is the long-standing document renderer
            a learner reads for the same unit.

            This link is a REGRESSION FIX. `LessonModulePage` carries this exact
            button; the step-flow page did not, and shipping it that way made the
            premium notes unreachable from anywhere in the lesson — a paid tier
            with no way in. Restored rather than redesigned, and it points at the
            route that already exists rather than a notebook that used to be
            rendered here. */}
        <Link
          to={`/lesson/${raw}/notes`}
          className={`${theme.button.secondary} mx-auto mt-8 flex w-full max-w-3xl items-center justify-between gap-3`}
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
      </div>
    );
  }
  return <LessonModulePage />;
}
