import { Link } from 'react-router-dom';
import { BookA, Hash, Calendar, BookOpen, MessageCircle, Library } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useLastModule } from '../../hooks/useLastModule';
import { sharedTextDatabase } from '../../data/sharedContent';
import type { LucideIcon } from 'lucide-react';
import { ANCHORS } from '../../lib/anchors';

/**
 * Learning components path — the FREE tier's learning surface.
 *
 * Restored from the pre-A1-spine version of this file (git HEAD) and reused for
 * everyone who is not on Premium. The A1 campaign spine
 * (`components/path/UnitSpine`) is the Premium curriculum; this is the open,
 * self-directed path built from the existing learning components. Both link to
 * the same service-backed routes, so gating is presentation only — nothing is
 * 404'd and deep links keep working.
 *
 * TWO VARIANTS, ONE COMPONENT
 *  - `grid`  (guests): a flat grid, "learn what you like". No step numbers and
 *    no "last visited" highlight — a guest has no account to carry progress
 *    between devices, so implying a position in a sequence would be a lie.
 *  - `path`  (signed-in, free): the same components presented as a DESIGNED
 *    path — numbered in teaching order, with the most recently visited module
 *    ringed and badged, so it reads as a course rather than a menu.
 *
 * The six components are the A1 foundations: alphabet, numbers, calendar,
 * articles, greetings, stories.
 */
export type LearningPathVariant = 'grid' | 'path';

export function LearningPath({ variant = 'path' }: { variant?: LearningPathVariant }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getLastModule } = useLastModule();
  const lastModulePath = getLastModule();

  const sections: Array<{ key: keyof typeof sharedTextDatabase; label: string; path: string; icon: LucideIcon }> = [
    { key: 'alphabet', label: 'Alphabet', path: '/alphabet', icon: BookA },
    { key: 'numbers', label: isDE ? 'Zahlen' : 'Numbers', path: '/numbers', icon: Hash },
    { key: 'calendar', label: isDE ? 'Kalender' : 'Calendar', path: '/calendar', icon: Calendar },
    { key: 'articles', label: isDE ? 'Artikel' : 'Articles', path: '/articles', icon: BookOpen },
    { key: 'greetings', label: isDE ? 'Grüße' : 'Greetings', path: '/greetings', icon: MessageCircle },
    { key: 'stories', label: isDE ? 'Geschichten' : 'Stories', path: '/stories', icon: Library },
  ];

  return (
    <section className="mb-6 scroll-mt-20" id={ANCHORS.learningPath}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section, index) => {
          // Guests get no position marker: without an account there is no
          // progress to imply, so a step number would only suggest a sequence
          // they are not actually being walked through.
          const isLast = variant === 'path' && lastModulePath === section.path;
          return (
            <Link
              key={section.key}
              to={section.path}
              className={`group relative flex h-full flex-col overflow-hidden rounded-lg border p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 ${
                isLast
                  ? 'border-accent-400 bg-accent-50/40 ring-2 ring-accent-500 dark:border-accent-500 dark:bg-accent-950/30'
                  : 'border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-950'
              }`}
              aria-label={`${section.label} module${isLast ? ' — last visited' : ''}`}
            >
              {isLast && (
                <span className="absolute right-4 top-4 rounded-full bg-accent-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {isDE ? 'Zuletzt' : 'Last'}
                </span>
              )}
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 transition-colors group-hover:bg-accent-100 dark:bg-accent-950/50 dark:text-accent-400 dark:group-hover:bg-accent-900/50"
                  aria-hidden="true"
                >
                  <section.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                {variant === 'path' && (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-200 text-meta font-bold text-ink-500 dark:border-ink-700 dark:text-ink-400">
                    {index + 1}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-white">{section.label}</h3>
              <p className="mt-2 flex-1 text-body leading-6 text-ink-600 dark:text-ink-400">
                {sharedTextDatabase[section.key]?.description || ''}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-body font-semibold text-accent-600 transition group-hover:text-accent-800 dark:text-accent-300 dark:group-hover:text-accent-200">
                {isDE ? 'Starten' : 'Start'} →
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
