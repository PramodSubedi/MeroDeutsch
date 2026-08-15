import { theme } from '../config/theme';
import { AuthGate } from '../components/AuthGate';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { HomeLayoutA } from '../components/home/HomeLayoutA';

// Main page component for MeroDeutsch German learning app
export function HomePage() {
  usePageTitle('Home');

  return (
    <AuthGate>
      <div className={theme.page.container}>
        <SEO
          title="Master A1 German | MeroDeutsch"
          description="Start with A1 essentials: alphabet, numbers, articles, and greetings — then unlock review practice that adapts to your mistakes."
        />
        <HomeLayoutA />
      </div>
    </AuthGate>
  );
}