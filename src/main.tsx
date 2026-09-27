import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { HelmetProvider } from 'react-helmet-async';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { XpProvider } from './context/XpContext';
import { A1PathProvider } from './hooks/useA1Path';
import { VocabularyStatusProvider } from './hooks/useVocabularyStatus';

/**
 * Service-worker registration — MAIN APP ONLY.
 *
 * This import is load-bearing for the multi-page build. vite-plugin-pwa
 * defaults `injectRegister: 'auto'`, which injects `<script src="/registerSW.js">`
 * into EVERY html input. The generated worker is served at `/sw.js` with scope `/`
 * and a workbox `navigateFallback: '/index.html'`; had admin.html registered it,
 * every admin route would have been answered with the learner app's index.html.
 *
 * Importing `virtual:pwa-register` here sets the plugin's `useImportRegister`
 * flag, which resolves `injectRegister` to `null` and suppresses HTML injection
 * entirely — leaving registration to this explicit, per-entry call. The admin
 * entry (`src/admin/main.tsx`) intentionally never imports it.
 */
registerSW({ immediate: true });

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
  </StrictMode>
);
