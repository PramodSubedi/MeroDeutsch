import { useCallback } from 'react';
import { getItem, setItem } from '../utils/safeStorage';

const KEY = 'meroDeutschLastModulePath';
const MODULE_ROUTES = ['alphabet', 'numbers', 'calendar', 'articles', 'greetings', 'dictation', 'grammar'];

/** Tracks the last opened learning module so "Continue learning" can resume there. */
export function useLastModule() {
  const getLastModule = useCallback((): string => {
    const stored = getItem(KEY);
    return stored && MODULE_ROUTES.includes(stored) ? `/${stored}` : '/alphabet';
  }, []);

  const rememberModule = useCallback((path: string) => {
    const route = path.split('/').filter(Boolean)[0] ?? '';
    if (MODULE_ROUTES.includes(route)) {
      setItem(KEY, route);
    }
  }, []);

  return { getLastModule, rememberModule };
}