import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 mt-24 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-8 shadow-xs">
          
          {/* Brand Column */}
          <div className="space-y-3 md:col-span-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Mero Deutsch 
              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-0.5 rounded-full font-semibold">
                A1 Core
              </span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
              Tailored German language training for Nepali and English speakers, featuring interactive speech recognition and smart daily challenges.
            </p>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
              Explore
            </h4>
            <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400 font-medium">
              <li><Link to="/" className="inline-flex min-h-[44px] items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none focus-visible:ring-offset-2 rounded">Dashboard</Link></li>
              <li><Link to="/alphabet" className="inline-flex min-h-[44px] items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none focus-visible:ring-offset-2 rounded">Alphabet & Sounds</Link></li>
              <li><Link to="/articles" className="inline-flex min-h-[44px] items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none focus-visible:ring-offset-2 rounded">Article Trainer</Link></li>
              <li><Link to="/glossary" className="inline-flex min-h-[44px] items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none focus-visible:ring-offset-2 rounded">Glossary & Words</Link></li>
            </ul>
          </div>

          {/* System status */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
              System
            </h4>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p className="text-xs text-slate-600 dark:text-slate-400">Production v1.2.0</p>
            </div>
          </div>

        </div>

        {/* Bottom copyright row */}
        <div className="mt-8 pt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-400 px-2">
          <p>© {new Date().getFullYear()} MeroDeutsch. Designed for seamless multilingual learning.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0 font-medium">
            <span className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">Support</span>
          </div>
        </div>
      </div>
    </footer>
  );
}