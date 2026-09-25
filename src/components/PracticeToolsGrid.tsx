import { Link } from 'react-router-dom';
import { getPracticeTools } from '../config/modules';

interface PracticeToolsGridProps {
  /** Show only the first N tools (quick-access mode, e.g. on /learn). */
  limit?: number;
  /** Append a "See all tools" link to /practice (used with limit). */
  footerLink?: boolean;
}

export function PracticeToolsGrid({ limit, footerLink = false }: PracticeToolsGridProps) {
  // The card grid is DERIVED from the module registry (config/modules.ts) so
  // adding a practice tool is one entry there instead of a second hand-kept
  // list that could silently disagree with /practice, the sidebar and the
  // header chip. Card titles come from routeLabels.ts (single label source).
  const tools = getPracticeTools();
  const visible = limit ? tools.slice(0, limit) : tools;
  return (
    <div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
      {visible.map((tool) => (
        <Link
          key={tool.href}
          to={tool.href}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 group-hover:scale-105 transition-transform ${tool.wellClass}`}>
              <tool.icon className={`w-5 h-5 ${tool.iconColor}`} strokeWidth={2} aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{tool.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{tool.description}</p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors inline-flex items-center gap-1">
              <span>{tool.buttonText}</span>
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
    {footerLink && limit && limit < tools.length && (
      <Link
        to="/practice"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-800 active:scale-95 dark:text-blue-300"
      >
        {`See all tools (${tools.length})`} <span aria-hidden="true">→</span>
      </Link>
    )}
    </div>
  );
}
