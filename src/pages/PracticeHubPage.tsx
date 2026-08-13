import { useLang } from '../hooks/useLang';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { theme } from '../config/theme';

/**
 * Practice Hub - Dedicated page for quick-access practice tools.
 * Separates practice utilities from core curriculum modules to reduce cognitive load.
 */
export function PracticeHubPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className={theme.page.container}>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
          {isDE ? 'Übungswerkzeuge' : 'Practice Hub'}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
          {isDE
            ? 'Erweitere deine Fähigkeiten mit interaktiven Übungswerkzeugen — Aussprache, Diktat, Grammatik und mehr.'
            : 'Enhance your skills with interactive practice tools — pronunciation, dictation, grammar, and more.'}
        </p>
      </div>

      <PracticeToolsGrid />
    </div>
  );
}
