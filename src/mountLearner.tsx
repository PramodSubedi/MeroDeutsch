import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { Analytics } from '@vercel/analytics/react';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { XpProvider } from './context/XpContext';
import { A1PathProvider } from './hooks/useA1Path';
import { VocabularyStatusProvider } from './hooks/useVocabularyStatus';
import App from './App';

export function mountLearner() {
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
