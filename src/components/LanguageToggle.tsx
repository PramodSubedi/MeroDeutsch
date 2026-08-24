import { useLang } from '../hooks/useLang';
import { theme } from '../config/theme';

/**
 * Two-state language switch (EN / DE).
 *
 * Highlighted side = CURRENT mode:
 *   - EN active → bilingual mode ('normal' — helpers visible)
 *   - DE active → Nur-DE mode ('german' — helpers hidden, still playable)
 *
 * Extracted as a single shared component (v0.2.1) so the desktop and mobile
 * header blocks in Layout can never drift apart again.
 */
export function LanguageToggle() {
  const { langMode, toggle } = useLang();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={langMode === 'normal' ? 'Switch to German only' : 'Switch to bilingual mode'}
      aria-pressed={langMode === 'german'}
      className={theme.layout.langSwitch.track}
    >
      <span className={langMode === 'normal' ? theme.layout.langSwitch.optionActive : theme.layout.langSwitch.optionInactive}>
        EN
      </span>
      <span className={langMode === 'german' ? theme.layout.langSwitch.optionActive : theme.layout.langSwitch.optionInactive}>
        DE
      </span>
    </button>
  );
}
