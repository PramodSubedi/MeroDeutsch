/**
 * src/config/routeLabels.ts
 *
 * Single canonical source of truth for human-readable route labels.
 * Used by Layout.tsx (header context chip) and Breadcrumb.tsx (crumb trail)
 * so the two can NEVER disagree. Covers every shell route; unknown paths
 * fall back to a neutral "Learn German / Deutsch lernen".
 */

export const ROUTE_LABELS: ReadonlyArray<readonly [string, { en: string; de: string }]> = [
  ['/home', { en: 'Home', de: 'Startseite' }],
  ['/learn', { en: 'A1 Path', de: 'A1-Lernpfad' }],
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