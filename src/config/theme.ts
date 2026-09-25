/**
 * src/config/theme.ts — QUIET PREMIUM semantic tokens
 * ─────────────────────────────────────────────────────────────────────────
 * These are SEMANTIC class names, not a raw palette. The palette itself
 * lives in `index.css` under `@theme`:
 *
 *   ink-*      the single neutral ramp (surfaces, borders, all text)
 *   accent-*   the single chromatic UI color (interactive / active / primary)
 *   success-*  emerald · warning-* amber · danger-* red
 *   gender-*   LOCKED pedagogical tokens (.clinerules Part E1) — never change
 *
 * Rules:
 *  · Surfaces are separated by HAIRLINE BORDERS, not shadows. Shadow is
 *    reserved for things that actually float (overlay, popover, modal).
 *  · Radius is three steps + full: sm = controls, md = buttons/cards,
 *    lg = panels/overlays.
 *  · Type is six steps: display, h1, h2, body (15px), meta (13px),
 *    micro (11px uppercase). `text-sm` is no longer the default body size.
 */

export const theme = {
  brand: {
    primary: '#2563eb',
    meroRed: '#dc2626',
    accentGold: '#f59e0b',
    meroText: 'Mero',
    deutschText: 'Deutsch',
    tagline: 'Learn German from zero — with Nepali support',
  },
  /**
   * Global German gender color system (LOCKED tokens — use everywhere, never
   * one-off hexes). This is the ONLY place in the app where color is allowed
   * to carry meaning, so it is exempt from the "one neutral + one accent" rule.
   *
   *   der (m)  = blue   #2563eb
   *   die (f)  = rose   #e11d48
   *   das (n)  = green  #059669
   *   die (pl) = amber  #d97706
   *
   * die/das/pl have no slot in the new `ink`/`accent`/`success`/`warning`
   * ramps, so they are expressed as explicit hex utilities. That is deliberate:
   * these four values are frozen by .clinerules Part E1.
   */
  gender: {
    der: { hex: '#2563eb', text: 'text-accent-600', bg: 'bg-accent-600', border: 'border-accent-600', darkText: 'dark:text-accent-400' },
    dieF: { hex: '#e11d48', text: 'text-[#e11d48]', bg: 'bg-[#e11d48]', border: 'border-[#e11d48]', darkText: 'dark:text-[#fb7185]' },
    das: { hex: '#059669', text: 'text-success-600', bg: 'bg-success-600', border: 'border-success-600', darkText: 'dark:text-success-500' },
    diePl: { hex: '#d97706', text: 'text-warning-600', bg: 'bg-warning-600', border: 'border-warning-600', darkText: 'dark:text-warning-500' },
  } as const,
  /**
   * Review-row module badges (Dashboard queue).
   *
   * Was 8 competing hues (blue/purple/green/pink/yellow/indigo/teal/orange)
   * keyed per-module, which made the queue read as confetti. Now three tones
   * keyed by module CATEGORY, so color carries structure:
   *   accent = learning module · ink = practice tool · success = checkpoint
   * Unknown moduleTypes fall through to `ink`.
   */
  moduleBadge: {
    // learning modules
    alphabet: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
    numbers: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
    calendar: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
    articles: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
    greetings: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
    grammar: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
    // practice tools
    pronunciation: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
    dictation: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
    // gates
    'a1-checkpoint': 'bg-success-50 text-success-700 dark:bg-success-950/50 dark:text-success-300',
    // fallback (open-ended moduleTypes: daily-challenge, stories, imported, …)
    fallback: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400',
  } as Record<string, string>,
  /**
   * The "field guide" editorial tier.
   *
   * The palette idea (ink / green / red / yellow) is ALREADY the token system —
   * `ink` is the neutral, `success`/`danger`/`warning` are the leaf / signal /
   * warm hues. So this pass does not introduce a palette; it introduces the
   * TYPOGRAPHIC voice that makes those colors read as editorial rather than
   * decorative:
   *   kicker  — small caps, widely tracked, muted. The "chapter" label.
   *   display — large, very tight tracking. The title.
   *
   * NOTE: `theme.gender` is untouched. Gender color is the one place color
   * carries pedagogical meaning (.clinerules Part E1) and those four hexes are
   * frozen; a brand refresh must never re-tint them.
   */
  type: {
    kicker: 'text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400',
    display: 'text-display font-extrabold tracking-[-0.03em] text-ink-950 dark:text-white',
    title: 'text-title font-bold tracking-[-0.02em] text-ink-900 dark:text-ink-50',
    section: 'text-section font-bold tracking-[-0.01em] text-ink-900 dark:text-ink-50',
  },
  page: {
    container: 'py-4',
    // display (28px) for page titles · h2 (17px) for section titles
    heading: 'text-2xl font-bold tracking-[-0.02em] text-ink-900 dark:text-ink-50',
    description: 'mb-4 text-body text-ink-500 dark:text-ink-400',
  },
  layout: {
    app: 'app-shell min-h-screen text-ink-900 dark:text-ink-100',
    // Sticky header. SOLID surface, hairline only — no glass/blur and no
    // solid brand block (both are locked decisions in .clinerules E2).
    header: 'h-16 border-b border-ink-200 bg-ink-50 sticky top-0 z-50 dark:border-ink-800 dark:bg-ink-950',
    // NOTE: no `max-w-*` here — the shell owns the single content column
    // (theme.layout.main), so the header and body share one axis.
    headerInner: 'h-16 px-4 sm:px-6 flex items-center justify-between gap-3',
    brand: 'text-lg font-bold flex items-center gap-1',
    nav: 'flex items-center gap-1',
    // Nav links: 44px touch target (was h-9 = 36px), quiet until active.
    navLinkActive: 'flex h-11 items-center rounded-md px-3 text-body font-semibold bg-accent-50 text-accent-700 transition focus-visible:outline-none dark:bg-accent-950/50 dark:text-accent-300',
    navLink: 'flex h-11 items-center rounded-md px-3 text-body font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50',
    toggleButton: 'inline-flex h-11 w-11 items-center justify-center rounded-md text-xs font-semibold text-ink-500 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200',
    // Two-state language switch (segmented control) — shows CURRENT mode via
    // the highlighted side, unlike the old target-state toggle button.
    langSwitch: {
      track: 'inline-flex h-11 items-center rounded-md bg-ink-100 p-0.5 text-xs font-semibold transition focus-visible:outline-none dark:bg-ink-800',
      optionActive: 'rounded-sm bg-white px-2.5 py-1 text-accent-600 shadow-sm dark:bg-ink-700 dark:text-accent-300',
      optionInactive: 'rounded-sm px-2.5 py-1 text-ink-500 transition hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200',
    },
    // Header icon buttons: ONE 44px touch target sitewide (was 42/44/56).
    themeButton: 'inline-flex h-11 w-11 items-center justify-center rounded-md text-base text-ink-500 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none active:scale-95 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200',
    // Header context chip — shows the current section on lg+ (Converged Shell).
    contextChip: 'inline-flex h-9 max-w-[260px] items-center gap-1.5 truncate rounded-full border border-ink-200 bg-ink-100 px-3 text-meta font-medium text-ink-700 dark:border-ink-800 dark:bg-ink-800/60 dark:text-ink-300',
    // Pinned bottom bar in the rail — the expand/collapse control lives WITH
    // the rail it toggles (never stranded in the header).
    sidebarToggleBar: 'flex h-12 shrink-0 items-center border-t border-ink-200 px-2 dark:border-ink-800',
    // Content column wrapper. The rail inset is applied ONCE by the shell as a
    // margin on <main>; this only centers the column (no double offset).
    main: 'mx-auto w-full max-w-7xl px-4 sm:px-6',
  },
  section: {
    // Border-led: a hairline on the canvas, not a floating white box.
    surface: 'mb-4 rounded-lg border border-ink-200 bg-white p-4 sm:p-6 dark:border-ink-800 dark:bg-ink-900',
    title: 'text-xl font-bold tracking-[-0.01em] text-ink-900 dark:text-ink-50',
    description: 'mt-2 text-body text-ink-500 dark:text-ink-400',
    controls: 'mt-3 flex flex-wrap gap-2',
    grid: 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
  },
  panel: {
    // NOTE: `panel.surface`, `card.surface` and `section.surface` were all the
    // SAME `rounded-2xl bg-white shadow-sm` box — which is exactly why the app
    // had no surface hierarchy. They are now three distinct tiers.
    surface: 'rounded-lg border border-ink-200 bg-white p-5 sm:p-6 dark:border-ink-800 dark:bg-ink-900',
    muted: 'rounded-lg border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-800/50',
    info: 'rounded-md border border-warning-200 bg-warning-50 p-3 text-body dark:border-warning-800/50 dark:bg-warning-950/30',
    accent: 'rounded-lg border border-accent-200 bg-accent-50 p-5 dark:border-accent-900/60 dark:bg-accent-950/30',
    tip: 'rounded-lg border border-ink-200 bg-ink-50 p-4 text-body dark:border-ink-800 dark:bg-ink-800/50',
  },
  /**
   * Layer ladder (documented — keep values consistent):
   *   sidebar rail = z-30 (full-height app shell) · header / bottom-nav /
   *   overlay dialogs = z-50 · mobile drawer = z-[55] · milestone toast = z-[60]
   * Toasts must stay above quiz UI (.clinerules E3); nothing else goes higher.
   */
  modal: {
    overlay: 'fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 p-4 backdrop-blur-sm',
    dialog: 'relative mt-[5%] w-full max-w-md rounded-lg border border-ink-200 bg-white p-6 shadow-xl dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100',
    close: 'absolute right-4 top-3 flex h-11 w-11 items-center justify-center text-2xl text-ink-400 transition hover:text-ink-800 dark:hover:text-white',
  },
  card: {
    // Default content card. Border-led, lifts on hover via border + tint
    // (NOT translate — movement on dense lists is noise).
    surface: 'rounded-md border border-ink-200 bg-white p-4 transition-colors duration-200 hover:border-ink-300 hover:bg-ink-25 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700',
    badge: 'w-10 text-center text-xl sm:text-2xl font-bold text-accent-600 dark:text-accent-400',
    title: 'text-lg font-bold text-ink-900 dark:text-ink-50',
    line: 'mt-1 text-body text-ink-500 dark:text-ink-400',
    footer: 'mt-1 text-meta text-ink-400 dark:text-ink-500',
    note: 'mt-2 text-meta font-medium text-accent-600 dark:text-accent-400',
  },
  input: 'w-full rounded-md border border-ink-300 bg-white px-3.5 py-2.5 text-body text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-accent-500 focus:ring-4 focus:ring-accent-100 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500 dark:hover:border-ink-700 dark:focus:border-accent-500 dark:focus:ring-accent-950/50',
  button: {
    // Every button is min-h-11 (44px) except the two `*Small` dense-row
    // variants (36px) — the old 42/44/56 mix is gone.
    primary: 'inline-flex min-h-[44px] items-center justify-center rounded-md bg-accent-600 px-4 py-2.5 text-body font-semibold text-white transition hover:bg-accent-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
    /** Compact primary for dense rows (quest claim, inline CTAs). */
    primarySmall: 'inline-flex min-h-[36px] items-center justify-center rounded-md bg-accent-600 px-3 py-1.5 text-meta font-semibold text-white transition hover:bg-accent-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
    /** Compact secondary for dense rows (quest actions). */
    secondarySmall: 'inline-flex min-h-[36px] items-center justify-center rounded-md border border-ink-200 bg-white px-3 py-1.5 text-meta font-semibold text-ink-700 transition hover:bg-ink-50 hover:text-ink-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
    secondary: 'inline-flex min-h-[44px] items-center justify-center rounded-md border border-ink-200 bg-white px-4 py-2.5 text-body font-semibold text-ink-700 transition hover:bg-ink-50 hover:text-ink-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
    danger: 'inline-flex min-h-[44px] items-center justify-center rounded-md bg-danger-600 px-4 py-2.5 text-body font-semibold text-white transition hover:bg-danger-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
    icon: 'inline-flex h-11 w-11 items-center justify-center rounded-md text-base text-ink-500 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200',
    pill: 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink-200 bg-white px-5 text-body font-semibold text-ink-700 transition hover:border-accent-400 hover:text-accent-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300',
    toggleActive: 'inline-flex min-h-[40px] items-center justify-center rounded-md bg-white px-4 text-body font-semibold text-accent-600 shadow-sm dark:bg-ink-700 dark:text-accent-300',
    toggleInactive: 'inline-flex min-h-[40px] items-center justify-center rounded-md px-4 text-body font-semibold text-ink-500 transition hover:bg-ink-100 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200',
  },
};

/** One gender token object (hex + Tailwind classes) from the locked `theme.gender` set. */
export type GenderToken = (typeof theme.gender)[keyof typeof theme.gender];

/**
 * Map a German article string to its global gender token.
 *   der → der · die → dieF (feminine) · das → das · plural → diePl · unknown → der.
 * Centralizes the der/die→dieF mapping so GenderBadge and review rows don't
 * re-implement it inline (locked decision C1.8 — no one-off hexes).
 * Accepts a plain string so both typed (`Article | 'plural'`) and regex-matched
 * call sites work.
 */
export function genderTokenFor(article: string): GenderToken {
  const key = article.trim().toLowerCase();
  if (key === 'die') return theme.gender.dieF;
  if (key === 'das') return theme.gender.das;
  if (key === 'plural' || key === 'diePl') return theme.gender.diePl;
  return theme.gender.der; // der (and any unknown) → masculine/der
}