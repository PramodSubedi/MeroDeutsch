import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Target, LayoutDashboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';

/**
 * Mobile-first bottom navigation bar.
 * Displays on mobile screens (< 768px) with large touch targets (min 44px).
 * Hidden on desktop where top navigation is used.
 * Uses Lucide SVG icons to match the global theme pattern (no emojis).
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const isWithin = (routes: string[]) => routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  // Mobile bottom nav — keep ≤5 tabs so every item is fully visible at 360px.
  // Analytics + Import live in the UserMenu dropdown (desktop header) only.
  const navItems: Array<{ to: string; icon: LucideIcon; label: string; active: boolean }> = [
    {
      to: '/home',
      icon: Home,
      label: isDE ? 'Start' : 'Home',
      active: pathname === '/home' || pathname === '/',
    },
    {
      // Path is sign-in-gated: guests' Learn tab leads to the module grid on /home.
      to: user ? '/learn' : '/home',
      icon: BookOpen,
      label: isDE ? 'Lernen' : 'Learn',
      active: isWithin(['/learn', '/checkpoint', '/alphabet', '/numbers', '/calendar', '/articles', '/greetings', '/stories']),
    },
    {
      to: '/practice',
      icon: Target,
      label: isDE ? 'Üben' : 'Practice',
      active: isWithin([
        '/practice', '/glossary', '/vocab-trainer', '/dictation', '/grammar',
        '/pronunciation', '/roleplay', '/rapid-fire', '/rapid-blitz',
        '/sentence-builder', '/games', '/email-builder', '/article-sprint',
      ]),
    },
    ...(user
      ? [
          {
            to: '/dashboard',
            icon: LayoutDashboard,
            label: isDE ? 'Übersicht' : 'Dashboard',
            active: pathname.startsWith('/dashboard'),
          },
        ]
      : []),
  ];

  return (
    <nav aria-label={isDE ? 'Hauptnavigation' : 'Main navigation'} className="fixed bottom-0 left-0 right-0 z-50 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:hidden dark:bg-slate-900">
      <div className="flex items-center justify-around">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={`${index}:${item.to}`}
              to={item.to}
              aria-current={item.active ? 'location' : undefined}
              className={`flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 transition-colors ${
                item.active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400'
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
