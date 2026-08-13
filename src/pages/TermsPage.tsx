import { Link } from 'react-router-dom';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';

export function TermsPage() {
  usePageTitle('Terms');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const sections: { title: string; body: string }[] = isDE
    ? [
        {
          title: 'Nutzung der App',
          body: 'MeroDeutsch ist ein kostenloses Lernwerkzeug. Du verpflichtest dich, die App nicht zu missbrauchen, keine schädlichen Inhalte hochzuladen und keine Server zu überlasten.',
        },
        {
          title: 'Konten & Gastnutzung',
          body: 'Du kannst die App als Gast ohne Konto nutzen. Ein Konto wird über Supabase erstellt und dient ausschließlich der Synchronisierung deines Fortschritts über Geräte hinweg.',
        },
        {
          title: 'Inhalte',
          body: 'Die Lerninhalte werden ohne Gewähr zur Verfügung gestellt. Wir bemühen uns um Richtigkeit, übernehmen jedoch keine Haftung für Fehler in Vokabeln, Grammatik oder Übungen.',
        },
        {
          title: 'Haftungsausschluss',
          body: 'MeroDeutsch wird "wie besehen" ohne ausdrückliche oder stillschweigende Garantien bereitgestellt. Wir haften nicht für Schäden, die durch die Nutzung der App entstehen.',
        },
        {
          title: 'Kontakt',
          body: 'Fragen zu diesen Bedingungen? Nutze die Feedback-Seite, um uns zu erreichen.',
        },
      ]
    : [
        {
          title: 'Use of the app',
          body: 'MeroDeutsch is a free learning tool. You agree not to misuse the app, upload harmful content, or overload servers.',
        },
        {
          title: 'Accounts & guest use',
          body: 'You can use the app as a guest without an account. An account is created via Supabase and is used solely to sync your progress across devices.',
        },
        {
          title: 'Content',
          body: 'Learning content is provided without warranty. We aim for accuracy but are not liable for errors in vocabulary, grammar, or exercises.',
        },
        {
          title: 'Disclaimer of liability',
          body: 'MeroDeutsch is provided "as is" without express or implied warranties. We are not liable for damages arising from use of the app.',
        },
        {
          title: 'Contact',
          body: 'Questions about these terms? Use the feedback page to reach us.',
        },
      ];

  return (
    <div className={theme.page.container}>
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.25em] text-blue-600">{isDE ? 'Nutzungsbedingungen' : 'Terms'}</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {isDE ? 'Nutzungsbedingungen' : 'Terms of Service'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE ? 'Stand: 2026' : 'Last updated: 2026'}
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.title} className={theme.panel.surface}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
          ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
        </Link>
      </div>
    </div>
  );
}