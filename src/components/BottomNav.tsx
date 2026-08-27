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

  // Mobile bottom nav — keep ≤5 tabs so every item is fully visible at 360px.
  // Analytics + Import live in the UserMenu dropdown (desktop header) only.
  const navItems: Array<{ to: string; icon: LucideIcon; label: string; active: boolean }> = [
    {
      to: '/',
      icon: Home,
      label: isDE ? 'Start' : 'Home',
      active: pathname === '/',
    },
    {
      to: '/learn',
      icon: BookOpen,
      label: isDE ? 'Lernen' : 'Learn',
      active: pathname.startsWith('/learn') || 
              pathname.startsWith('/alphabet') || 
              pathname.startsWith('/numbers') ||
              pathname.startsWith('/calendar') ||
              pathname.startsWith('/articles') ||
              pathname.startsWith('/greetings') ||
              pathname.startsWith('/stories'),
    },
    {
      to: '/practice',
      icon: Target,
      label: isDE ? 'Üben' : 'Practice',
      active: pathname.startsWith('/practice') ||
              pathname.startsWith('/glossary') ||
              pathname.startsWith('/dictation') ||
              pathname.startsWith('/grammar') ||
              pathname.startsWith('/pronunciation') ||
              pathname.startsWith('/roleplay') ||
              pathname.startsWith('/rapid-fire'),
    },
    ...(user
      ? [
          {
            to: '/dashboard',
            icon: LayoutDashboard,
            label: 'Dashboard',
            active: pathname.startsWith('/dashboard'),
          },
        ]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 md:hidden dark:border-slate-800/70 dark:bg-slate-950/85 dark:supports-[backdrop-filter]:bg-slate-950/70">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 transition-colors ${
                item.active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400'
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  item.active ? 'bg-blue-50 dark:bg-blue-950/50' : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={item.active ? 2.4 : 2} aria-hidden="true" />
              </span>
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
