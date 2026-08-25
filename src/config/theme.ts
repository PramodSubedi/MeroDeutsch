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
   * Global German gender color system (locked tokens — use everywhere,
   * never one-off hexes):
   *   der (m)  = blue   #2563eb  (brand primary)
   *   die (f)  = red    #dc2626  (brand meroRed)
   *   das (n)  = green  #16a34a
   *   die (pl) = amber  #d97706
   * Class helpers map 1:1 to the default Tailwind palette so light/dark
   * variants stay consistent across Articles, Glossary, Blitz, review rows.
   */
  gender: {
    // Locked hexes per .clinerules Part E1: der #2563eb, die #e11d48,
    // das #059669, pl #d97706. Tailwind classes map 1:1 (red-600 = #e11d48,
    // emerald-600 = #059669) so light/dark stay consistent everywhere.
    der: { hex: '#2563eb', text: 'text-blue-600', bg: 'bg-blue-600', border: 'border-blue-600', darkText: 'dark:text-blue-400' },
    dieF: { hex: '#e11d48', text: 'text-red-600', bg: 'bg-red-600', border: 'border-red-600', darkText: 'dark:text-red-400' },
    das: { hex: '#059669', text: 'text-emerald-600', bg: 'bg-emerald-600', border: 'border-emerald-600', darkText: 'dark:text-emerald-400' },
    diePl: { hex: '#d97706', text: 'text-amber-600', bg: 'bg-amber-600', border: 'border-amber-600', darkText: 'dark:text-amber-400' },
  } as const,
  /**
   * Review-row module badges (Dashboard queue). Tokenized so the palette stays
   * consistent when new moduleTypes appear — unknown types fall back to slate.
   */
  moduleBadge: {
    alphabet: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    numbers: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    calendar: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    articles: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    greetings: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    grammar: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    pronunciation: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    dictation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    fallback: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    // Widened index signature: review rows carry open-ended moduleTypes
    // ('a1-checkpoint', 'daily-challenge', stories, …). Unknown keys fall
    // through to `fallback` at the call site (see DashboardPage badge).
  } as Record<string, string>,
  page: {
    container: 'py-4',
    // Type scale: page title = text-2xl · section title = text-xl · card title = text-lg
    heading: 'text-2xl font-bold text-slate-900 dark:text-slate-100',
    description: 'mb-4 text-sm text-slate-500 dark:text-slate-400',
  },
  layout: {
    app: 'min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100',
    // Light premium navbar: white surface + elevation (no solid brand block).
    // Brand blue is reserved for primary actions and the active nav state.
    header: 'h-16 bg-white shadow-sm sticky top-0 z-50 dark:bg-slate-900',
    headerInner: 'max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-3',
    brand: 'text-lg font-bold flex items-center gap-1',
    nav: 'flex items-center gap-1',
    // Nav links: h-9 targets, no solid block backgrounds — hover tint only.
    navLinkActive: 'flex h-9 items-center rounded-lg px-3 text-sm font-semibold bg-blue-50 text-blue-600 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:bg-blue-950/60 dark:text-blue-300',
    navLink: 'flex h-9 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
    toggleButton: 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
    // Two-state language switch (segmented control) — shows CURRENT mode via
    // the highlighted side, unlike the old target-state toggle button.
    langSwitch: {
      track: 'inline-flex h-9 items-center rounded-lg bg-slate-100 p-0.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:bg-slate-800',
      optionActive: 'rounded-md bg-white px-2.5 py-1 text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300',
      optionInactive: 'rounded-md px-2.5 py-1 text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
    },
    themeButton: 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-base text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
    main: 'mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8',
  },
  section: {
    // Elevation over borders: white cards on a slate-50 canvas.
    surface: 'mb-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900',
    title: 'text-xl font-bold text-slate-900 dark:text-slate-100',
    description: 'mt-2 text-sm text-slate-500 dark:text-slate-400',
    controls: 'mt-3 flex flex-wrap gap-2',
    grid: 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
  },
  panel: {
    surface: 'rounded-2xl bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900',
    muted: 'rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60',
    info: 'rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-900/20',
    accent: 'rounded-2xl bg-blue-50 p-5 shadow-sm dark:bg-blue-950/40',
    tip: 'rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60',
  },
  /**
   * Layer ladder (documented — keep values consistent):
   *   header / bottom-nav / overlay dialogs = z-50 · milestone toast = z-[60]
   * Toasts must stay above quiz UI (.clinerules E3); nothing else goes higher.
   */
  modal: {
    overlay: 'fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm',
    dialog: 'relative mt-[5%] w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 dark:text-slate-100',
    close: 'absolute right-4 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center text-2xl text-slate-400 hover:text-slate-800 dark:hover:text-white',
  },
  card: {
    surface: 'rounded-2xl bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900',
    badge: 'w-10 text-center text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400',
    title: 'text-lg font-bold text-slate-900 dark:text-slate-100',
    line: 'mt-1 text-sm text-slate-500 dark:text-slate-400',
    footer: 'mt-1 text-xs text-slate-400 dark:text-slate-400',
    note: 'mt-2 text-xs font-medium text-blue-600 dark:text-blue-400',
  },
  input: 'w-full rounded-lg border border-slate-200 bg-white p-3 text-base text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40',
  button: {
    primary: 'rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
    /** Compact primary for dense rows (quest claim, inline CTAs) — no !important overrides needed. */
    primarySmall: 'rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
    secondary: 'rounded-lg bg-blue-50 px-4 py-3 text-base font-semibold text-blue-600 transition hover:bg-blue-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40',
    danger: 'rounded-lg bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
    icon: 'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-base text-blue-600 transition hover:bg-blue-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-800',
    pill: 'rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200',
    toggleActive: 'rounded-lg bg-white px-4 py-3 text-base font-semibold text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300',
    toggleInactive: 'rounded-lg px-4 py-3 text-base font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
  },
};