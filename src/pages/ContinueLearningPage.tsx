import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useLastModule } from '../hooks/useLastModule';
import { usePageTitle } from '../hooks/usePageTitle';
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
const MODULE_LABELS: Record<string, { en: string; de: string }> = {
  alphabet: { en: 'Alphabet', de: 'Alphabet' },
  numbers: { en: 'Numbers', de: 'Zahlen' },
  calendar: { en: 'Calendar', de: 'Kalender' },
  articles: { en: 'Articles', de: 'Artikel' },
  greetings: { en: 'Greetings', de: 'Grüße' },
  dictation: { en: 'Dictation', de: 'Diktat' },
  grammar: { en: 'Grammar', de: 'Grammatik' },
};

export function ContinueLearningPage() {
  usePageTitle('Learn');
  const { langMode } = useLang();
  const { getLastModule } = useLastModule();
  const isDE = langMode === 'german';
  const continuePath = getLastModule();
  const moduleKey = continuePath.split('/').filter(Boolean)[0] ?? '';
  const moduleLabel = MODULE_LABELS[moduleKey] ?? { en: 'Last Module', de: 'Letztes Modul' };

  return (
    <div className={theme.page.container}>
      {/* A. Page header — back-to-home + title */}
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          {isDE ? moduleLabel.de : moduleLabel.en} →
        </Link>
      </header>

      {/* B. Word of the Day — reuses existing DailyChallenge component */}
      <DailyChallenge />

      {/* C. A1 Learning Path — reuses extracted component */}
      <LearningPath />

      {/* D. Learning tools — full grid with anchor for home compact links */}
      <section className={`${theme.panel.surface} mb-8`} id="practice">
        <h2 className="mb-4 text-xl font-bold text-slate-950 dark:text-white">
          {isDE ? 'Lern-Übungs-Tools' : 'Practice Tools'}
        </h2>
        <PracticeToolsGrid />
      </section>
    </div>
  );
}