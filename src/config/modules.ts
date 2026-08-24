import type { LucideIcon } from 'lucide-react';
import { BookA, Hash, Calendar, BookOpen, MessageCircle, Mic, BookText, Volume2, Users, Library, Zap, Layers, Puzzle } from 'lucide-react';

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
  icon: LucideIcon;
  /** Whether this module should show ModuleChrome (back link + switcher) */
  showChrome: boolean;
  /** Module category for visual grouping */
  category: 'learning' | 'practice';
}

export const MODULES: Module[] = [
  // A1 Learning Modules
  { id: 'alphabet', path: '/alphabet', label: 'Alphabet', labelDE: 'Alphabet', icon: BookA, showChrome: true, category: 'learning' },
  { id: 'numbers', path: '/numbers', label: 'Numbers', labelDE: 'Zahlen', icon: Hash, showChrome: true, category: 'learning' },
  { id: 'calendar', path: '/calendar', label: 'Calendar', labelDE: 'Kalender', icon: Calendar, showChrome: true, category: 'learning' },
  { id: 'articles', path: '/articles', label: 'Articles', labelDE: 'Artikel', icon: BookOpen, showChrome: true, category: 'learning' },
  { id: 'greetings', path: '/greetings', label: 'Greetings', labelDE: 'Grüße', icon: MessageCircle, showChrome: true, category: 'learning' },
  { id: 'stories', path: '/stories', label: 'Stories', labelDE: 'Geschichten', icon: Library, showChrome: true, category: 'learning' },
  // Practice Tools
  { id: 'dictation', path: '/dictation', label: 'Dictation', labelDE: 'Diktat', icon: Mic, showChrome: true, category: 'practice' },
  { id: 'grammar', path: '/grammar', label: 'Grammar', labelDE: 'Grammatik', icon: BookText, showChrome: true, category: 'practice' },
  { id: 'pronunciation', path: '/pronunciation', label: 'Pronunciation', labelDE: 'Aussprache', icon: Volume2, showChrome: true, category: 'practice' },
  { id: 'roleplay', path: '/roleplay', label: 'Roleplay', labelDE: 'Rollenspiel', icon: Users, showChrome: true, category: 'practice' },
  { id: 'glossary', path: '/glossary', label: 'Glossary', labelDE: 'Glossar', icon: BookOpen, showChrome: true, category: 'practice' },
  { id: 'rapid', path: '/rapid-fire', label: 'Rapid Fire', labelDE: 'Schnellfeuer', icon: Zap, showChrome: false, category: 'practice' },
  // v0.2.0 discoverability: the two strongest Supabase-vocab consumers are now
  // first-class modules (switcher pills + chrome routes).
  { id: 'vocab-trainer', path: '/vocab-trainer', label: 'Vocab Trainer', labelDE: 'Wortschatz-Trainer', icon: Layers, showChrome: true, category: 'practice' },
  { id: 'sentence-builder', path: '/sentence-builder', label: 'Sentence Builder', labelDE: 'Satzbau', icon: Puzzle, showChrome: true, category: 'practice' },
  { id: 'practice', path: '/practice', label: 'Practice', labelDE: 'Übung', icon: BookOpen, showChrome: false, category: 'practice' },
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
