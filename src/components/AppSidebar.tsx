import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Home,
  LayoutDashboard,
  Library,
  Play,
  Send,
  Settings,
} from 'lucide-react';
import { MODULES } from '../config/modules';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { A1PathProgress } from './path/A1PathProgress';

interface AppSidebarProps {
  /** True when the mobile drawer is open. */
  mobileOpen?: boolean;
  /** Closes the mobile drawer (desktop rail ignores this). */
  onClose?: () => void;
  /** Desktop rail collapsed to an icon-only strip. */
  collapsed?: boolean;
  /** Toggles the desktop collapse. */
  onToggleCollapsed?: () => void;
}

interface NavItem {
  to: string;
  labelEn: string;
  labelDe: string;
  icon: LucideIcon;
  authOnly?: boolean;
  countBadge?: number;
}

const activeClass = (active: boolean) =>
  'flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ' +
  (active
    ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white');

function NavRow({ item, active, isDE, collapsed }: { item: NavItem; active: boolean; isDE: boolean; collapsed?: boolean }) {
  const Icon = item.icon;
  return (
    <Link to={item.to} className={`${activeClass(active)} ${collapsed ? 'justify-center px-0' : ''}`}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{isDE ? item.labelDe : item.labelEn}</span>}
      {item.countBadge != null && item.countBadge > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {item.countBadge}
        </span>
      )}
    </Link>
  );
}

/**
 * Project-wide navigation sidebar.
 * - Desktop: permanent fixed rail (z-30, below header z-50 / toast z-60).
 * - Mobile: rendered as a drawer driven by `mobileOpen`.
 * Nav items derive from the centralized MODULES config (no duplicate data).
 * Dashboard is guest-hidden; a Sign-in link appears for guests.
 * A live due-review badge is shown on the Dashboard item; a compact A1 band
 * strip sits at the bottom for signed-in learners.
 */
export function AppSidebar({ mobileOpen = false, onClose, collapsed = false, onToggleCollapsed }: AppSidebarProps) {
  const { pathname } = useLocation();
  const { langMode } = useLang();
  const { isAuthenticated } = useAuth();
  const { queue } = useReviewQueue();
  const isDE = langMode === 'german';

  const dueCount = queue.filter((item) => !item.dueAt || item.dueAt <= new Date().toISOString()).length;

  const learningItems: NavItem[] = MODULES.filter((m) => m.category === 'learning').map((m) => ({
    to: m.path,
    labelEn: m.label,
    labelDe: m.labelDE,
    icon: m.icon,
  }));

  const practiceItems: NavItem[] = MODULES.filter(
    (m) => m.category === 'practice' && m.showChrome && m.id !== 'practice',
  ).map((m) => ({
    to: m.path,
    labelEn: m.label,
    labelDe: m.labelDE,
    icon: m.icon,
  }));

  const mainItems: NavItem[] = [
    { to: '/', labelEn: 'Home', labelDe: 'Startseite', icon: Home },
    { to: '/learn', labelEn: 'Learn', labelDe: 'Lernen', icon: Play },
    { to: '/dashboard', labelEn: 'Dashboard', labelDe: 'Übersicht', icon: LayoutDashboard, authOnly: true, countBadge: dueCount },
    { to: '/practice', labelEn: 'Practice', labelDe: 'Übung', icon: Library },
  ];

  if (!isAuthenticated) {
    const idx = mainItems.findIndex((i) => i.to === '/dashboard');
    if (idx >= 0) {
      mainItems.splice(idx, 1, { to: '/auth', labelEn: 'Sign in', labelDe: 'Anmelden', icon: Play });
    }
  }

  const supportItems: NavItem[] = [
    { to: '/help', labelEn: 'Help', labelDe: 'Hilfe', icon: BookOpen },
    { to: '/settings', labelEn: 'Settings', labelDe: 'Einstellungen', icon: Settings },
    { to: '/feedback', labelEn: 'Send feedback', labelDe: 'Feedback senden', icon: Send },
  ];

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/');

  const sections: { titleEn: string; titleDe: string; items: NavItem[] }[] = [
    { titleEn: 'Main', titleDe: 'Hauptmenü', items: mainItems },
    { titleEn: 'A1 Lessons', titleDe: 'A1 Lektionen', items: learningItems },
    { titleEn: 'Practice tools', titleDe: 'Übungswerkzeuge', items: practiceItems },
    { titleEn: 'Support', titleDe: 'Unterstützung', items: supportItems },
  ];

  const railContent = (
    <nav className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-4 px-2 text-base font-bold text-slate-900 dark:text-white">
        {collapsed ? 'MD' : 'MeroDeutsch'}
      </div>
      {collapsed !== null && onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={isDE ? 'Seitenleiste umschalten' : 'Toggle sidebar'}
          title={collapsed ? (isDE ? 'Erweitern' : 'Expand') : (isDE ? 'Einklappen' : 'Collapse')}
          className="mb-4 flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {collapsed ? '»' : '«'}
        </button>
      )}
      {sections.map((section) => {
        const visible = section.items.filter((it) => !it.authOnly || isAuthenticated);
        if (visible.length === 0) return null;
        return (
          <div key={section.titleEn} className="mb-4">
            {!collapsed && (
              <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {isDE ? section.titleDe : section.titleEn}
              </div>
            )}
            <div className="space-y-1">
              {visible.map((item) => (
                <NavRow key={item.to} item={item} active={isActive(item.to)} isDE={isDE} collapsed={collapsed} />
              ))}
            </div>
          </div>
        );
      })}
      {isAuthenticated && !collapsed && (
        <div className="mt-auto border-t border-slate-200 pt-3 dark:border-slate-800">
          <A1PathProgress compact />
          <Link
            to="/learn"
            className="mt-2 flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            {isDE ? 'Zum Lernpfad →' : 'Go to path →'}
          </Link>
        </div>
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop: permanent fixed rail (z-30, below header z-50 / toast z-60) */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-950 ${collapsed ? 'w-20' : 'w-64'}`}>
        {railContent}
      </aside>

      {/* Mobile: slide-in drawer (z-40, below header z-50 / toast z-60) */}
      <div
        className={`lg:hidden fixed inset-0 z-40 flex transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex-1" onClick={onClose} aria-label={isDE ? 'Menü schliessen' : 'Close menu'} />
        <aside className="relative h-full w-64 max-w-xs overflow-y-auto border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
          {railContent}
        </aside>
      </div>
    </>
  );
}