import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Volume2, VolumeX } from 'lucide-react';
import { theme } from '../../config/theme';
import { navSectionFor } from '../../config/navigation';
import { contextLabelFor } from '../../config/routeLabels';
import { useLang } from '../../hooks/useLang';
import { useAuth } from '../../hooks/useAuth';
import { isAudioEnabled, setAudioEnabled } from '../../utils/audioService';
import { Logo } from '../common/Logo';
import { ThemeToggle } from '../common/ThemeToggle';
import { UserMenu } from '../UserMenu';
import { LanguageToggle } from '../LanguageToggle';

interface HeaderProps {
  /** The fixed rail owns the left shell, so the sticky header is pulled in with a MARGIN. */
  railInset: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

/**
 * Sticky header — utility bar only (context chip + global utilities).
 * Destinations live in the rail (lg+) and bottom bar (<lg).
 */
export function Header({
  railInset,
  sidebarOpen,
  setSidebarOpen,
}: HeaderProps) {
  const { pathname } = useLocation();
  const { langMode } = useLang();
  const { user, isAuthenticated } = useAuth();
  const isDE = langMode === 'german';
  const [audioEnabled, setAudioEnabledState] = useState(isAudioEnabled);

  // "Where am I?" comes from the nav table so the header chip and rail/bottom-bar active rows can never disagree.
  const { label: contextGroup, icon: ContextIcon } = navSectionFor(pathname, isAuthenticated, isDE);
  const contextPage = contextLabelFor(pathname, isDE);

  return (
    <header className={`${theme.layout.header} ${railInset}`} role="banner">
      <div className={theme.layout.headerInner}>
        {/* Desktop context chip (lg+): the rail owns top-level nav AND its expand/collapse control. */}
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300">
            <ContextIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className={`${theme.type.kicker} block`}>{contextGroup}</span>
            <span className={`${theme.type.section} block truncate`}>{contextPage}</span>
          </span>
        </div>

        {/* Brand — header keeps the logo below lg (mobile/tablet); on lg+ the rail owns the brand band. */}
        <Link
          to="/home"
          aria-label={isDE ? 'MeroDeutsch – Startseite' : 'MeroDeutsch – Home'}
          className="inline-flex h-11 w-11 items-center transition duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none focus-visible:ring-offset-2 rounded-sm lg:hidden"
        >
          <Logo size="sm" variant="navbar" showText={false} />
        </Link>

        {/* Section context — shown on every width, right-aligned next to the
            utilities. `min-w-0` is what lets this truncate instead of pushing
            the utility cluster off the bar at 320px. */}
        <div className="min-w-0 flex-1 lg:hidden">
          <span className="block truncate text-meta font-bold text-ink-600 dark:text-ink-300">{contextGroup}</span>
        </div>

        {/* Global utilities — every breakpoint: menu (mobile/tablet) + language + theme + audio + user.
            `gap-1.5` below sm: the cluster is four 44px controls plus the account
            menu, and at 380px every 2px of gap is a pixel the section label cannot
            use. The `sm:gap-2` keeps the roomier rhythm once there is room for it. */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={`${theme.layout.themeButton} lg:hidden`}
            aria-expanded={sidebarOpen}
            aria-controls="mobile-site-navigation"
            aria-label={isDE ? 'Menü öffnen' : 'Open menu'}
          >
            <Menu className="h-5 w-5" />
          </button>
          <LanguageToggle />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              const next = !audioEnabled;
              setAudioEnabled(next);
              setAudioEnabledState(next);
            }}
            className={theme.layout.themeButton}
            aria-label={audioEnabled ? (isDE ? 'Ton ausschalten' : 'Mute audio') : (isDE ? 'Ton einschalten' : 'Unmute audio')}
          >
            {audioEnabled ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
          </button>
          {user && <UserMenu user={user} />}
        </div>
      </div>
    </header>
  );
}