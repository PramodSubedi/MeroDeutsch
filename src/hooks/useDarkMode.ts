import { useCallback, useEffect, useState } from 'react';
import { getItem, setItem } from '../utils/safeStorage';

const KEY = 'germanDarkMode';

export function useDarkMode() {
  const [dark, setDark] = useState(() => getItem(KEY) === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    setItem(KEY, dark ? '1' : '0');
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return { dark, toggle };
}
