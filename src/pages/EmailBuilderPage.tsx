/**
 * src/pages/EmailBuilderPage.tsx
 *
 * Goethe A1 "Schreiben" practice — guided email assembly for the four exam
 * task types (Einladung, Zusage, Absage, Termin verschieben). Reached from
 * the practice hub and the /learn spine bonus chip (Band F). Pure practice:
 * no checkpoint gating. Guests welcome.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
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
      <header className="mb-4">
        <Link
          to={isAuthenticated ? '/learn' : '/home'}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          ← {isDE ? 'Lernpfad' : 'Learning path'}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {isDE ? 'E-Mail-Trainer (Goethe A1 Schreiben)' : 'Email Builder (Goethe A1 Writing)'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Baue Prüfungs-E-Mails Schritt für Schritt: Anrede, Punkte, Schluss — formell vs. informell.'
            : 'Build exam emails step by step: greeting, mandatory points, closing — informal vs formal.'}
        </p>
      </header>
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