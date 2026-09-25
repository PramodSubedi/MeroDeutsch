import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { PageHeading } from '../components/common/PageHeading';
import { ArticleSprint } from '../components/exercises/ArticleSprint';
import { SEO } from '../components/common/SEO';
import { theme } from '../config/theme';

/**
 * Article Sprint — dedicated route for the der/die/das recall drill.
 *
 * This existed before only as an inlined section at the bottom of PracticeHubPage
 * (v0.2.4 reintegration), which is why it "loaded directly unlike other tools".
 * It now has its own route + grid card, consistent with every other practice tool.
 *
 * TTS-safe: the ArticleSprint component only speaks the bare noun before lock;
 * the article is spoken AFTER the answer is locked (see ArticleSprint.tsx docblock).
 * Gamified via the shared exercise session (XP/toasts, not the mid-quiz modal).
 */
export function ArticleSprintPage() {
  usePageTitle('Article Sprint');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  return (
    <div className={theme.page.container}>
      <SEO
        title="Article Sprint — der/die/das | MeroDeutsch"
        description="Tap to hear a noun, then pick its article der/die/das. Fast-paced TTS-safe drill."
      />
      <PageHeading
        title={isDE ? 'Artikel-Sprint' : 'Article Sprint'}
        subtitle={isDE ? 'Tippe 🔊, wähle der/die/das.' : 'Tap 🔊 to hear the noun, then pick der/die/das.'}
      />
      <ArticleSprint />
    </div>
  );
}
