import { useEffect } from 'react';
import { APP_NAME } from '../config/appInfo';

/**
 * Set the document title for the current page. Defaults to the brand suffix
 * so every route has a descriptive browser-tab title.
 *
 * Example: `usePageTitle('Alphabet')` → "Alphabet | MeroDeutsch".
 *
 * The suffix is applied only when the caller did not already name the brand.
 * Two pages legitimately contain it in their own copy ("Try MeroDeutsch"), and
 * appending unconditionally produced "Try MeroDeutsch | MeroDeutsch | …".
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    const base = title || `MeroDeutsch – Learn German`;
    document.title = base.includes(APP_NAME) ? base : `${base} | ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}