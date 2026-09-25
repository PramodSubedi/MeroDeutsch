import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';
import type { AuthUser } from '../types';

interface UserMenuProps {
  user: AuthUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsSigningOut(false);
      setIsOpen(false);
    }
  };

  // Null-safe display name + initials: username → single-letter fallback.
  // Never crash on a missing/partial profile from the auth provider.
  const displayName = user.username ?? '';
  const initials =
    displayName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 items-center gap-2 rounded-full px-2 text-body text-ink-600 transition hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none dark:text-ink-300 dark:hover:bg-ink-800"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-7 h-7 rounded-full bg-ink-200 dark:bg-ink-700"
          />
        ) : (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-ink-200 text-ink-700 font-medium text-body dark:bg-ink-700 dark:text-ink-200">
            {initials}
          </div>
        )}
        <span className="hidden sm:block font-medium">{displayName}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 dark:bg-ink-800 dark:ring-white/10">
          <div className="px-4 py-3">
            <p className="text-body font-medium text-ink-900 dark:text-white">{displayName}</p>
            <p className="text-meta text-ink-500 dark:text-ink-400 truncate">{isDE ? 'Angemeldet' : 'Signed in'}</p>
          </div>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-body text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2v4a2 2 0 002 2h7v2a2 2 0 002-2v-4a2 2 0 00-2-2h-7V7a2 2 0 00-2 2v4z" />
            </svg>
            <span>{isDE ? 'Übersicht' : 'Dashboard'}</span>
          </Link>
          <Link
            to="/analytics"
            className="flex items-center gap-2 px-4 py-2 text-body text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-4 0h.01M9 7h6a2 2 0 012 2v5a2 2 0 01-2 2h-6a2 2 0 01-2-2V9a2 2 0 012-2z" />
            </svg>
            <span>{isDE ? 'Lernanalytik' : 'Analytics'}</span>
          </Link>
          <Link
            to="/import"
            className="flex items-center gap-2 px-4 py-2 text-body text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V8m0 0l4 4m-4-4l4-4M7 16h10a2 2 0 012 2v2" />
            </svg>
            <span>{isDE ? 'Importieren' : 'Import'}</span>
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-2 px-4 py-2 text-body text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{isDE ? 'Einstellungen' : 'Settings'}</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 px-4 py-2 text-body text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {isSigningOut ? (isDE ? 'Abmelden…' : 'Signing out…') : isDE ? 'Abmelden' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
