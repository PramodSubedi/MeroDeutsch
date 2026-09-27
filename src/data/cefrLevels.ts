/**
 * src/data/cefrLevels.ts — the CEFR level ladder shown at the top of /learn.
 * ──────────────────────────────────────────────────────────────────────────
 * ONE TABLE, so the tab bar, the page header and the coming-soon panel can
 * never disagree about which levels exist or what they are called. Adding C1
 * later is a data edit here, not a code change in three components.
 *
 * WHY EACH LEVEL IS ITS OWN ROUTE
 *   The course is a HUB and a PATH: `/learn` is the level grid (which levels
 *   exist, which one is open), and `/learn/:levelId` is that level's own page —
 *   its roadmap, its gates, its checkpoint. Two routes rather than one page
 *   with a query string, because they are two different jobs: a grid is a
 *   chooser you arrive at, a path is a place you stay. It also means each
 *   level can grow its own page (A2 will not be an A1 page with two tabs
 *   hidden) without a flag threaded through the existing screen.
 *
 *   Two things fall out of this for free: the browser Back button steps
 *   level -> grid -> level exactly as expected, and a pasted `/learn/a2` link
 *   survives a reload.
 *
 * WHY THE GRID IS THE DEFAULT ENTRY
 *   `/learn` is the level grid, and every "Learn" nav item already points at
 *   it. Links that mean "take me to MY course" (the checkpoint's "back to
 *   map", a module's "back to the learning path", the dashboard's "continue
 *   learning") are pointed at A1_PATH_ROUTE below instead, so a learner who
 *   is mid-course never gets a chooser in front of them. Those call sites
 *   import the constant rather than typing a path, so the grid and the path
 *   can never be confused for one another again.
 *
 * WHY A COMING-SOON LEVEL IS NOT A DISABLED BUTTON
 *   The app's locked rule is "soft lock: a gated thing is still reachable and
 *   explains itself" (.clinerules Part B, Soft lock). A greyed-out card that
 *   does nothing teaches nothing and strands the learner. So a coming-soon
 *   level is a REAL link to a real page that says what is being built and
 *   offers a way to ask for it — a destination instead of a dead end.
 *
 * HONEST BY CONSTRUCTION
 *   There is no scheduling information anywhere in this codebase, so none is
 *   invented here: the `planned` lists are topic areas, not dates, and the
 *   page never claims a release date. Flipping `status` to 'available' is the
 *   only edit required to ship a level once its curriculum exists.
 *
 * Content of record: this file (unlike the A1 campaign, which is JSON-driven —
 * see data/curriculum/index.ts). A2/B1 have no curriculum to point at yet, so
 * they declare none rather than faking modules.
 */

/** Stable id used in the URL and as a React key. Never translated. */
export type CefrLevelId = 'a1' | 'a2' | 'b1';

/**
 * `available` — has a curriculum behind it and renders the real path.
 * `coming-soon` — announced, reachable, and honest about being unbuilt.
 */
export type CefrLevelStatus = 'available' | 'coming-soon';

/** Every learner-facing string is EN/DE paired, like the rest of the app. */
export interface CefrLevelCopy {
  en: string;
  de: string;
}

export interface CefrLevel {
  id: CefrLevelId;
  /** The CEFR code exactly as printed: "A1", "A2", "B1". Same in both languages. */
  code: string;
  status: CefrLevelStatus;
  /** The level's name, e.g. "Beginner" / "Anfänger". */
  name: CefrLevelCopy;
  /** One line under the code in the tab. */
  tagline: CefrLevelCopy;
  /** A sentence for the level header. */
  description: CefrLevelCopy;
  /**
   * Topic areas the level is being built around. Deliberately a TOPIC list and
   * not a date: nothing here knows when anything ships, and an invented
   * quarter is a promise the roadmap cannot keep.
   */
  planned: CefrLevelCopy[];
}

/** The badge on a tab whose level is not built yet. */
export const COMING_SOON_LABEL: CefrLevelCopy = {
  en: 'Coming soon',
  de: 'Demnächst',
};

/** The level shown when a level is required but none was named. */
export const DEFAULT_CEFR_LEVEL_ID: CefrLevelId = 'a1';

/** The level GRID — the chooser. Also the route every "Learn" nav item points at. */
export const CEFR_LEVELS_ROUTE = '/learn';

