/**
 * src/admin/main.tsx — Admin control center bootstrap.
 *
 * THE ADMIN ENTRY. Separate HTML document (`admin.html`), separate Vite input,
 * separate browser origin. It shares the Supabase project, the design tokens and
 * the error boundary with the learner app, and shares NOTHING else.
 *
 * DELIBERATELY ABSENT (each omission is load-bearing):
 *   · `virtual:pwa-register` — the learner app owns the service worker. If the
 *     admin entry registered it, its workbox `navigateFallback: '/index.html'`
 *     would answer every admin route with the learner app's shell.
 *   · `<Analytics />`        — the control center is not a tracked product.
 *   · Dexie / Xp / A1Path / Language providers — none of that state exists on
 *     this origin, and initialising IndexedDB for an admin would pollute storage
 *     that a real admin's own learning progress shares.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import { AdminApp } from './AdminApp';
import { AdminAuthProvider } from './hooks/useAdminAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

/**
 * ── WHY THIS EXISTS: THE ADMIN ORIGIN USED TO SERVE THE LEARNER APP ─────────
 * While the routing was misconfigured, `admin.merodeutsch…` returned the
 * LEARNER `index.html`. That document runs `virtual:pwa-register`, so a service
 * worker got INSTALLED ON THE ADMIN ORIGIN and precached the learner shell.
 *
 * After the routing was fixed the HTML served was correct, but the browser kept
 * showing the learner app: the stale worker was still controlling the origin and
 * answering navigations from its precache. `curl` saw the right page, which
 * made it look like a server bug rather than a client one.
 *
 * So the control centre now evicts itself. Any worker or cache on this origin
 * is by definition wrong — the admin entry never registers one — and removing it
 * is the only way to be sure an admin is looking at the control centre and not
 * a cached copy of the app.
 *
 * This is deliberately unconditional and runs before render: a visitor who
 * never touches devtools is exactly the person this protects.
 */
async function evictLearnerArtifacts(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    // Workbox precaches under a cache prefix; clearing every origin-scoped cache
    // is safe because the control centre holds no offline data worth keeping.
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // A failed eviction must never stop the control centre from rendering.
  }
}

const container = document.getElementById('admin-root');
if (!container) {
  throw new Error('Admin root element #admin-root is missing from admin.html');
}

// Kick off eviction, but render immediately — the UI does not wait on it.
void evictLearnerArtifacts();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AdminAuthProvider>
          <AdminApp />
        </AdminAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
