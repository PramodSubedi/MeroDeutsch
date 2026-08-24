/**
 * Roleplay — branching dialogue practice rendered as a simulated messaging
 * app via the `MessagingRoleplay` Lesson Engine primitive.
 *
 * v0.2.4 slice: replaced the former inline step-player with MessagingRoleplay
 * (same curriculumService.getRoleplayScenarios() data source; same shared SRS/
 * XP reporting inside the primitive — plus typing indicators, retry-on-wrong,
 * and per-scenario progress chips). No route or dataset changes.
 */
import { useEffect, useState } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { MessagingRoleplay } from '../components/exercises/MessagingRoleplay';
import type { RoleplayScenario } from '../types/curriculum';

export function RoleplayPage() {
  usePageTitle('Roleplay');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // null = loading, [] = loaded but empty (offline first run)
  const [scenarios, setScenarios] = useState<RoleplayScenario[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getRoleplayScenarios()
      .then((s) => { if (!cancelled) setScenarios(s); })
      .catch(() => { if (!cancelled) setScenarios([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {isDE ? 'Rollenspiele' : 'Role-play'}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDE ? 'Übe Alltagsgespräche auf Deutsch.' : 'Practice everyday German conversations.'}
      </p>

      {scenarios === null ? (
        <div className="mt-4 text-sm text-slate-500">Loading…</div>
      ) : scenarios.length === 0 ? (
        <div className={`${theme.panel.muted} mt-4 text-sm`}>
          {isDE
            ? 'Noch keine Szenarien verfügbar — bitte später erneut versuchen.'
            : 'No scenarios available yet — please try again later.'}
        </div>
      ) : (
        <div className="mx-auto mt-4 max-w-xl">
          <MessagingRoleplay scenarios={scenarios} module="roleplay" />
        </div>
      )}
    </div>
  );
}
