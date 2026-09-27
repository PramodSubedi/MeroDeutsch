import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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

/**
 * ── THE BOOT GATE ───────────────────────────────────────────────────────────
 * `App` is imported DYNAMICALLY, after the curriculum source is resolved.
 *
 * This is the whole reason the `db` source can be real rather than decorative.
 * A static `import App from './App'` pulls in `data/curriculum/index.ts`, which
 * derives the spine in module scope; ~50 modules then read those constants
 * synchronously. ES module bindings are fixed at evaluation, so once that graph
 * exists no later assignment can change what they hold — a post-mount "resolve
 * and upgrade" would leave the flag permanently inert while appearing to work.
 *
 * So the order is: resolve (bounded, bundle on any failure) → plant the seed →
 * import. The learner still gets the bundle in every failure mode, including a
 * timeout; `db` has to earn the right to be used.
 *
 * `runBootGate` never rejects, so there is no catch needed here by construction —
 * but the dynamic import itself is wrapped anyway, because a chunk that fails to
 * load would otherwise leave a permanently blank page with no error shown.
 */
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
    // A failed chunk load is unrecoverable for this page load, but the learner
    // deserves to be told rather than shown a blank screen.
    const root = document.getElementById('root');
    if (root) {
      root.textContent = 'The app could not be loaded. Check your connection and reload.';
      console.error('[boot] App chunk failed to load', err);
    }
    return;
  }

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
