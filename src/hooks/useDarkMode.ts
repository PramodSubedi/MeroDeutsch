import { useCallback, useEffect, useState } from 'react';
import { getItem, setItem } from '../utils/safeStorage';

const KEY = 'germanDarkMode';

/**
 * The two canvas colours, kept in sync with the `--app-canvas` / `--app-canvas-dark`
 * custom properties in index.css. Duplicated here as literals because a
 * `getComputedStyle` read on every theme flip is more machinery than two
 * strings are worth — but they MUST stay equal to the CSS values.
 */
const CANVAS_LIGHT = '#f7f9fb';
const CANVAS_DARK = '#0d1219';

export function useDarkMode() {
  const [dark, setDark] = useState(() => getItem(KEY) === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    setItem(KEY, dark ? '1' : '0');

    // Keep the OS/browser chrome in step with the in-app theme.
    //
    // index.html ships two media-scoped <meta name="theme-color"> tags, but those
    // follow the PLATFORM preference. A learner who forces dark mode inside the
    // app on a light-mode phone would otherwise keep a light status bar over a
    // dark canvas. Rewriting the tag here is the cheapest way to make the
    // browser chrome agree with what the learner actually chose.
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) {
      meta.setAttribute('content', dark ? CANVAS_DARK : CANVAS_LIGHT);
    } else {
      const el = document.createElement('meta');
      el.setAttribute('name', 'theme-color');
      el.setAttribute('content', dark ? CANVAS_DARK : CANVAS_LIGHT);
      document.head.appendChild(el);
    }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return { dark, toggle };
}
