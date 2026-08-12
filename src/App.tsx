import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AlphabetPage } from './pages/AlphabetPage';
import { NumbersPage } from './pages/NumbersPage';
import { CalendarPage } from './pages/CalendarPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { GreetingsPage } from './pages/GreetingsPage';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { AuthPage } from './pages/AuthPage';
import { GlossaryPage } from './pages/GlossaryPage';
import { DictationPage } from './pages/DictationPage';
import { GrammarPage } from './pages/GrammarPage';
import { PronunciationPage } from './pages/PronunciationPage';
import { RoleplayPage } from './pages/RoleplayPage';
import { ErrorBoundary } from './components/ErrorBoundary';

/** Routes only — do not put feature logic here */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
