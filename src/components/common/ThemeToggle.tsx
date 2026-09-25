import { Moon, Sun } from 'lucide-react';
import { theme } from '../../config/theme';
import { useDarkMode } from '../../hooks/useDarkMode';

/**
 * Shared dark/light theme toggle.
 *
 * The app header and the marketing landing header previously carried byte-
 * identical copies of this button (the language switch was already extracted,
 * the theme switch was not).
 */
export function ThemeToggle() {
  const { dark, toggle } = useDarkMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className={theme.layout.themeButton}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
