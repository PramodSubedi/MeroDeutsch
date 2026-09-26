/**
 * src/components/lesson/LessonPractice.tsx
 *
 * The practice tools that reinforce a given lesson, rendered two ways.
 *
 * WHY TWO PLACES
 * The desktop context rail is the primary home (that is where the brief asked
 * for it). But the rail is `hidden xl:block` — the existing rule for every
 * context rail in this app, and rightly so, since a 288px column has nowhere to
 * go on a phone. Without a second rendering the suggestions would simply not
 * exist for most learners, which is not "extra", it is missing. So the same
 * list renders inline at the foot of the lesson page below `xl`.
 *
 * One component, two layouts, ONE source of the data: both read
 * `data/lessonPracticeLinks.ts` and resolve tool ids through the module
 * registry, so a tool that is renamed or removed updates both at once.
 *
 * These are SUPPORTING tools. The lesson is the material on the page; a tool
 * earns its place here only by drilling something that lesson covered, which
 * is why every entry carries a one-line reason.
 *
 * WHY THE RESOLUTION LIVES IN `data/lessonPracticeLinks.ts`
 * That module owns the registry lookup, so this file exports only components —
 * mixing the two is what the `only-export-components` lint rule objects to, and
 * it is the reason 25 other files in this app warn today. This one does not.
 */
import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { resolveLessonTools } from '../../data/lessonPracticeLinks';
import { labelForPath } from '../../config/routeLabels';
import { theme } from '../../config/theme';

/** The inline list used below `xl`, where the rail does not render. */
export function LessonPracticeInline({ unitIndex }: { unitIndex: number }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const tools = resolveLessonTools(unitIndex);
  if (tools.length === 0) return null;

  return (
    <section className="mt-8 border-t border-ink-200 pt-6 xl:hidden dark:border-ink-800">
      <h2 className="text-h2 font-semibold text-ink-900 dark:text-ink-50">
        {isDE ? 'Passende Übungen' : 'Related practice'}
      </h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        {isDE
          ? 'Optionale Wiederholung zu dieser Lektion.'
          : 'Optional reinforcement for what this lesson covered.'}
      </p>
      <ul className="mt-3 space-y-2">
        {tools.map((tool) => {
          const Icon = tool.Icon;
          return (
            <li key={tool.toolId}>
              <Link
                to={tool.path}
                className={`${theme.button.secondary} w-full items-start justify-start gap-2.5 text-left`}
              >
                <span className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{labelForPath(tool.path, isDE)}</span>
                  <span className="mt-0.5 block text-meta font-normal leading-snug text-ink-500 dark:text-ink-400">
                    {isDE ? tool.why.de : tool.why.en}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
