import { Link } from 'react-router-dom';
import { BookA, Hash, Calendar, BookOpen, MessageCircle, Library } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useLastModule } from '../../hooks/useLastModule';
import { sharedTextDatabase } from '../../data/sharedContent';
import type { LucideIcon } from 'lucide-react';
import { ANCHORS } from '../../lib/anchors';

/**
 * Reusable A1 Learning Path component.
 *
 * Extracted from HomePage.tsx so that both the guest Home page and the
 * dedicated /learn hub can render the same learning-path grid without
 * duplicating markup or data.
 *
 * Each module card links to an existing route that is already service-backed.
 * Now uses Lucide React icons for consistent, professional appearance.
 * The most recently visited module is highlighted with a ring + "Last" label.
 */
export function LearningPath() {
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
        {sections.map((section) => {
          const isLast = lastModulePath === section.path;
          return (
            <Link
              key={section.key}
              to={section.path}
              className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                isLast
                  ? 'border-blue-400 bg-blue-50/40 ring-2 ring-blue-500 dark:border-blue-500 dark:bg-blue-950/30'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'
              }`}
              aria-label={`${section.label} module${isLast ? ' — last visited' : ''}`}
            >
              {isLast && (
                <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {isDE ? 'Zuletzt' : 'Last'}
                </span>
              )}
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:group-hover:bg-blue-900/50" aria-hidden="true">
                <section.icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{section.label}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {sharedTextDatabase[section.key]?.description || ''}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition group-hover:text-blue-800 dark:text-blue-300 dark:group-hover:text-blue-200">
                {isDE ? 'Starten' : 'Start'} →
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}