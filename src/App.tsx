import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Core pages - eagerly loaded for instant navigation
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { AlphabetPage } from './pages/AlphabetPage';
import { NumbersPage } from './pages/NumbersPage';
import { CalendarPage } from './pages/CalendarPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { GreetingsPage } from './pages/GreetingsPage';

// Secondary pages - lazy loaded to reduce initial bundle size
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GlossaryPage = lazy(() => import('./pages/GlossaryPage').then(m => ({ default: m.GlossaryPage })));
const DictationPage = lazy(() => import('./pages/DictationPage').then(m => ({ default: m.DictationPage })));
const GrammarPage = lazy(() => import('./pages/GrammarPage').then(m => ({ default: m.GrammarPage })));
const PronunciationPage = lazy(() => import('./pages/PronunciationPage').then(m => ({ default: m.PronunciationPage })));
const RoleplayPage = lazy(() => import('./pages/RoleplayPage').then(m => ({ default: m.RoleplayPage })));
const ContinueLearningPage = lazy(() => import('./pages/ContinueLearningPage').then(m => ({ default: m.ContinueLearningPage })));
const PracticeHubPage = lazy(() => import('./pages/PracticeHubPage').then(m => ({ default: m.PracticeHubPage })));
const StoriesPage = lazy(() => import('./pages/StoriesPage').then(m => ({ default: m.StoriesPage })));
const AnalyticsPage = lazy(() => import('./pages/Analytics').then(m => ({ default: m.AnalyticsPage })));
const ImportDeckPage = lazy(() => import('./pages/ImportDeck').then(m => ({ default: m.ImportDeckPage })));

/** Routes only — do not put feature logic here */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="auth" element={<AuthPage />} />
              <Route path="alphabet" element={<AlphabetPage />} />
              <Route path="numbers" element={<NumbersPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="articles" element={<ArticlesPage />} />
              <Route path="greetings" element={<GreetingsPage />} />
              <Route path="glossary" element={<GlossaryPage />} />
              <Route path="dictation" element={<DictationPage />} />
              <Route path="grammar" element={<GrammarPage />} />
              <Route path="pronunciation" element={<PronunciationPage />} />
              <Route path="roleplay" element={<RoleplayPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="learn" element={<ContinueLearningPage />} />
              <Route path="practice" element={<PracticeHubPage />} />
              <Route path="stories" element={<StoriesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="import" element={<ImportDeckPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}