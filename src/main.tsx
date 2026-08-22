import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { XpProvider } from './context/XpContext';
import { A1PathProvider } from './hooks/useA1Path';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <XpProvider>
            {/* A1 path state — per-user, isolated under meroDeutschA1Path:<userId> */}
            <A1PathProvider>
              <HelmetProvider>
                <App />
              </HelmetProvider>
            </A1PathProvider>
          </XpProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
    <Analytics />
  </StrictMode>
);
