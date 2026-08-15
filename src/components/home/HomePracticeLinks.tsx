import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';

/**
 * Compact practice tools row for the Home page.
 * Deliberately NOT the full 6‑card PracticeToolsGrid — that lives on /learn#practice.
 * Home shows a slim summary chip + "All tools on Learn →" so resume/status stays the focus.
 */
export function HomePracticeLinks() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-slate-900 dark:text-white">
        {isDE ? 'Übungs-Tools' : 'Practice tools'}
      </span>
      <Link
        to="/learn#practice"
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-400 dark:hover:border-blue-500"
      >
        <span aria-hidden="true">🎯</span>
        <span>{isDE ? 'Alle Tools auf Learn' : 'All tools on Learn'}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}