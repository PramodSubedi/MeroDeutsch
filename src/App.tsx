import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SkeletonLoader } from './components/SkeletonLoader';
import { useDexieInit } from './hooks/useDexieInit';
import { useSyncBridge } from './hooks/useSyncBridge';
import { useAuth } from './hooks/useAuth';
import { LearningContextProvider } from './context/LearningContext';
import { useAdminModeBootstrap } from './hooks/useAdminModeBootstrap';
import { useQaBridge } from './hooks/useQaBridge';
import { useCurriculumSource } from './hooks/useCurriculumSource';
import { DebugModeBanner } from './components/debug/DebugModeBanner';

// Core pages - eagerly loaded for instant navigation
import { AuthPage } from './pages/AuthPage';
import { AlphabetPage } from './pages/AlphabetPage';
import { NumbersPage } from './pages/NumbersPage';
import { CalendarPage } from './pages/CalendarPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { GreetingsPage } from './pages/GreetingsPage';
import { AppHomeSwitch } from './pages/AppHomeSwitch';
import { LandingPage } from './pages/LandingPage';

// Secondary pages - lazy loaded to reduce initial bundle size
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GlossaryPage = lazy(() => import('./pages/GlossaryPage').then(m => ({ default: m.GlossaryPage })));
const VocabTrainerPage = lazy(() => import('./pages/VocabTrainerPage').then(m => ({ default: m.VocabTrainerPage })));
const DictationPage = lazy(() => import('./pages/DictationPage').then(m => ({ default: m.DictationPage })));
const GrammarPage = lazy(() => import('./pages/GrammarPage').then(m => ({ default: m.GrammarPage })));
const PronunciationPage = lazy(() => import('./pages/PronunciationPage').then(m => ({ default: m.PronunciationPage })));
const RoleplayPage = lazy(() => import('./pages/RoleplayPage').then(m => ({ default: m.RoleplayPage })));
const ContinueLearningPage = lazy(() => import('./pages/ContinueLearningPage').then(m => ({ default: m.ContinueLearningPage })));
const CefrLevelIndexPage = lazy(() => import('./pages/CefrLevelIndexPage').then(m => ({ default: m.CefrLevelIndexPage })));
const PracticeHubPage = lazy(() => import('./pages/PracticeHubPage').then(m => ({ default: m.PracticeHubPage })));
const ArticleSprintPage = lazy(() => import('./pages/ArticleSprintPage').then(m => ({ default: m.ArticleSprintPage })));
const StoriesPage = lazy(() => import('./pages/StoriesPage').then(m => ({ default: m.StoriesPage })));
const AnalyticsPage = lazy(() => import('./pages/Analytics').then(m => ({ default: m.AnalyticsPage })));
const ImportDeckPage = lazy(() => import('./pages/ImportDeck').then(m => ({ default: m.ImportDeckPage })));
const RapidBlitzPage = lazy(() => import('./pages/RapidBlitzPage').then(m => ({ default: m.RapidBlitzPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then(m => ({ default: m.FeedbackPage })));
const A1CheckpointPage = lazy(() => import('./pages/A1CheckpointPage').then(m => ({ default: m.A1CheckpointPage })));
const LessonModulePage = lazy(() =>
  import('./components/lesson/LessonModulePage').then(m => ({ default: m.LessonModulePage }))
);
// The document-style "notes" deep-dive — the PREMIUM tier. It is a separate,
// more specific route and MUST be declared before `lesson/:unitIndex`, or
// react-router matches the shorter pattern and the notes page never renders.
const LessonPage = lazy(() => import('./pages/LessonPage').then(m => ({ default: m.LessonPage })));
const SentenceBuilderPage = lazy(() => import('./pages/SentenceBuilderPage').then(m => ({ default: m.SentenceBuilderPage })));
const GamesPage = lazy(() => import('./pages/GamesPage').then(m => ({ default: m.GamesPage })));
const EmailBuilderPage = lazy(() => import('./pages/EmailBuilderPage').then(m => ({ default: m.EmailBuilderPage })));

/**
 * Single canonical Rapid Blitz route is /rapid-fire.
 * /rapid-blitz (legacy alias) redirects there, PRESERVING any ?mode= query so
 * bonus-chip deep links (e.g. /rapid-blitz?mode=number-conversion) still start
 * the intended challenge. A plain /rapid-blitz lands on the Mixed game.
 */
function RapidBlitzRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/rapid-fire', search }} replace />;
}

/** Routes only — do not put feature logic here */

/**
 * Root path (`/`) router: authenticated users go straight to the app home;
 * every guest (returning or first-time) lands on the marketing `/welcome`
 * page — MeroDeutsch is landing-page-first. UseAuth must be under
 * AuthProvider (it is).
 */
function RootRedirect() {
  const { isAuthenticated } = useAuth();
  const target = isAuthenticated ? '/home' : '/welcome';
  return <Navigate to={target} replace />;
}

export default function App() {
  // Bootstrap the Dexie data layer (seeds db.vocab on first load if empty)
  useDexieInit();
  // Local→Cloud replay pipeline (v0.2.4 reintegration): syncs queued offline
  // writes on reconnect + a 60s interval while authenticated. No-op for guests.
  useSyncBridge();
  // Applies `?adminmode=` handed over by the control center on a DIFFERENT
  // ORIGIN, which therefore cannot write this origin's localStorage. Mounted at
  // the ROOT, not in `Layout`, because in guest mode the router sends the
  // visitor to `/welcome` — a route that renders with no app shell — and a
  // bootstrap hidden inside the shell would never run on exactly the page an
  // admin most needs to inspect.
  useAdminModeBootstrap();
  // Receiving half of the QA bridge. Mounted at the root for the same reason:
  // a tab the control center drives may be sitting on `/welcome`, which renders
  // outside the app shell, and the listener must be live there too.
  useQaBridge();
  // Resolve `curriculum_source` and serve the right curriculum. WITHOUT THIS
  // the flag is inert for learners: the admin control centre can flip it, and
  // the app that actually needs the new content would keep serving the bundle.
  //
  // Mounted at the root, for the same reason as the bootstraps above.
  useCurriculumSource();
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Aggregated learner state for the AI companion. Mounted HERE and not in
            main.tsx: main.tsx sits ABOVE BrowserRouter, so a provider there cannot
            use useLocation/useNavigate. Inside the Router it is also still inside
            A1PathProvider / XpProvider (main.tsx) — exactly what it needs. */}
        <LearningContextProvider>
          {/* QA simulation warning. At the ROOT so it also covers `/welcome` and
              `/auth`, the two routes rendered without an app shell. Self-gates to
              admins; renders nothing for everyone else. */}
          <DebugModeBanner />
          <Suspense fallback={<SkeletonLoader />}>
            <Routes>
              {/* Root: authenticated → app home; guests → marketing landing (/welcome). */}
              <Route index element={<RootRedirect />} />
              {/* Full-screen marketing landing — NO app shell, NO sidebar/bottom nav */}
              <Route path="welcome" element={<LandingPage />} />
              {/* Auth — standalone focus screen: centered card, NO sidebar/footer */}
              <Route path="auth" element={<AuthPage />} />
              {/* App shell */}
              <Route element={<Layout />}>
                {/* Guest action-first Home; authed → existing HomePage */}
                <Route path="home" element={<AppHomeSwitch />} />
                <Route path="alphabet" element={<AlphabetPage />} />
                <Route path="numbers" element={<NumbersPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="articles" element={<ArticlesPage />} />
                <Route path="greetings" element={<GreetingsPage />} />
                <Route path="glossary" element={<GlossaryPage />} />
                <Route path="vocab-trainer" element={<VocabTrainerPage />} />
                <Route path="dictation" element={<DictationPage />} />
                <Route path="grammar" element={<GrammarPage />} />
                <Route path="pronunciation" element={<PronunciationPage />} />
                <Route path="roleplay" element={<RoleplayPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                {/* THE COURSE IS A HUB AND A PATH.
                    /learn          the CEFR level GRID (the chooser).
                    /learn/:levelId one LEVEL's page — its roadmap, stages and
                                    checkpoint gates. A1 today; A2/B1 render
                                    their coming-soon page. Declared before the
                                    dynamic segment so `learn` is never swallowed
                                    as a level id. */}
                <Route path="learn" element={<CefrLevelIndexPage />} />
                <Route path="learn/:levelId" element={<ContinueLearningPage />} />
                {/* A1 unit checkpoint — additive route; soft-locked by unit unlock */}
                <Route path="checkpoint/:unitIndex" element={<A1CheckpointPage />} />
                {/* A unit's full lesson — the imported document content (lexicon,
                    grammar, traps, culture, dialogue, practice bank). Soft-locked
                    like every other module route: deep links always load. */}
                {/* PREMIUM first: the article-style notes for a lesson. */}
    <Route path="lesson/:unitIndex/notes" element={<LessonPage />} />
    {/* FREE: the interactive lesson — the same material as tabs, cards and drills. */}
    <Route path="lesson/:unitIndex" element={<LessonModulePage />} />
                {/* Unit 2 optional practice — bonus node on the /learn spine */}
                <Route path="sentence-builder" element={<SentenceBuilderPage />} />
                {/* NotebookLM mechanics: games hub + Goethe A1 Schreiben trainer.
                    Bonus content — guests welcome, never gates the spine. */}
                <Route path="games" element={<GamesPage />} />
                <Route path="email-builder" element={<EmailBuilderPage />} />
                <Route path="practice" element={<PracticeHubPage />} />
              <Route path="article-sprint" element={<ArticleSprintPage />} />
                <Route path="rapid-fire" element={<RapidBlitzPage />} />
                <Route path="rapid-blitz" element={<RapidBlitzRedirect />} />
                <Route path="stories" element={<StoriesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="import" element={<ImportDeckPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="feedback" element={<FeedbackPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </LearningContextProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
