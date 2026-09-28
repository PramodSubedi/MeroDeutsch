/**
 * src/config/mobileShell.ts
 *
 * ONE source of truth for the mobile shell's vertical geometry.
 *
 * THE BUG THIS FIXES
 * ------------------
 * The bottom tab bar and the content column's bottom padding were two
 * independent literals:
 *
 *   BottomNav  →  bottom-[calc(0.75rem+env(safe-area-inset-bottom))]  (12px + inset)
 *   <main>     →  pb-[calc(5rem+env(safe-area-inset-bottom))]       (80px + inset)
 *
 * Measured on a 390x844 viewport the bar rendered 78px tall and sat 12px off
 * the bottom — 90px of occupied space — while `<main>` reserved only 80px. Ten
 * pixels of every page's last row therefore sat permanently underneath the
 * floating bar, and on /rapid-fire five interactive elements intersected it.
 * Nothing errored; the content was simply unreachable.
 *
 * WHY A SEPARATE MODULE
 * Changing one without the other is the whole failure mode, so the two numbers
 * now live side by side and are derived from each other. Editing the bar's
 * height here changes both the bar and the space reserved for it.
 *
 * `env(safe-area-inset-bottom)` is 0px on a desktop browser, which is why this
 * was invisible in dev and only bit on a notched iPhone — and only *after*
 * `viewport-fit=cover` was added to index.html (see the note there).
 *
 * WHY THE CLASSES BELOW ARE PLAIN STRING LITERALS
 * ------------------------------------------------
 * This module originally built them with template interpolation:
 *
 *   `pb-[calc(${MOBILE_CONTENT_CLEARANCE_REM}rem+env(safe-area-inset-bottom))]`
 *
 * That is correct JavaScript and produces the right class at runtime — and
 * Tailwind never emitted a rule for it. The class scanner reads RAW FILE TEXT,
 * so all it could see was `pb-[calc(${MOBILE_CONTENT_CLEARANCE_REM}rem+…)]`,
 * which is not a utility. The result was a padding class on the element that
 * resolved to `0px`, and `<main>` clearing nothing. The same class written as a
 * plain literal is emitted correctly.
 *
 * So the numbers now live in CSS (`@theme` in index.css) and these strings are
 * literal class names that reference them. That keeps both properties the
 * change needs: Tailwind can see every class, and the height is still declared
 * exactly once.
 */

/**
 * Tab bar height, excluding the safe-area inset (which is added on top at
 * render time). 64px = comfortably above the 44px touch floor at every label
 * length.
 *
 * THE COUNTERPART of `MOBILE_CONTENT_CLEARANCE_REM`. Both live in `@theme`; see
 * the module note above for why they cannot be interpolated here.
 */
export const MOBILE_BAR_HEIGHT_CLASS = 'min-h-(--mobile-bar-height)';

/**
 * `padding-bottom` for the scroll container that must clear the bar — the
 * scrollable region of the page.
 */
export const CONTENT_CLEARANCE_PADDING = 'pb-(--mobile-content-clearance)';

/**
 * Safe-area padding for the bar itself. A literal, and it resolves to 0px on a
 * desktop browser, which is correct.
 */
export const BAR_SAFE_AREA_PADDING = 'pb-[env(safe-area-inset-bottom)]';
