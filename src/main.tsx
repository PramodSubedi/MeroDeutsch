import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import { Analytics } from '@vercel/analytics/react';
import { HelmetProvider } from 'react-helmet-async';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { XpProvider } from './context/XpContext';
import { A1PathProvider } from './hooks/useA1Path';
import { VocabularyStatusProvider } from './hooks/useVocabularyStatus';
import { setUpdateAvailable } from './hooks/useUpdatePrompt';

/**
 * Service-worker registration — MAIN APP ONLY.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => setUpdateAvailable(() => updateSW(true)),
});

function clearBootSplash(): void {
  document.getElementById('app-splash')?.remove();
}

async function boot() {
  let source = 'bundle';
  try {
    const gate = await import('./data/curriculum/bootGate');
    const outcome = await gate.runBootGate({
      readFlag: () => import('./data/curriculum/flagReader').then((m) => m.readCurriculumSourceFlag()),
      fetchDoc: () => import('./data/curriculum/flagReader').then((m) => m.fetchDbCurriculum()),
      countUnits: (raw) => (Array.isArray((raw as { units?: unknown[] }).units) ? (raw as { units: unknown[] }).units.length : 0),
    });
    source = outcome.kind === 'db' ? `db (${outcome.units} units)` : `bundle (${outcome.reason})`;
  } catch (err) {
    source = `bundle (gate failed: ${err instanceof Error ? err.message : String(err)})`;
  }

  if (import.meta.env.DEV) console.info(`[curriculum] serving ${source}`);

  let App: typeof import('./App').default;
  try {
    ({ default: App } = await import('./App'));
  } catch (err) {
    const root = document.getElementById('root');
    if (root) {
      clearBootSplash();
      root.textContent = 'The app could not be loaded. Check your connection and reload.';
      console.error('[boot] App chunk failed to load', err);
    }
    return;
  }

  // Initialize Sentry right before React mounts
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  clearBootSplash();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <LanguageProvider>
            <XpProvider>
              {/* A1 path state — per-user, isolated under meroDeutschA1Path:<userId> */}
              <A1PathProvider>
                {/* Per-word learning status (Glossary / Vocab Trainer) — Dexie-local */}
                <VocabularyStatusProvider>
                  <HelmetProvider>
                    <App />
                  </HelmetProvider>
                </VocabularyStatusProvider>
              </A1PathProvider>
            </XpProvider>
          </LanguageProvider>
        </AuthProvider>
      </ErrorBoundary>
      <Analytics />
    </StrictMode>,
  );
}

void boot();
