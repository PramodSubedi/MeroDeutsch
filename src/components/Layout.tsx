import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { theme } from '../config/theme';
import { getModuleRoutes } from '../config/modules';
import { railSpecFor } from '../config/moduleRail';
import { CONTENT_CLEARANCE_PADDING } from '../config/mobileShell';
import { ContextPanel } from './ContextPanel';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLastModule } from '../hooks/useLastModule';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useAppBadge } from '../hooks/useAppBadge';
import { useXp } from '../hooks/useXp';
import { Footer } from './Footer';
import { ModuleChrome } from './learning/ModuleChrome';
import { BottomNav } from './BottomNav';
import { AppSidebar } from './AppSidebar';
import { Breadcrumb } from './Breadcrumb';
import { LevelUpModal } from './LevelUpModal';
import { useMilestoneToast } from '../hooks/useMilestoneToast';
import { A1PathVisitTracker } from './path/A1PathVisitTracker';
import { ScrollReset } from './ScrollReset';

import { Header } from './layout/Header';
import { OfflineBanner } from './layout/OfflineBanner';
import { LevelUpToast } from './layout/LevelUpToast';
import { UpdateToast } from './layout/UpdateToast';
import { AnnouncementBanner } from './layout/AnnouncementBanner';

/**
 * The AI companion is a SECONDARY surface, but a static import would pull
 * `marked` + `zustand` into the main chunk and charge every visitor ~50 kB for
 * a feature most never open. Lazy + a null fallback keeps it out of the
 * critical path; the launcher simply appears a moment later.
 */
const ChatSidebar = lazy(() =>
  import('./chat/ChatSidebar').then((m) => ({ default: m.ChatSidebar })),
);
import { subscribeDailySessionActive } from '../lib/dailySessionSignal';

/**
 * App shell: context bar + content column.
 *
 * The header is a UTILITY bar, not a second navigation system. Destinations
 * live in the rail (lg+) and the bottom bar (<lg); this header only answers
 * "where am I?" (the context chip) and offers the global utilities. It used to
 * also render a fourth copy of the top-level links for md–lg widths, which is
 * exactly the duplication the nav redesign removes — the bottom bar now
 * extends to `lg` so tablet keeps primary navigation without them.
 */
