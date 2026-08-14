import { Link } from 'react-router-dom';
import { BookA, Hash, Calendar, BookOpen, MessageCircle, Library } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { sharedTextDatabase } from '../../data/sharedContent';
import type { LucideIcon } from 'lucide-react';

/**
 * Reusable A1 Learning Path component.
 *
 * Extracted from HomePage.tsx so that both the guest Home page and the
 * dedicated /learn hub can render the same learning-path grid without
 * duplicating markup or data.
 *
 * Each module card links to an existing route that is already service-backed.
 * Now uses Lucide React icons for consistent, professional appearance.
 */
export function LearningPath() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const sections: Array<{ key: string; label: string; path: string; icon: LucideIcon }> = [
    { key: 'alphabet', label: 'Alphabet', path: '/alphabet', icon: BookA },
    { key: 'numbers', label: isDE ? 'Zahlen' : 'Numbers', path: '/numbers', icon: Hash },
    { key: 'calendar', label: isDE ? 'Kalender' : 'Calendar', path: '/calendar', icon: Calendar },
    { key: 'articles', label: isDE ? 'Artikel' : 'Articles', path: '/articles', icon: BookOpen },
    { key: 'greetings', label: isDE ? 'Grüße' : 'Greetings', path: '/greetings', icon: MessageCircle },
    { key: 'stories', label: isDE ? 'Geschichten' : 'Stories', path: '/stories', icon: Library },
  ];

  return (
    <section className="mb-8" id="learning-path">

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sections.map((section) => (
          <Link
            key={section.key}
            to={section.path}
            className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:bg-slate-50 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
            aria-label={`${section.label} module`}
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:group-hover:bg-blue-900/50" aria-hidden="true">
              <section.icon className="h-7 w-7" strokeWidth={2} />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{section.label}</h3>
            <p className="mt-3 flex-1 text-sm leading-7 text-slate-600 dark:text-slate-400">
              {sharedTextDatabase[section.key]?.description || ''}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition group-hover:text-blue-800 dark:text-blue-300 dark:group-hover:text-blue-200">
              {isDE ? 'Starten' : 'Start'} →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
