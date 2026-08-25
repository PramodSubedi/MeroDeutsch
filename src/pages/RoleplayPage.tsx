/**
 * Roleplay — branching dialogue practice rendered as a simulated messaging
 * app via the `MessagingRoleplay` Lesson Engine primitive.
 *
 * v0.2.4 slice: replaced the former inline step-player with MessagingRoleplay
 * (same curriculumService.getRoleplayScenarios() data source; same shared SRS/
 * XP reporting inside the primitive — plus typing indicators, retry-on-wrong,
 * and per-scenario progress chips). No route or dataset changes.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { MessagingRoleplay } from '../components/exercises/MessagingRoleplay';
import { buildConversationalScenarios } from '../utils/conversationalToRoleplay';
import type { RoleplayScenario } from '../types/curriculum';

export function RoleplayPage() {
  usePageTitle('Roleplay');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // null = loading, [] = loaded but empty (offline first run)
  const [scenarios, setScenarios] = useState<RoleplayScenario[] | null>(null);
  // Locally composed conversations (from the bundled conversational vocab bank).
  const [localScenarios, setLocalScenarios] = useState<RoleplayScenario[]>([]);
  // Incremented by the shuffle button → re-picks one variant per scenario.
  const [round, setRound] = useState(0);
  // CEFR filter: 'all' | 'A1' | 'A2' | 'B1'.
  const [levelFilter, setLevelFilter] = useState<'all' | 'A1' | 'A2' | 'B1'>('all');

  /** Shuffle synchronously so the new key + new data land in ONE commit. */
  const reshuffle = () => {
    setLocalScenarios(buildConversationalScenarios());
    setRound((r) => r + 1);
  };

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getRoleplayScenarios()
      .then((s) => { if (!cancelled) setScenarios(s); })
      .catch(() => { if (!cancelled) setScenarios([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setLocalScenarios(buildConversationalScenarios());
  }, [round]);

  // Local conversations FIRST so async DB results never shift their indices.
  // DB scenarios whose title is already covered by a local conversation are
  // superseded (the local variants are strictly richer), so learners don't see
  // duplicate chips for the same context.
  const allScenarios = useMemo(() => {
    const localTitles = new Set(localScenarios.map((s) => s.title));
    const db = (scenarios ?? []).filter((s) => !localTitles.has(s.title));
    return [...localScenarios, ...db];
  }, [scenarios, localScenarios]);

  // CEFR filter chips derive from the levels actually present.
  const availableLevels = useMemo(() => {
    const s = new Set<'A1' | 'A2' | 'B1'>();
    allScenarios.forEach((sc) => {
      const b = (sc.level ?? '').toUpperCase();
      if (/A1/.test(b)) s.add('A1');
      if (/A2/.test(b)) s.add('A2');
      if (/B1/.test(b)) s.add('B1');
    });
    return [...s];
  }, [allScenarios]);

  const filtered = useMemo(() => {
    if (levelFilter === 'all') return allScenarios;
    return allScenarios.filter((sc) => (sc.level ?? '').toUpperCase().includes(levelFilter));
  }, [allScenarios, levelFilter]);

  /** Determine a clean "A1 / A2 / B1" label from a band string. */
  const levelLabel = (band?: string) => (band ?? '').trim() || 'A1';

  const levelBadgeClass = (band?: string) => {
    const b = (band ?? '').toUpperCase();
    if (/B1/.test(b)) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    if (/B2/.test(b)) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  };

  return (
    <div className={theme.page.container}>
      {/* Eyebrow + title */}
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
        {isDE ? 'Sprechen üben' : 'Speaking practice'}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {isDE ? 'Rollenspiele' : 'Role-play'}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDE
          ? 'Übe Alltagsgespräche auf Deutsch – tippe oder sprich deine Antworten.'
          : 'Practice everyday German conversations — type or speak your answers.'}
      </p>

      {allScenarios.length === 0 ? (
        scenarios === null ? (
          <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {isDE ? 'Gespräche werden geladen…' : 'Loading conversations…'}
          </div>
        ) : (
          <div className={`${theme.panel.muted} mt-6 text-sm`}>
            {isDE
              ? 'Noch keine Szenarien verfügbar — verbinde dich einmal mit dem Internet.'
              : 'No conversations available yet — go online once to load them.'}
          </div>
        )
      ) : (
        <div className="mt-6">
          {/* CEFR filter pills */}
          {availableLevels.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(['all', ...availableLevels] as const).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevelFilter(lv)}
                  aria-pressed={levelFilter === lv}
                  className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
                    levelFilter === lv
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {lv === 'all' ? (isDE ? 'Alle' : 'All') : lv}
                </button>
              ))}
            </div>
          )}

          {/* Scenario picker — cards with emoji, title, level badge */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={reshuffle}
                className="group flex min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-blue-950/30"
              >
                <span className="text-2xl" aria-hidden="true">{sc.emoji || '💬'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 dark:text-white">
                    {sc.title}
                  </span>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${levelBadgeClass(sc.level)}`}>
                    {levelLabel(sc.level)}
                  </span>
                </span>
                <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600">
                  →
                </span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className={`${theme.panel.muted} mb-4 text-sm`}>
              {isDE
                ? 'Für diese Stufe gibt es noch keine Gespräche.'
                : 'No conversations at this level yet.'}
            </div>
          ) : (
            <div className="mx-auto max-w-xl">
              {/* Shuffle: re-picks one random dialogue variant per scenario. */}
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={reshuffle}
                  className={`${theme.button.secondary} min-h-[44px] active:scale-95`}
                >
                  {isDE ? 'Neues Gespräch 🔄' : 'Next conversation 🔄'}
                </button>
              </div>
              <MessagingRoleplay key={round} scenarios={filtered} module="roleplay" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
