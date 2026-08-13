import { useEffect } from 'react';

/**
 * Set the document title for the current page. Defaults to the brand suffix
 * so every route has a descriptive browser-tab title.
 *
 * Example: `usePageTitle('Alphabet')` → "Alphabet | MeroDeutsch".
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | MeroDeutsch` : 'MeroDeutsch – Learn German';
    return () => {
      document.title = previous;
    };
  }, [title]);
}