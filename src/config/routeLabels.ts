/**
 * src/config/routeLabels.ts
 *
 * Single canonical source of truth for human-readable route labels.
 * Used by Layout.tsx (header context chip) and Breadcrumb.tsx (crumb trail)
 * so the two can NEVER disagree. Covers every shell route; unknown paths
 * fall back to a neutral "Learn German / Deutsch lernen".
 */

import { CEFR_LEVELS } from '../data/cefrLevels';

/**
 * The level PAGES, generated from the level registry.
 *
 * Order matters and is not cosmetic: `contextLabelFor` / `labelForPath` return
 * the FIRST prefix match, so `/learn/a1` has to be tried before the bare
 * `/learn`. With the list reversed, the A1 course would be labelled "Learning
 * Path" in the header chip — the exact "two registries disagree" bug this file
 * exists to prevent, reintroduced one level down.
 *
 * Generated rather than hand-written so a new level cannot exist in
 * cefrLevels.ts and be missing from here.
 *
 * The label is the course's own name plus the level, because `/learn/a1` and
 * the bare `/learn` render the SAME page. Naming one "A1 Path" and the other
 * "Learning Path" would imply two different screens.
 */
const CEFR_LEVEL_LABELS: ReadonlyArray<readonly [string, { en: string; de: string }]> =
  CEFR_LEVELS.map((level) => [
    `/learn/${level.id}`,
    { en: `Learning Path · ${level.code}`, de: `Lernpfad · ${level.code}` },
  ]);

export const ROUTE_LABELS: ReadonlyArray<readonly [string, { en: string; de: string }]> = [
  ['/home', { en: 'Home', de: 'Startseite' }],
  // Order is load-bearing: the level pages come BEFORE the bare `/learn`, because
  // lookup returns the first PREFIX match. With `/learn` first, `/learn/a1`
  // matches it and the A1 course is labelled "Levels" in the header chip.
  ...CEFR_LEVEL_LABELS,
  // `/learn` IS the A1 course now, so it is labelled as a course, not as a
  // chooser. It used to read "Levels" because /learn WAS the grid; that
  // mapping is inverted and had to move to `/levels` with the page.
  ['/learn', { en: 'Learning Path', de: 'Lernpfad' }],
  // The level GRID, now the secondary `/levels` route. Must stay AFTER
  // `/learn` for the same prefix-ordering reason: `/levels` is a child of the
  // learn destination, and this list resolves the first match.
  ['/levels', { en: 'Levels', de: 'Niveaus' }],
  ['/dashboard', { en: 'Dashboard', de: 'Übersicht' }],
  ['/practice', { en: 'Practice', de: 'Übung' }],
  // A1 learning modules
  ['/alphabet', { en: 'Alphabet', de: 'Alphabet' }],
  ['/numbers', { en: 'Numbers', de: 'Zahlen' }],
  ['/calendar', { en: 'Calendar', de: 'Kalender' }],
  ['/articles', { en: 'Articles', de: 'Artikel' }],
  ['/greetings', { en: 'Greetings', de: 'Begrüßungen' }],
  ['/stories', { en: 'Stories', de: 'Geschichten' }],
  // Practice tools
  ['/glossary', { en: 'Glossary', de: 'Glossar' }],
  ['/dictation', { en: 'Dictation', de: 'Diktat' }],
  ['/grammar', { en: 'Grammar', de: 'Grammatik' }],
  ['/pronunciation', { en: 'Pronunciation', de: 'Aussprache' }],
  ['/roleplay', { en: 'Role-play', de: 'Rollenspiel' }],
  ['/rapid-fire', { en: 'Rapid Fire', de: 'Schnellfeuer' }],
  ['/sentence-builder', { en: 'Sentence Builder', de: 'Satzbau' }],
  ['/games', { en: 'German Games', de: 'Spiele' }],
  ['/email-builder', { en: 'Email Builder', de: 'E-Mail-Trainer' }],
  ['/article-sprint', { en: 'Article Sprint', de: 'Artikel-Sprint' }],
  ['/vocab-trainer', { en: 'Vocab Trainer', de: 'Wortschatz-Trainer' }],
  // Checkpoint / auth / misc
  ['/checkpoint', { en: 'Checkpoint', de: 'Checkpoint' }],
  ['/analytics', { en: 'Analytics', de: 'Analytik' }],
  ['/import', { en: 'Import', de: 'Import' }],
  ['/settings', { en: 'Settings', de: 'Einstellungen' }],
  ['/help', { en: 'Help', de: 'Hilfe' }],
  ['/feedback', { en: 'Send feedback', de: 'Feedback senden' }],
  ['/privacy', { en: 'Privacy', de: 'Datenschutz' }],
  ['/terms', { en: 'Terms', de: 'AGB' }],
];

/**
 * Exact-or-prefix label lookup with NO fallback. Used by the module registry
 * (practice card titles) so a card title can never disagree with the header
 * context chip or the breadcrumb for the same route.
 */
export function labelForPath(pathname: string, isDE: boolean): string {
  for (const [prefix, labels] of ROUTE_LABELS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return isDE ? labels.de : labels.en;
    }
  }
  return '';
}

/** Header context chip label for the current path. */
export function contextLabelFor(pathname: string, isDE: boolean): string {
  if (pathname === '/') return isDE ? 'Startseite' : 'Home';
  for (const [prefix, labels] of ROUTE_LABELS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return isDE ? labels.de : labels.en;
    }
  }
  return isDE ? 'Deutsch lernen' : 'Learn German';
}