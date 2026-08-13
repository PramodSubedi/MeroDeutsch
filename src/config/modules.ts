/**
 * Single canonical module registry for MeroDeutsch.
 * Used by:
 * - Layout.tsx (moduleRoutes - which routes show ModuleChrome)
 * - ModuleSwitcher.tsx (navigation pills)
 * - Any other component that needs the complete module list
 */

export interface Module {
  id: string;
  path: string;
  label: string;
  labelDE: string;
  /** Whether this module should show ModuleChrome (back link + switcher) */
  showChrome: boolean;
}

export const MODULES: Module[] = [
  { id: 'alphabet', path: '/alphabet', label: 'Alphabet', labelDE: 'Alphabet', showChrome: true },
  { id: 'numbers', path: '/numbers', label: 'Numbers', labelDE: 'Zahlen', showChrome: true },
  { id: 'calendar', path: '/calendar', label: 'Calendar', labelDE: 'Kalender', showChrome: true },
  { id: 'articles', path: '/articles', label: 'Articles', labelDE: 'Artikel', showChrome: true },
  { id: 'greetings', path: '/greetings', label: 'Greetings', labelDE: 'Grüße', showChrome: true },
  { id: 'dictation', path: '/dictation', label: 'Dictation', labelDE: 'Diktat', showChrome: true },
  { id: 'grammar', path: '/grammar', label: 'Grammar', labelDE: 'Grammatik', showChrome: true },
  { id: 'pronunciation', path: '/pronunciation', label: 'Pronunciation', labelDE: 'Aussprache', showChrome: true },
  { id: 'roleplay', path: '/roleplay', label: 'Roleplay', labelDE: 'Rollenspiel', showChrome: true },
  { id: 'glossary', path: '/glossary', label: 'Glossary', labelDE: 'Glossar', showChrome: true },
  { id: 'stories', path: '/stories', label: 'Stories', labelDE: 'Geschichten', showChrome: true },
  { id: 'practice', path: '/practice', label: 'Practice', labelDE: 'Übung', showChrome: false },
];

/** Get all module paths that should show the ModuleChrome */
export function getModuleRoutes(): string[] {
  return MODULES.filter(m => m.showChrome).map(m => m.path);
}

/** Get all modules that should appear in the ModuleSwitcher navigation */
export function getNavigationModules(): Module[] {
  // All modules with showChrome enabled appear in the switcher
  return MODULES.filter(m => m.showChrome);
}
