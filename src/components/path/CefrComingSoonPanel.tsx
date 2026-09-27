/**
 * src/components/path/CefrComingSoonPanel.tsx
 *
 * What /learn shows when the URL selects a level that has no curriculum yet
 * (A2, B1).
 *
 * THE RULE THIS PANEL FOLLOWS: SAY WHAT IS TRUE, THEN OFFER A WAY FORWARD
 *   A "coming soon" screen earns its place only if it does three things:
 *   states plainly that the level is not built (no fake progress, no
 *   placeholder modules, no countdown to a date nobody has committed to),
 *   says WHAT will be in it so the wait feels like progress rather than a
 *   locked door, and hands back a real destination. That destination is A1 —
 *   which is fully built today — plus /feedback, because the only honest
 *   input to a roadmap is the learner's own priorities.
 *
 * WHY NO "NOTIFY ME" BUTTON
 *   There is no mailing list and no notification service in this codebase. A
 *   button that pretends to subscribe is worse than no button, so the two
 *   actions here are two real routes: learn A1 now, or tell us what you want
 *   in A2. This mirrors UpgradeToSpine, which makes the same refusal for the
 *   same reason (no billing provider is wired up).
 *
 * Copy is EN/DE paired from data/cefrLevels.ts, so this component holds no
 * level-specific text of its own and adding a level needs no edit here.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import {
  COMING_SOON_LABEL,
  DEFAULT_CEFR_LEVEL_ID,
  cefrLevelHref,
  getCefrLevel,
  type CefrLevelId,
} from '../../data/cefrLevels';
import { theme } from '../../config/theme';
import type { CefrLevel } from '../../data/cefrLevels';

interface CefrComingSoonPanelProps {
  level: CefrLevel;
}

export function CefrComingSoonPanel({ level }: CefrComingSoonPanelProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // The level to send someone back to. Derived from the registry rather than
  // hardcoded as the string 'a1', so promoting a different level to default
  // later moves this link with it.
  const fallbackId: CefrLevelId = DEFAULT_CEFR_LEVEL_ID;
  const fallback = getCefrLevel(fallbackId);

  return (
    <section
      aria-labelledby="cefr-coming-soon-heading"
      data-level={level.id}
      className="rounded-lg border border-dashed border-ink-300 bg-white p-6 sm:p-8 dark:border-ink-700 dark:bg-ink-900"
    >
      <p className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
        {level.code} · {isDE ? COMING_SOON_LABEL.de : COMING_SOON_LABEL.en}
      </p>
      <h2
        id="cefr-coming-soon-heading"
        className={`${theme.type.title} mt-2`}
      >
        {isDE
          ? `${level.code} wird gerade gebaut`
          : `${level.code} is being built right now`}
      </h2>
      <p className="mt-2 max-w-prose text-body text-ink-600 dark:text-ink-300">
        {isDE ? level.description.de : level.description.en}
      </p>

      {level.planned.length > 0 && (
        <>
          <h3 className="mt-6 text-meta font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {isDE ? 'Geplant' : 'What will be in it'}
          </h3>
          <ul className="mt-2 max-w-prose space-y-1.5">
            {level.planned.map((item, i) => (
              <li
                key={i}
                className="flex gap-2 text-body text-ink-600 dark:text-ink-300"
              >
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400 dark:bg-ink-500" />
                <span>{isDE ? item.de : item.en}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Two real destinations, no third "subscribe" fantasy. */}
      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          to={cefrLevelHref(fallbackId)}
          className={`${theme.button.primary} inline-flex min-h-[44px] items-center gap-2`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {isDE ? `Starte mit ${fallback.code}` : `Start with ${fallback.code}`}
        </Link>
        <Link
          to="/feedback"
          className={`${theme.button.secondary} inline-flex min-h-[44px] items-center gap-2`}
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {isDE
            ? `Was soll ${level.code} zuerst können?`
            : `What should ${level.code} cover first?`}
        </Link>
      </div>
      <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">
        {isDE
          ? `${fallback.code} ist komplett verfügbar — der gesamte Kurs steht dir jetzt offen.`
          : `${fallback.code} is fully available — the whole course is open to you today.`}
      </p>
    </section>
  );
}