export const CEFR_LEVELS: readonly CefrLevel[] = [
  {
    id: 'a1',
    code: 'A1',
    status: 'available',
    name: { en: 'Beginner', de: 'Anfänger' },
    tagline: { en: 'Your current course', de: 'Dein aktueller Kurs' },
    description: {
      en: 'The full A1 course: 15 modules across 5 stages, with a checkpoint at the end of every stage.',
      de: 'Der komplette A1-Kurs: 15 Module in 5 Etappen, mit einer Prüfung am Ende jeder Etappe.',
    },
    planned: [],
  },
  {
    id: 'a2',
    code: 'A2',
    status: 'coming-soon',
    name: { en: 'Elementary', de: 'Elementar' },
    tagline: { en: 'In the works', de: 'In Arbeit' },
    description: {
      en: 'A2 builds the past, the reasons behind it and the everyday life around it. It is being written now.',
      de: 'A2 baut die Vergangenheit, ihre Gründe und den Alltag drumherum auf. Wird gerade geschrieben.',
    },
    planned: [
      { en: 'Perfekt — talking about yesterday and last week', de: 'Perfekt — über gestern und letzte Woche sprechen' },
      { en: 'Wechselpräpositionen — in, an, auf …', de: 'Wechselpräpositionen — in, an, auf …' },
      { en: 'Nebensätze with weil, wenn and dass', de: 'Nebensätze mit weil, wenn und dass' },
      { en: 'Modal verbs — können, möchten, dürfen, müssen', de: 'Modalverben — können, möchten, dürfen, müssen' },
      { en: 'Adjectives — comparison and endings', de: 'Adjektive — Vergleich und Endungen' },
      { en: 'Everyday topics — shopping, health, appointments, housing', de: 'Alltagsthemen — Einkaufen, Gesundheit, Termine, Wohnen' },
    ],
  },
  {
    id: 'b1',
    code: 'B1',
    status: 'coming-soon',
    name: { en: 'Intermediate', de: 'Fortgeschritten' },
    tagline: { en: 'In the works', de: 'In Arbeit' },
    description: {
      en: 'B1 is where German stops being a list of sentences and starts being an argument. It is the long one — it comes after A2.',
      de: 'In B1 hört Deutsch auf, eine Liste von Sätzen zu sein, und wird zum Argument. Das ist der lange Bogen — er kommt nach A2.',
    },
    planned: [
      { en: 'Connectors for reason, contrast and time', de: 'Konnektoren für Grund, Gegenargument und Zeit' },
      { en: 'Indirect speech and reported questions', de: 'Indirekte Rede und Nebensatzfragen' },
      { en: 'Konjunktiv II for polite requests', de: 'Konjunktiv II für höfliche Bitten' },
      { en: 'Relative clauses', de: 'Relativsätze' },
      { en: 'Passive and light Nominalisierung', de: 'Passiv und einfache Nominalisierung' },
      { en: 'Longer texts — emails, reports, opinion pieces', de: 'Längere Texte — E-Mails, Berichte, Meinungsstücke' },
    ],
  },
];

/* ── routing ──────────────────────────────────────────────────────────────── */

/** True when this id belongs to a real level page (used by the breadcrumb). */
export function isCefrLevelId(value: unknown): value is CefrLevelId {
  return typeof value === 'string' && CEFR_LEVELS.some((level) => level.id === value);
}

/**
 * The level for a raw `:levelId` route segment. Returns null for anything
 * unknown so the route can redirect to the grid, rather than silently
 * rendering A1 at a URL that claims to be something else.
 */
export function parseCefrLevel(value: string | null | undefined): CefrLevelId | null {
  return isCefrLevelId(value) ? value : null;
}

/** The level record for an id. Falls back to the default rather than undefined. */
export function getCefrLevel(id: CefrLevelId): CefrLevel {
  return CEFR_LEVELS.find((level) => level.id === id) ?? CEFR_LEVELS[0]!;
}

/** True when this level has a real curriculum behind it. */
export function isCefrLevelAvailable(id: CefrLevelId): boolean {
  return getCefrLevel(id).status === 'available';
}

/** The level page for an id: `/learn/a1`. */
export function cefrLevelHref(id: CefrLevelId): string {
  return `${CEFR_LEVELS_ROUTE}/${id}`;
}

/**
 * THE "TAKE ME TO MY COURSE" CONSTANT.
 *
 * Used by everything that means "back to the path" — a module's back link, the
 * checkpoint's "back to map", the dashboard's "continue learning". It is a
 * PATH page, not the grid, so a learner already studying A1 is never dropped
 * onto a chooser. Import this instead of typing `/learn`; typing `/learn` is
 * how the two got conflated in the first place.
 */
export const A1_PATH_ROUTE = cefrLevelHref(DEFAULT_CEFR_LEVEL_ID);

/**
 * True when a pathname is one of the level PAGES (`/learn/a1`, not `/learn`).
 * The level pages carry their own header and an explicit "all levels" back
 * link, so the shell breadcrumb is suppressed for them (see Breadcrumb.tsx).
 */
export function isCefrLevelPath(pathname: string): boolean {
  return pathname.startsWith(`${CEFR_LEVELS_ROUTE}/`) && isCefrLevelId(pathname.slice(CEFR_LEVELS_ROUTE.length + 1));
}
