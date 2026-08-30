import { Link } from 'react-router-dom';
import { Logo } from './common/Logo';

interface FooterProps {
  /** Extra classes — Layout passes lg:ml-20/lg:ml-64 so the footer rides the
      content column beside the fixed rail (same inset as header + main). */
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer className={`bg-white dark:bg-slate-900 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] py-6 pb-24 md:pb-6 mt-12 transition-colors ${className ?? ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-6">

          {/* Brand Column */}
          <div className="space-y-2 md:col-span-2">
            <Logo size="sm" variant="on-light" />
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-snug">
              Tailored German language training for Nepali and English speakers, featuring interactive speech recognition and smart daily challenges.
            </p>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
              Explore
            </h4>
            <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <li><Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link></li>
              <li><Link to="/alphabet" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Alphabet & Sounds</Link></li>
              <li><Link to="/articles" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Article Trainer</Link></li>
              <li><Link to="/glossary" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Glossary & Words</Link></li>
            </ul>
          </div>

          {/* System status */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
              System
            </h4>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <p>Production v1.2.0</p>
            </div>
          </div>

        </div>

        {/* Bottom copyright row */}
        <div className="mt-4 pt-3 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-400 px-2 gap-3">
          <p>© {new Date().getFullYear()} MeroDeutsch. Designed for seamless multilingual learning.</p>
          <div className="flex space-x-4 font-medium">
            <Link to="/privacy" className="inline-flex h-9 items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy</Link>
            <Link to="/terms" className="inline-flex h-9 items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms</Link>
            <Link to="/help" className="inline-flex h-9 items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}