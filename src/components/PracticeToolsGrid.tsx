import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { getPracticeTools, practiceModeLabel, practiceSkillLabel } from '../config/modules';
import type { PracticeSkill, PracticeTool } from '../config/modules';
import { useLang } from '../hooks/useLang';
import { theme } from '../config/theme';

interface PracticeToolsGridProps {
  /** Show only the first N tools (quick-access mode, e.g. on /learn). */
  limit?: number;
  /** Append a "See all tools" link to /practice (used with limit). */
  footerLink?: boolean;
  /**
   * Restrict to one skill. `undefined` = show everything, which is the default
   * everywhere outside /practice's filter row. A prop rather than context, so
   * the compact /learn row can never inherit a filter set on /practice.
   */
  skill?: PracticeSkill;
  /** Only sessions at or under this many minutes (the "quick win" filter). */
  maxMinutes?: number;
}

/**
 * One metadata chip. Deliberately MUTED — these are wayfinding for a catalogue,
 * not achievement badges, so they never compete with the card title.
 */
function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-ink-100 px-1.5 py-0.5 text-micro font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
      {children}
    </span>
  );
}

export function PracticeToolsGrid({ limit, footerLink = false, skill, maxMinutes }: PracticeToolsGridProps) {
  // The card grid is DERIVED from the module registry (config/modules.ts) so
  // adding a practice tool is one entry there instead of a second hand-kept
  // list that could silently disagree with /practice, the sidebar and the
  // header chip. Card titles come from routeLabels.ts (single label source).
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const tools = getPracticeTools();
  const filtered: PracticeTool[] = tools.filter(
    (tool) => (!skill || tool.skill === skill) && (maxMinutes === undefined || tool.minutes <= maxMinutes)
  );
  // `limit` applies AFTER filtering, so "first 4 quick drills" still returns
  // 4 cards instead of silently emptying the row.
  const visible = limit ? filtered.slice(0, limit) : filtered;
  if (visible.length === 0) return null;
  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tool) => (
          <Link
            key={tool.href}
            to={tool.href}
            className="group flex cursor-pointer flex-col justify-between rounded-lg border border-ink-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md dark:border-ink-800 dark:bg-ink-900"
          >
            <div>
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg border transition-transform group-hover:scale-105 ${tool.wellClass}`}>
                <tool.icon className={`h-5 w-5 ${tool.iconColor}`} strokeWidth={2} aria-hidden="true" />
              </div>
              {/* Editorial voice: kicker names the skill, display names the tool. */}
              <p className={theme.type.kicker}>{practiceSkillLabel(tool.skill, isDE)}</p>
              <h3 className={`${theme.type.section} mt-1.5`}>{tool.title}</h3>
              <p className="mt-2 text-meta leading-relaxed text-ink-500 dark:text-ink-400">{tool.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <MetaChip>{practiceModeLabel(tool.mode, isDE)}</MetaChip>
                <MetaChip>
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {isDE ? `${tool.minutes} Min.` : `${tool.minutes} min`}
                </MetaChip>
                <MetaChip>{tool.level}</MetaChip>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4 dark:border-ink-800/60">
              <span className="inline-flex items-center gap-1 text-meta font-semibold text-accent-600 transition-colors group-hover:text-accent-700 dark:text-accent-400 dark:group-hover:text-accent-300">
                <span>{tool.buttonText}</span>
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
      {footerLink && limit && limit < filtered.length && (
        <Link
          to="/practice"
          className="inline-flex min-h-[44px] items-center gap-1 text-body font-semibold text-accent-600 transition hover:text-accent-800 active:scale-95 dark:text-accent-300"
        >
          {`See all tools (${filtered.length})`} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
