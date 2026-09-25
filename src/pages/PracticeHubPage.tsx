import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { PageHeading } from '../components/common/PageHeading';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { PRACTICE_SKILLS, PRACTICE_QUICK_WIN_MINUTES, getPracticeTools } from '../config/modules';
import type { PracticeSkill } from '../config/modules';
import { theme } from '../config/theme';

type SkillFilter = PracticeSkill | 'all';

/**
 * Practice Hub — the browse surface for every quick-access practice tool.
 *
 * This page is one of the four top-level destinations, so it owns the detailed
 * tool navigation that the rail and bottom bar deliberately do NOT carry
 * (those are four quiet destinations, not a catalog). The grid below is derived
 * from the module registry, so adding a tool is one entry in config/modules.ts.
 *
 * THE FILTER IS WHY METADATA EXISTS. Eleven undifferentiated cards make the
 * learner read every blurb to choose. Two questions actually decide the choice:
 * "what do I want to work on?" (skill) and "how long have I got?" (quick win).
 * Those are the only two filter dimensions exposed — a full taxonomy would turn
 * a scannable list back into the catalog it was meant to replace.
 *
 * v0.2.4 note: the Article Sprint (der/die/das) drill used to be an INLINE
 * section at the bottom of this page, which is why it "loaded directly unlike
 * other tools". It now lives at /article-sprint (its own route + grid card),
 * so this page is just the centralized tool grid. No article logic here.
 */
export function PracticeHubPage() {
  usePageTitle('Practice');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Local component state, not a URL param and not persisted: a filter is a
  // momentary intention, not something to restore on the next visit.
  const [skill, setSkill] = useState<SkillFilter>('all');
  const [quickOnly, setQuickOnly] = useState(false);

  const maxMinutes = quickOnly ? PRACTICE_QUICK_WIN_MINUTES : undefined;
  const filteredCount = getPracticeTools().filter(
    (t) => (skill === 'all' || t.skill === skill) && (maxMinutes === undefined || t.minutes <= maxMinutes)
  ).length;
  const isFiltered = skill !== 'all' || quickOnly;

  return (
    <div className={theme.page.container}>
      <PageHeading
        title={isDE ? 'Üben' : 'Practice'}
        subtitle={
          isDE
            ? 'Wähle eine Fähigkeit — oder blätter alle Werkzeuge durch.'
            : 'Pick a skill — or browse everything.'
        }
      />

      {/* Filter row: segmented single-select skill + an OR-on-time toggle.
          36px targets inside a 44px-tall hit area, wrapping on narrow screens. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={isDE ? 'Nach Fähigkeit filtern' : 'Filter by skill'}
          className="inline-flex flex-wrap items-center gap-1 rounded-md bg-ink-100 p-1 dark:bg-ink-800"
        >
          {PRACTICE_SKILLS.map((option) => {
            const active = skill === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSkill(option.id)}
                aria-pressed={active}
                className={`inline-flex min-h-11 items-center rounded-sm px-3 py-1.5 text-meta font-semibold transition focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 sm:min-h-[36px] sm:px-2.5 ${
                  active
                    ? 'bg-white text-accent-700 shadow-sm dark:bg-ink-700 dark:text-accent-300'
                    : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100'
                }`}
              >
                {isDE ? option.de : option.en}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setQuickOnly((v) => !v)}
          aria-pressed={quickOnly}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1.5 text-meta font-semibold transition focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 sm:min-h-[36px] sm:px-2.5 ${
            quickOnly
              ? 'border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-300'
              : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800'
          }`}
        >
          <span aria-hidden="true">⏱</span>
          {isDE ? `Unter ${PRACTICE_QUICK_WIN_MINUTES} Min.` : `Under ${PRACTICE_QUICK_WIN_MINUTES} min`}
        </button>

        {/* Result count is a live region so a filter that narrows (or empties)
            the grid is announced, not just re-drawn. */}
        <span aria-live="polite" className="text-meta text-ink-500 dark:text-ink-400">
          {filteredCount} {isDE ? 'Werkzeuge' : filteredCount === 1 ? 'tool' : 'tools'}
        </span>
      </div>

      {isFiltered && filteredCount === 0 ? (
        <div className="rounded-lg border border-ink-200 bg-white p-8 text-center dark:border-ink-800 dark:bg-ink-900">
          <p className="text-body text-ink-600 dark:text-ink-300">
            {isDE ? 'Keine Werkzeuge für diese Auswahl.' : 'No tools match this combination.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSkill('all');
              setQuickOnly(false);
            }}
            className={`${theme.button.secondary} mt-4`}
          >
            {isDE ? 'Filter zurücksetzen' : 'Reset filters'}
          </button>
        </div>
      ) : (
        <PracticeToolsGrid skill={skill === 'all' ? undefined : skill} maxMinutes={maxMinutes} />
      )}

      {/* The Learn/Practice boundary, made explicit: lessons live in Learn, so
          a learner who followed a tool link knows where the course is. */}
      <Link
        to="/learn"
        className="mt-8 inline-flex min-h-[44px] items-center gap-2 border-t border-ink-200 pt-6 text-body font-semibold text-accent-600 transition hover:text-accent-800 active:scale-95 dark:border-ink-800 dark:text-accent-300 dark:hover:text-accent-200"
      >
        <span>{isDE ? 'Lektionen findest du im Lernpfad' : 'Looking for lessons? Open the learning path'}</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}