export function Layout() {
  // `location`, not just `pathname`: the <Outlet /> key below is built from the
  // FULL location so that a query-string change (e.g. /practice?skill=alphabet)
  // is treated as a new screen. See ScrollReset for why that matters.
  const location = useLocation();
  const { pathname } = location;
  const { langMode } = useLang();
  useAuth(); // Initializes auth state; isAuthenticated not needed here
  const { isOnline } = useOnlineStatus();
  const { rememberModule } = useLastModule();
  const { rank, onLevelUp } = useXp();
  // Same source the Practice tab's badge reads, so the home-screen icon can
  // never show a different number than the tab does.
  const { dueQueue } = useReviewQueue();
  useAppBadge(dueQueue.length);
  const [levelUpModalOpen, setLevelUpModalOpen] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const { toast, showToast, dismissToast } = useMilestoneToast();
  const [dailySessionActive, setDailySessionActiveState] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState<number | null>(null);
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);

  // Desktop sidebar collapsed state (persisted per device).
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('meroDeutschSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('meroDeutschSidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const isDE = langMode === 'german';

  // U6: the daily review session runs on Home/Learn — not a "quiz route" by
  // pathname. Subscribe to the module signal so level-ups mid-batch render as
  // non-blocking toasts, never the full-screen modal.
  useEffect(() => subscribeDailySessionActive(setDailySessionActiveState), []);

  // Check if current route is a quiz, blitz, or active training session (Phase D: TTS/Modal safety)
  const isActiveQuizRoute =
    dailySessionActive || // Daily review batch active (U6)
    pathname.includes('/rapid-fire') ||
    pathname.includes('/rapid-blitz') ||
    pathname.startsWith('/checkpoint') || // A1 unit checkpoint = active quiz
    pathname.endsWith('/quiz') ||
    pathname.includes('/dictation') ||
    pathname.includes('/pronunciation') ||
    pathname.includes('/sentence-builder') ||
    // Per-module training/quiz surfaces (C2.7: level-ups here toast, never modal)
    pathname === '/articles' ||
    pathname === '/vocab-trainer' ||
    pathname === '/numbers' ||
    pathname === '/calendar' ||
    pathname === '/alphabet' ||
    pathname === '/greetings' ||
    pathname === '/article-sprint';

  // Global level-up listener — any module that awards XP can trigger the modal.
  useEffect(() => {
    onLevelUp((lvl) => {
      setNewLevel(lvl);
      if (isActiveQuizRoute) {
        // Delay full-screen blocking modal; show non-blocking toast instead (Phase D)
        setPendingLevelUp(lvl);
        showToast({
          message: isDE ? `Level ${lvl} erreicht! ⭐` : `Level ${lvl} reached! ⭐`,
          icon: '⭐',
        });
      } else {
        setLevelUpModalOpen(true);
      }
    });
  }, [onLevelUp, isActiveQuizRoute, isDE, showToast]);

  // Flush pending level-up modal when returning to a non-quiz page (Phase D)
  useEffect(() => {
    if (!isActiveQuizRoute && pendingLevelUp !== null) {
      setNewLevel(pendingLevelUp);
      setLevelUpModalOpen(true);
      setPendingLevelUp(null);
    }
  }, [pathname, isActiveQuizRoute, pendingLevelUp]);

  // Module routes that should show the chrome navigation bar (from registry)
  const moduleRoutes = getModuleRoutes();
  const isModuleRoute = moduleRoutes.includes(pathname);

  // Track last opened module for "Continue learning" on Home.
  useEffect(() => {
    rememberModule(pathname);
  }, [pathname, rememberModule]);

  // ── Shell geometry ──────────────────────────────────────────────────────
  // The fixed rail owns the left edge, so every content-layer sibling
  // (header / offline banner / main / footer) must be pulled in by the SAME
  // inset. This used to be duplicated as a literal `lg:ml-20|lg:ml-64` in four
  // separate places; one constant is the single source of truth now.
  const railInset = sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64';

  // The rail is EXCEPTIONAL: only routes registered in config/moduleRail.ts get
  // one (today: /learn only). Every other route renders the single-column
  // layout, so nothing can accidentally reserve 288px of dead space. The SPEC
  // is the layout switch, never the pathname.
  const railSpec = railSpecFor(pathname);

  return (
    <div className={theme.layout.app}>
      {/* Global level-up celebration — mounted once, fires from any module */}
      <LevelUpModal
        isOpen={levelUpModalOpen}
        level={newLevel}
        rank={rank}
        onClose={() => setLevelUpModalOpen(false)}
      />

      {/* Global non-blocking milestone/level-up toast */}
      {toast && (
        <LevelUpToast
          message={toast.message ?? ''}
          icon={toast.icon ?? '⭐'}
          onDismiss={dismissToast}
        />
      )}

      {/* New-version offer (service worker staged a build). Non-blocking, and
          deliberately separate from the milestone toast above so a deploy and a
          level-up arriving together cannot collide in one slot. */}
      <UpdateToast />

      {/* A1 path visit tracking (lesson-complete rule A) — renders nothing */}
      <A1PathVisitTracker />

      {/* Start each new screen at the top (path changes only, never ?query
          filters) — renders nothing */}
      <ScrollReset />

      {/* Skip to main content link for keyboard navigation */}
      <a href="#main-content" className="skip-to-main">
        {langMode === 'german' ? 'Zum Hauptinhalt springen' : 'Skip to main content'}
      </a>
      <AppSidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />
      {/* Header rides the content column: the fixed rail owns the left shell,
          so the sticky header is pulled in with a MARGIN (lg:ml-*) — left/right
          offsets don't move sticky elements on a vertical-scroll page. */}
      <Header
        railInset={railInset}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      {/* Offline banner — shown when navigator.onLine is false */}
      <OfflineBanner railInset={railInset} isOnline={isOnline} />
      {/* Announcement banner — global messages from admins */}
      <AnnouncementBanner />
      <main
        id="main-content"
        role="main"
        className={`scroll-mt-24 ${CONTENT_CLEARANCE_PADDING} lg:pb-8 ${railInset} ${isModuleRoute ? 'pt-4' : ''}`}
      >
        {/* Page content, shared by both layout branches. Extracted so the rail
            and no-rail branches can never drift apart. */}
        {(() => {
          const page = (
            <>
              {/* Module routes render <ModuleChrome /> (back link + switcher) — the
                  breadcrumb would duplicate that navigation context (UI-clutter fix). */}
              {pathname !== '/auth' && !isModuleRoute && <Breadcrumb />}
              {isModuleRoute && <ModuleChrome />}
              {/* Keyed on the FULL location, not the path. React Router keeps an
                  element's state while the route still matches, so without this a
                  /practice?skill=… change would reuse the previous page AND leave
                  its scroll offset in place. Re-keying makes a query-string change
                  a genuine new screen. ScrollReset deliberately still watches only
                  the path, so the new screen starts at the top. */}
              <Outlet key={location.pathname + location.search} />
            </>
          );
          // Both columns ride the SAME max-w-7xl wrapper so the rail sits on
          // the page's right edge instead of floating in the gutter. Below xl
          // the rail is `hidden` and the content column goes full width again.
          return railSpec ? (
            <div className={`${theme.layout.main} flex gap-8`}>
              <div className="min-w-0 flex-1">{page}</div>
              <ContextPanel spec={railSpec} />
            </div>
          ) : (
            <div className={theme.layout.main}>{page}</div>
          );
        })()}
      </main>
      {/* Footer rides the content column with the header + main (ml inset) */}
      <Footer className={railInset} />
      <BottomNav />

      {/* AI learning companion ("Mero"). Renders nothing outside
          learn/practice/checkpoint routes, and starts COLLAPSED so it never
          interrupts an active quiz (see ChatSidebar's own route guard). */}
      <Suspense fallback={null}>
        <ChatSidebar />
      </Suspense>
    </div>
  );
}