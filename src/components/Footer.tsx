import { Link } from 'react-router-dom';
import { Logo } from './common/Logo';
import { APP_VERSION } from '../config/appInfo';
import { useLang } from '../hooks/useLang';

interface FooterProps {
  /** Extra classes — Layout passes lg:ml-20/lg:ml-64 so the footer rides the
      content column beside the fixed rail (same inset as header + main). */
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  return (
    <footer className={`bg-white dark:bg-ink-900 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] py-6 pb-24 md:pb-6 mt-12 transition-colors ${className ?? ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-ink-50 dark:bg-ink-950/50 rounded-lg p-6">

          {/* Brand Column */}
          <div className="space-y-2 md:col-span-2">
            <Logo size="sm" variant="on-light" />
            <p className="text-meta text-ink-600 dark:text-ink-400 max-w-sm leading-snug">
              {isDE
                ? 'Deutschtraining für Nepali- und Englischsprachige mit interaktiver Spracherkennung und täglichen Übungen.'
                : 'Tailored German training for Nepali and English speakers, with interactive speech recognition and daily practice.'}
            </p>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-meta font-bold text-ink-600 dark:text-ink-400 uppercase tracking-wider mb-2">
              {isDE ? 'Entdecken' : 'Explore'}
            </h4>
            <ul className="space-y-0.5 text-meta text-ink-600 dark:text-ink-400 font-medium">
              <li><Link to="/dashboard" className="hover:text-accent-600 dark:hover:text-accent-400 transition-colors">{isDE ? 'Übersicht' : 'Dashboard'}</Link></li>
              <li><Link to="/alphabet" className="hover:text-accent-600 dark:hover:text-accent-400 transition-colors">Alphabet</Link></li>
              <li><Link to="/articles" className="hover:text-accent-600 dark:hover:text-accent-400 transition-colors">{isDE ? 'Artikel' : 'Articles'}</Link></li>
              <li><Link to="/glossary" className="hover:text-accent-600 dark:hover:text-accent-400 transition-colors">{isDE ? 'Glossar' : 'Glossary'}</Link></li>
            </ul>
          </div>

          {/* System status */}
          <div>
            <h4 className="text-meta font-bold text-ink-600 dark:text-ink-400 uppercase tracking-wider mb-2">
              System
            </h4>
            <div className="text-meta text-ink-600 dark:text-ink-400">
              <p>{isDE ? 'Produktion' : 'Production'} v{APP_VERSION}</p>
            </div>
          </div>

        </div>

        {/* Bottom copyright row */}
        <div className="mt-4 pt-3 flex flex-col sm:flex-row justify-between items-center text-meta text-ink-500 dark:text-ink-400 px-2 gap-3">
          <p>© {new Date().getFullYear()} MeroDeutsch. {isDE ? 'Für mehrsprachiges Lernen entwickelt.' : 'Designed for multilingual learning.'}</p>
          <div className="flex space-x-4 font-medium">
            <Link to="/privacy" className="inline-flex h-9 items-center hover:text-accent-600 dark:hover:text-accent-400 transition-colors">{isDE ? 'Datenschutz' : 'Privacy'}</Link>
            <Link to="/terms" className="inline-flex h-9 items-center hover:text-accent-600 dark:hover:text-accent-400 transition-colors">{isDE ? 'Nutzungsbedingungen' : 'Terms'}</Link>
            <Link to="/help" className="inline-flex h-9 items-center hover:text-accent-600 dark:hover:text-accent-400 transition-colors">{isDE ? 'Hilfe' : 'Support'}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}