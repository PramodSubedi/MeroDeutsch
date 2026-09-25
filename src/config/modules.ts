import type { LucideIcon } from 'lucide-react';
import { BookA, Hash, Calendar, BookOpen, MessageCircle, Mic, FileText, Volume2, MessageSquare, Zap, Layers, Puzzle, Gamepad2, Mail, Library } from 'lucide-react';
import { labelForPath } from './routeLabels';

/**
 * Single canonical module registry for MeroDeutsch.
 *
 * ONE table now answers every question that used to need a hand-maintained
 * duplicate list (4 registries previously disagreed with each other):
 *  - Layout.tsx / Breadcrumb.tsx → which routes render <ModuleChrome />
 *      (getModuleRoutes, from `showChrome`)
 *  - PracticeToolsGrid.tsx       → the /practice card grid
 *      (getPracticeTools, from `practice`)
 *  - routeLabels.ts              → human labels; module titles are READ from
 *      there, so a label can never drift between the header chip, the
 *      breadcrumb and the practice card.
 *
 * `label`/`labelDE` were removed: they duplicated routeLabels.ts. `icon` and
 * `category` stay because the practice grid renders them.
 */

export interface ModulePractice {
  /** One-line card blurb. */
  blurb: string;
  /** Card CTA label. */
  cta: string;
  /** Icon color classes (text-*). */
  color: string;
  /** Icon well classes (bg-* + border-*). */
  wellClass: string;
  /** Explicit position on /practice so the card order stays stable. */
  order: number;
  /** Branding override when it intentionally differs from the route label. */
  title?: string;
}

export interface Module {
  id: string;
  path: string;
  icon: LucideIcon;
  /** Whether this module shows ModuleChrome (the "back to path" link). */
  showChrome: boolean;
  /** Learning modules vs practice tools. */
  category: 'learning' | 'practice';
  /** Present only for tools surfaced on the /practice hub. */
  practice?: ModulePractice;
}

export const MODULES: Module[] = [
  // ── A1 learning modules ───────────────────────────────────────────
  { id: 'alphabet', path: '/alphabet', icon: BookA, showChrome: true, category: 'learning' },
  { id: 'numbers', path: '/numbers', icon: Hash, showChrome: true, category: 'learning' },
  { id: 'calendar', path: '/calendar', icon: Calendar, showChrome: true, category: 'learning' },
  { id: 'articles', path: '/articles', icon: BookOpen, showChrome: true, category: 'learning' },
  { id: 'greetings', path: '/greetings', icon: MessageCircle, showChrome: true, category: 'learning' },
  { id: 'stories', path: '/stories', icon: Library, showChrome: true, category: 'learning' },

  // ── Practice tools surfaced on /practice ───────────────────────────
  {
    id: 'glossary', path: '/glossary', icon: BookOpen, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Search German words and meanings', cta: 'Open Glossary',
      color: 'text-blue-600 dark:text-blue-400',
      wellClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50',
      order: 1,
    },
  },
  {
    id: 'dictation', path: '/dictation', icon: Mic, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Listen and type words accurately', cta: 'Open Dictation',
      color: 'text-indigo-600 dark:text-indigo-400',
      wellClass: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/50',
      order: 2,
    },
  },
  {
    id: 'grammar', path: '/grammar', icon: FileText, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Master essential grammar rules', cta: 'Open Grammar',
      color: 'text-emerald-600 dark:text-emerald-400',
      wellClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50',
      order: 3,
    },
  },
  {
    id: 'roleplay', path: '/roleplay', icon: MessageSquare, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Practice real-world conversations', cta: 'Open Role-play',
      color: 'text-amber-600 dark:text-amber-400',
      wellClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50',
      order: 4,
    },
  },
  {
    id: 'pronunciation', path: '/pronunciation', icon: Volume2, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Improve speech and accent training', cta: 'Open Pronunciation',
      color: 'text-rose-600 dark:text-rose-400',
      wellClass: 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/50',
      order: 5,
    },
  },
  {
    // `title` is an intentional brand override: the route label is "Rapid Fire",
    // the product surface is "Rapid Blitz".
    id: 'rapid', path: '/rapid-fire', icon: Zap, showChrome: false, category: 'practice',
    practice: {
      blurb: '60-second mode-focused challenge game', cta: 'Choose Mode', title: 'Rapid Blitz',
      color: 'text-orange-600 dark:text-orange-400',
      wellClass: 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/50',
      order: 6,
    },
  },
  {
    id: 'article-sprint', path: '/article-sprint', icon: BookA, showChrome: true, category: 'practice',
    practice: {
      blurb: 'der / die / das recall drill', cta: 'Start Sprint',
      color: 'text-fuchsia-600 dark:text-fuchsia-400',
      wellClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-100 dark:border-fuchsia-900/50',
      order: 7,
    },
  },
  {
    id: 'vocab-trainer', path: '/vocab-trainer', icon: Layers, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Leveled flashcards & quizzes from the full word pool', cta: 'Start Training',
      color: 'text-violet-600 dark:text-violet-400',
      wellClass: 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/50',
      order: 8,
    },
  },
  {
    id: 'sentence-builder', path: '/sentence-builder', icon: Puzzle, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Build German sentences word by word', cta: 'Start Building',
      color: 'text-cyan-600 dark:text-cyan-400',
      wellClass: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/50',
      order: 9,
    },
  },
  {
    id: 'games', path: '/games', icon: Gamepad2, showChrome: false, category: 'practice',
    practice: {
      blurb: 'Conjugation Tic-Tac-Toe & number code cracker', cta: 'Play Now',
      color: 'text-teal-600 dark:text-teal-400',
      wellClass: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/50',
      order: 10,
    },
  },
  {
    id: 'email-builder', path: '/email-builder', icon: Mail, showChrome: false, category: 'practice',
    practice: {
      blurb: 'Goethe A1 Schreiben — guided exam emails', cta: 'Start Writing',
      color: 'text-fuchsia-600 dark:text-fuchsia-400',
      wellClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-100 dark:border-fuchsia-900/50',
      order: 11,
    },
  },

  // ── Hub (no card of its own) ───────────────────────────────────────
  { id: 'practice', path: '/practice', icon: BookOpen, showChrome: false, category: 'practice' },
];

/** Every route that renders <ModuleChrome /> (its "back to path" link). */
export function getModuleRoutes(): string[] {
  return MODULES.filter((m) => m.showChrome).map((m) => m.path);
}

export interface PracticeTool {
  /** Card title — from routeLabels unless the module overrides it. */
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  wellClass: string;
  href: string;
  buttonText: string;
}

/**
 * The /practice card grid, derived from the registry so adding a tool is a
 * one-line change instead of a second hand-maintained list. Titles are read
 * from routeLabels.ts (the single label source).
 */
export function getPracticeTools(): PracticeTool[] {
  return MODULES
    .filter((m): m is Module & { practice: ModulePractice } => Boolean(m.practice))
    .sort((a, b) => a.practice.order - b.practice.order)
    .map((m) => ({
      title: m.practice.title ?? labelForPath(m.path, false),
      description: m.practice.blurb,
      icon: m.icon,
      iconColor: m.practice.color,
      wellClass: m.practice.wellClass,
      href: m.path,
      buttonText: m.practice.cta,
    }));
}
