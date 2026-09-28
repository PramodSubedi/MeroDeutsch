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
      {/*
        PHONE: A COMPACT LIST, NOT A GRID OF CARDS.

        This grid is 11 tools. As cards on a 380px screen each one measured
        ~230px tall — about 2,500px of scrolling, roughly three screens of
        chrome to reach three screens of content, and the single largest
        contributor to the "box on box on box" texture across the app.

        Below `sm` each tool is therefore one tappable row: icon, name, one line
        of context, chevron. That is ~88px per tool instead of ~230px, it puts
        the title at the top where the eye lands, and it replaces eleven borders
        with the ten hairlines a list actually needs. From `sm` up the card is
        kept exactly as it was — the card grid is correct on a wide screen, and
        this is a phone decision, not a redesign of the catalogue.

        The description is dropped below `sm` rather than clamped: at one line
        it is truncated mid-phrase on every single tool, which is worse than not
        showing it. The full text remains on the tool's own page.
      */}
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {visible.map((tool) => (
          <li key={tool.href} className="min-w-0">
            <Link
              to={tool.href}
              className={`
                group flex min-w-0 items-center gap-3 rounded-md p-3 transition-colors duration-200
                sm:flex-col sm:items-stretch sm:justify-between sm:rounded-lg sm:border sm:border-ink-200 sm:bg-white sm:p-6 sm:shadow-sm
                hover:bg-ink-50 sm:hover:bg-white sm:hover:shadow-md
                dark:hover:bg-ink-800 sm:dark:hover:bg-ink-900
                dark:sm:border-ink-800 dark:sm:bg-ink-900
              `}
            >
              {/* Icon chip. `shrink-0` so a long German tool name can never
                  squeeze it; the chip is the only thing on the row that must
                  never move. */}
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border sm:mb-4 sm:h-12 sm:w-12 sm:rounded-lg ${tool.wellClass}`}
              >
                <tool.icon className={`h-5 w-5 ${tool.iconColor}`} strokeWidth={2} aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                {/* Editorial voice: kicker names the skill, section names the tool. */}
                <p className={`${theme.type.kicker} truncate`}>{practiceSkillLabel(tool.skill, isDE)}</p>
                <h3 className={`${theme.type.section} mt-0.5 truncate sm:mt-1.5`}>{tool.title}</h3>
                <p className="mt-2 hidden text-meta leading-relaxed text-ink-500 sm:block dark:text-ink-400">
                  {tool.description}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-3">
                  <MetaChip>{practiceModeLabel(tool.mode, isDE)}</MetaChip>
                  <MetaChip>
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {isDE ? `${tool.minutes} Min.` : `${tool.minutes} min`}
                  </MetaChip>
                  <MetaChip>{tool.level}</MetaChip>
                </div>
              </div>

              {/* Row affordance. A chevron on the phone (the whole row is the
                  target and this says so); the text CTA from `sm` up, where
                  there is room for it. */}
              <span
                className="shrink-0 self-center text-ink-400 sm:hidden dark:text-ink-500"
                aria-hidden="true"
              >
                ›
              </span>
              <div className="mt-6 hidden items-center justify-between border-t border-ink-100 pt-4 sm:flex dark:border-ink-800/60">
                <span className="inline-flex items-center gap-1 text-meta font-semibold text-accent-600 transition-colors group-hover:text-accent-700 dark:text-accent-400 dark:group-hover:text-accent-300">
                  <span>{tool.buttonText}</span>
                  <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {footerLink && limit && limit < filtered.length && (
        <Link
          to="/practice"
          className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-body font-semibold text-accent-600 transition hover:text-accent-800 active:scale-95 dark:text-accent-300"
        >
          {`See all tools (${filtered.length})`} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
