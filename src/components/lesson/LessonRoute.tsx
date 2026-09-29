/**
 * src/components/lesson/LessonRoute.tsx
 *
 * THE CONTAINMENT POINT. `/lesson/:n` renders through here, and here decides
 * which renderer runs.
 *
 * ── WHY THIS IS A SEPARATE COMPONENT AND NOT A BRANCH INSIDE THE PAGE ───────
 * The entire point of the `lesson_render` switch is that the `legacy` branch is
 * code nobody has touched. If the switch lived inside `LessonModulePage` — an
 * `if` at the top, or a ternary around its body — then every edit to this
 * rollout, including a mistake, would be a risk to the branch that is currently
 * serving every learner in production. The two branches would share a file, a
 * hook order, and a diff, and "the switch is off so it is safe" would stop being
 * true.
 *
 * So `LessonModulePage.tsx` is imported and rendered WHOLE, with no edit to it at
 * all. It cannot regress, because nothing in it changes. When the rollout
 * finishes, the switch and this file's `legacy` branch are deleted together.
 *
 * ── WHY THE STEP-FLOW IS LAZY ───────────────────────────────────────────────
 * `LessonModulePage` is already a lazy chunk; the run renderer is a second one.
 * Neither should be in the main bundle, and a learner who never opens a lesson
 * should download neither. React's own `<Suspense>` boundary covers the lazy
 * import, but it has to sit INSIDE this component for the fallback to be scoped
 * to the lesson — a boundary in `App.tsx` would replace the whole page, header
 * and all, with a spinner.
 */
import { Suspense, lazy } from 'react';
import { SkeletonLoader } from '../SkeletonLoader';
import { useLessonRender } from '../../hooks/useLessonRender';
import { LessonModulePage } from './LessonModulePage';

/**
 * The step-flow renderer. `Lazy` rather than lazy because it does not exist yet:
 * until it is built, `legacy` is not a default but the only working path, and a
 * broken import would take the lesson route down on a flag flip.
 */
const LessonRunPage = lazy(() =>
  import('./LessonRunPage').then((m) => ({ default: m.LessonRunPage })),
);

export function LessonRoute() {
  const render = useLessonRender();

  // `legacy` renders the current page untouched. This is the branch that must
  // keep working for the whole rollout, so it is the one with no logic in it.
  if (render === 'legacy') return <LessonModulePage />;

  return (
    <Suspense fallback={<SkeletonLoader />}>
      <LessonRunPage />
    </Suspense>
  );
}
