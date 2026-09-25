/**
 * src/pages/EmailBuilderPage.tsx
 *
 * Goethe A1 "Schreiben" practice — guided email assembly for the four exam
 * task types (Einladung, Zusage, Absage, Termin verschieben). Reached from
 * the practice hub and the /learn spine bonus chip (Band F). Pure practice:
 * no checkpoint gating. Guests welcome.
 */

import { useState } from 'react';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { PageHeading } from '../components/common/PageHeading';
import { theme } from '../config/theme';
import { TabGroup } from '../components/TabGroup';
import { EmailBuilder } from '../components/exercises/EmailBuilder';
import { EmailEvaluator } from '../components/exercises/EmailEvaluator';

export function EmailBuilderPage() {
  usePageTitle('Email Builder');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'build' | 'evaluate'>('build');

  return (
    <div className={theme.page.container}>
      <SEO
        title="Email Builder | MeroDeutsch"
        description="Goethe A1 Schreiben practice — build invitation, acceptance, and apology emails step by step with the right greetings and closings."
      />
      <PageHeading
        title={isDE ? 'E-Mail-Trainer (Goethe A1 Schreiben)' : 'Email Builder (Goethe A1 Writing)'}
        subtitle={isDE
          ? 'Baue Prüfungs-E-Mails Schritt für Schritt: Anrede, Punkte, Schluss — formell vs. informell.'
          : 'Build exam emails step by step: greeting, mandatory points, closing — informal vs formal.'}
        backTo={isAuthenticated ? '/learn' : '/home'}
        backLabel={isDE ? 'Lernpfad' : 'Learning path'}
      />
      <div className="mx-auto max-w-2xl">
        <TabGroup
          tabs={[
            { id: 'build', label: isDE ? 'E-Mail bauen' : 'Build an email' },
            { id: 'evaluate', label: isDE ? 'Benoten üben' : 'Point Evaluator' },
          ]}
          activeTab={mode}
          onTabChange={(t) => setMode(t === 'evaluate' ? 'evaluate' : 'build')}
        />
        <div className="mt-4">
          {mode === 'build' ? <EmailBuilder /> : <EmailEvaluator />}
        </div>
      </div>
    </div>
  );
}