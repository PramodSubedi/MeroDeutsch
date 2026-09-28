import { useLang } from '../hooks/useLang';
import { theme } from '../config/theme';

/**
 * EN / DE mode switch.
 *
 * Highlighted side = CURRENT mode:
 *   - EN active → bilingual mode ('normal' — helpers visible)
 *   - DE active → Nur-DE mode ('german' — helpers hidden, still playable)
 *
 * Extracted as a single shared component (v0.2.1) so the desktop and mobile
 * header blocks in Layout can never drift apart again.
 *
 * TWO SHAPES, ONE CONTROL
 * On `sm+` this is the two-state segmented control. Below `sm` it collapses to a
 * SINGLE 44px button showing the current mode.
 *
 * Why: the segmented control measured 75px wide, and the mobile header's utility
 * cluster was 231px of a 380px bar — 61% of the available width spent on
 * chrome, with the section label squeezed into what was left. Collapsing to one
 * button returns 31px and, more importantly, removes a genuine ambiguity: a
 * two-state control has to be READ to know its state ("which side is lit?"),
 * while a single button can simply DISPLAY it ("DE"). The control stays in the
 * header rather than moving into the drawer, because Nur-DE is a
 * pedagogical setting a learner reaches for deliberately, not a utility to
 * bury two taps deep.
 */
export function LanguageToggle() {
  const { langMode, toggle } = useLang();
  const isGermanOnly = langMode === 'german';

  return (
    <>
      {/*
        The two variants live inside WRAPPER elements rather than sharing one
        <button>. `theme.layout.langSwitch.track` already contains `inline-flex`,
        and two display utilities of equal specificity resolve by their order in
        the generated stylesheet — not by their order in the class attribute — so
        a bare `hidden` on the same element loses and BOTH controls render. That
        is exactly what happened: the 44px button and the 75px one appeared side
        by side, making the header wider than before this change. The wrappers
        have no competing display class, so they are unambiguous.
      */}
      {/* Phone: one button, current mode as its own label. */}
      <span className="sm:hidden">
        <button
          type="button"
          onClick={toggle}
          aria-label={isGermanOnly
            ? 'Switch to bilingual mode'
            : 'Switch to German only'}
          aria-pressed={isGermanOnly}
          className={`${theme.layout.themeButton} text-meta font-extrabold`}
        >
          {isGermanOnly ? 'DE' : 'EN'}
        </button>
      </span>

      {/* sm+: the full segmented control. */}
      <span className="hidden sm:inline-flex">
        <button
          type="button"
          onClick={toggle}
          aria-label={isGermanOnly
            ? 'Switch to bilingual mode'
            : 'Switch to German only'}
          aria-pressed={isGermanOnly}
          className={theme.layout.langSwitch.track}
        >
          <span className={!isGermanOnly ? theme.layout.langSwitch.optionActive : theme.layout.langSwitch.optionInactive}>
            EN
          </span>
          <span className={isGermanOnly ? theme.layout.langSwitch.optionActive : theme.layout.langSwitch.optionInactive}>
            DE
          </span>
        </button>
      </span>
    </>
  );
}
