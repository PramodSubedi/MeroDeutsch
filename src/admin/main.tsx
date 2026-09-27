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

const container = document.getElementById('admin-root');
if (!container) {
  throw new Error('Admin root element #admin-root is missing from admin.html');
}

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
