import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

interface PageHeadingProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
}

/**
 * Single, consistent H1 heading for tool/detail pages.
 * Replaces divergent h1 styles (PracticeHub text-4xl, Glossary text-2xl, etc.)
 * with one source of truth. Renders exactly one <h1> per instance.
 */
export function PageHeading({ title, subtitle, backTo, backLabel }: PageHeadingProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const back = backLabel ?? (isDE ? 'Zurück' : 'Back');
  return (
    <header className="mb-4">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-body font-semibold text-accent-600 hover:text-accent-800 active:scale-95 dark:text-accent-300 dark:hover:text-accent-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-500"
        >
          <ChevronLeft className="h-4 w-4" />
          {back}
        </Link>
      )}
      <h1 className="mt-1 text-2xl font-bold text-ink-950 dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-body leading-6 text-ink-600 dark:text-ink-300">{subtitle}</p>
      )}
    </header>
  );
}