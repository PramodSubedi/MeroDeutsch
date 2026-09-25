import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LangMode } from '../types';
import { getItem, setItem } from '../utils/safeStorage';

const STORAGE_KEY = 'germanLangMode';

type LanguageContextValue = {
  langMode: LangMode;
  isGerman: boolean;
  toggleLanguage: () => void;
  setLanguage: (mode: LangMode) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [langMode, setLangMode] = useState<LangMode>(() => {
    const stored = getItem(STORAGE_KEY) as LangMode | null;
    return stored === 'german' ? 'german' : 'normal';
  });

  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      document.documentElement.lang = langMode === 'german' ? 'de' : 'en';
      document.body.classList.toggle('lang-normal', langMode === 'normal');
      document.body.classList.toggle('lang-german', langMode === 'german');
    }
    setItem(STORAGE_KEY, langMode);
  }, [langMode]);

  const toggleLanguage = useCallback(() => {
    setLangMode((mode) => (mode === 'normal' ? 'german' : 'normal'));
  }, []);

  const value = useMemo(
    () => ({
      langMode,
      isGerman: langMode === 'german',
      toggleLanguage,
      setLanguage: setLangMode,
    }),
    [langMode, toggleLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
