import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';

/**
 * Mobile-first bottom navigation bar.
 * Displays on mobile screens (< 768px) with large touch targets (min 44px).
 * Hidden on desktop where top navigation is used.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const navItems = [
    {
      to: '/',
      icon: '🏠',
      label: isDE ? 'Start' : 'Home',
      active: pathname === '/',
    },
    {
      to: '/learn',
      icon: '📚',
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
      icon: '🎯',
      label: isDE ? 'Üben' : 'Practice',
      active: pathname.startsWith('/practice') ||
              pathname.startsWith('/glossary') ||
              pathname.startsWith('/dictation') ||
              pathname.startsWith('/grammar') ||
              pathname.startsWith('/pronunciation') ||
              pathname.startsWith('/roleplay'),
    },
    {
      to: '/analytics',
      icon: '📊',
      label: isDE ? 'Analytik' : 'Analytics',
      active: pathname.startsWith('/analytics'),
    },
    {
      to: '/import',
      icon: '📥',
      label: isDE ? 'Import' : 'Import',
      active: pathname.startsWith('/import'),
    },
    {
      to: user ? '/dashboard' : '/auth',
      icon: user ? '📊' : '👤',
      label: user ? (isDE ? 'Dashboard' : 'Dashboard') : (isDE ? 'Anmelden' : 'Sign in'),
      active: user ? pathname.startsWith('/dashboard') : pathname.startsWith('/auth'),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-lg md:hidden dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 transition-colors ${
              item.active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400'
            }`}
          >
            <span className="text-2xl" aria-hidden="true">
              {item.icon}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}