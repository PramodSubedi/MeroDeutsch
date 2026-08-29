import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { PageHeading } from '../components/common/PageHeading';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { theme } from '../config/theme';

/**
 * Practice Hub — a clean launchpad for all quick-access practice tools.
 *
 * v0.2.4 note: the Article Sprint (der/die/das) drill used to be an INLINE
 * section at the bottom of this page, which is why it "loaded directly unlike
 * other tools". It now lives at /article-sprint (its own route + grid card),
 * so this page is just the centralized tool grid. No article logic here.
 */
export function PracticeHubPage() {
  usePageTitle('Practice');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className={theme.page.container}>
      <PageHeading
        title={isDE ? 'Übungswerkzeuge' : 'Practice Hub'}
        subtitle={isDE ? 'Erweitere deine Fähigkeiten mit interaktiven Übungswerkzeugen — Aussprache, Diktat, Grammatik und mehr.' : 'Enhance your skills with interactive practice tools — pronunciation, dictation, grammar, and more.'}
      />
      {/* Module switcher rail — jump between practice tools and A1 lessons */}
      <div className="mt-6">
        <PracticeToolsGrid />
      </div>
    </div>
  );
}