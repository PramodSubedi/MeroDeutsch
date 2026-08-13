import { Link } from 'react-router-dom';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';

export function PrivacyPage() {
  usePageTitle('Privacy');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className={theme.page.container}>
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.25em] text-blue-600">{isDE ? 'Datenschutz' : 'Privacy'}</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {isDE ? 'Datenschutzerklärung' : 'Privacy Policy'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE ? 'Stand: 2026' : 'Last updated: 2026'}
        </p>
      </div>

      <div className="space-y-4">
        {isDE ? (
          <>
            <div key="Supabase-Authentifizierung" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Supabase-Authentifizierung</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Wenn du ein Konto erstellst, werden deine E-Mail-Adresse und dein Benutzername von Supabase Auth verarbeitet. Dein Passwort wird niemals im Klartext auf deinem Gerät oder auf unseren Servern gespeichert.</p>
            </div>
            <div key="Lokaler Geräte-Cache" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Lokaler Geräte-Cache</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Dein Lernfortschritt, Serien, Auszeichnungen und Einstellungen werden in deinem Browser (localStorage) auf diesem Gerät gespeichert. Gäste-Daten werden ausschließlich lokal gespeichert.</p>
            </div>
            <div key="Browser-Sprachfunktionen" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Browser-Sprachfunktionen</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Die App nutzt die Sprachsynthese (Vorlesen) und Spracherkennung (Mikrofon) deines Browsers. Audio wird direkt auf deinem Gerät verarbeitet und nicht an unsere Server gesendet.</p>
            </div>
            <div key="Keine Weitergabe persönlicher Daten" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Keine Weitergabe persönlicher Daten</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Wir verkaufen deine persönlichen Daten nicht an Dritte. Deine Daten werden ausschließlich zur Bereitstellung der Lernfunktionen verwendet.</p>
            </div>
            <div key="PWA / Service-Worker-Cache" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">PWA / Service-Worker-Cache</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Als installierbare PWA cached die App Inhalte über einen Service Worker, damit du offline lernen kannst. Dieser Cache kann in den Browser-Einstellungen gelöscht werden.</p>
            </div>
          </>
        ) : (
          <>
            <div key="Supabase authentication" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Supabase authentication</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">When you create an account, your email address and username are processed by Supabase Auth. Your password is never stored in plain text on your device or on our servers.</p>
            </div>
            <div key="Local device cache" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Local device cache</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Your learning progress, streaks, achievements, and preferences are stored in your browser (localStorage) on this device. Guest data is stored only locally.</p>
            </div>
            <div key="Browser speech features" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Browser speech features</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">The app uses your browser’s speech synthesis (read-aloud) and speech recognition (microphone). Audio is processed on your device and is not sent to our servers.</p>
            </div>
            <div key="No selling of personal data" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">No selling of personal data</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">We do not sell your personal data to third parties. Your data is used solely to provide the learning features.</p>
            </div>
            <div key="PWA / service worker cache" className={theme.panel.surface}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">PWA / service worker cache</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">As an installable PWA, the app caches content via a service worker so you can learn offline. This cache can be cleared from your browser settings.</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-6">
        <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
          ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
        </Link>
      </div>
    </div>
  );
}