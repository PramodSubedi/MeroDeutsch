import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useLastModule } from '../hooks/useLastModule';
import { DailyChallenge } from '../components/DailyChallenge';
import { LearningPath } from '../components/learning/LearningPath';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { theme } from '../config/theme';

/**
 * Dedicated Learning Hub at /learn.
 *
 * Reuses the existing Word-of-the-Day system (DailyChallenge), the existing
 * A1 Learning Path (LearningPath — extracted from HomePage), and the existing
 * learning tools grid. No new datasets or curriculum types are introduced.
 *
 * Accessible to both guest and authenticated users.
 */
export function ContinueLearningPage() {
  const { langMode } = useLang();
  const { getLastModule } = useLastModule();
  const isDE = langMode === 'german';
  const continuePath = getLastModule();

  return (
    <div className={theme.page.container}>
      {/* A. Page header — back-to-home + title */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            {isDE ? 'Weiterlernen' : 'Continue Learning'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Dein persönlicher Lernhub — Wort des Tages, Lernpfad und Übungs-Tools.'
              : 'Your personal learning hub — word of the day, learning path, and practice tools.'}
          </p>
        </div>
        <Link
          to={continuePath}
          className={`${theme.button.primary} min-w-[160px] text-center`}
        >
          {isDE ? 'Letztes Modul' : 'Last Module'} →
        </Link>
      </header>

      {/* B. Word of the Day — reuses existing DailyChallenge component */}
      <DailyChallenge />

      {/* C. A1 Learning Path — reuses extracted component */}
      <LearningPath />

      {/* D. Learning tools — reuses existing PracticeToolsGrid */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-slate-950 dark:text-white">
          {isDE ? 'Lern-Übungs-Tools' : 'Practice Tools'}
        </h2>
        <PracticeToolsGrid />
      </section>
    </div>
  );
}
