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

/**
 * The skill a practice tool trains. Deliberately ONE primary skill per tool:
 * a tool like dictation genuinely spans listening AND writing, but a filter row
 * with two active values per card is noise. Secondary skills live in the copy
 * ("Listen and type words accurately"), not in the taxonomy.
 *
 * These are LEARNER-FACING verbs — what you'd tell someone you're working on —
 * not implementation terms.
 */
export type PracticeSkill = 'vocabulary' | 'grammar' | 'listening' | 'speaking' | 'writing';

/**
 * How you engage with the tool. Distinct from skill: skill = what you train,
 * mode = what the session feels like. Drives the "how do I want to spend the
 * next 5 minutes?" decision that a flat 11-card grid cannot express.
 */
export type PracticeMode = 'drill' | 'game' | 'sim' | 'reference';

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
  /** Primary skill trained. Powers the /practice filter row. */
  skill: PracticeSkill;
  /** CEFR level. All A1 today, but typed now so A2 arrives without a migration. */
  level: 'A1';
  /** Rough session length in minutes. Powers the "quick win" filter and the
      card's time chip. Estimate only — never used to gate or score anything. */
  minutes: number;
  /** Session shape. Rendered as a card chip. */
  mode: PracticeMode;
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
      color: 'text-accent-600 dark:text-accent-400',
      wellClass: 'bg-accent-50 dark:bg-accent-950/40 border-accent-100 dark:border-accent-900/50',
      order: 1,
      skill: 'vocabulary', level: 'A1', minutes: 5, mode: 'reference',
    },
  },
  {
    id: 'dictation', path: '/dictation', icon: Mic, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Listen and type words accurately', cta: 'Open Dictation',
      color: 'text-accent-600 dark:text-accent-400',
      wellClass: 'bg-accent-50 dark:bg-accent-950/40 border-accent-100 dark:border-accent-900/50',
      order: 2,
      skill: 'listening', level: 'A1', minutes: 5, mode: 'drill',
    },
  },
  {
    id: 'grammar', path: '/grammar', icon: FileText, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Master essential grammar rules', cta: 'Open Grammar',
      color: 'text-success-600 dark:text-success-400',
      wellClass: 'bg-success-50 dark:bg-success-950/40 border-success-100 dark:border-success-900/50',
      order: 3,
      skill: 'grammar', level: 'A1', minutes: 8, mode: 'reference',
    },
  },
  {
    id: 'roleplay', path: '/roleplay', icon: MessageSquare, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Practice real-world conversations', cta: 'Open Role-play',
      color: 'text-warning-600 dark:text-warning-400',
      wellClass: 'bg-warning-50 dark:bg-warning-950/40 border-warning-100 dark:border-warning-900/50',
      order: 4,
      skill: 'speaking', level: 'A1', minutes: 10, mode: 'sim',
    },
  },
  {
    id: 'pronunciation', path: '/pronunciation', icon: Volume2, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Improve speech and accent training', cta: 'Open Pronunciation',
      color: 'text-danger-600 dark:text-danger-400',
      wellClass: 'bg-danger-50 dark:bg-danger-950/40 border-danger-100 dark:border-danger-900/50',
      order: 5,
      skill: 'speaking', level: 'A1', minutes: 6, mode: 'drill',
    },
  },
  {
    // `title` is an intentional brand override: the route label is "Rapid Fire",
    // the product surface is "Rapid Blitz".
    id: 'rapid', path: '/rapid-fire', icon: Zap, showChrome: false, category: 'practice',
    practice: {
      blurb: '60-second mode-focused challenge game', cta: 'Choose Mode', title: 'Rapid Blitz',
      color: 'text-warning-600 dark:text-warning-400',
      wellClass: 'bg-warning-50 dark:bg-warning-950/40 border-warning-100 dark:border-warning-900/50',
      order: 6,
      skill: 'vocabulary', level: 'A1', minutes: 3, mode: 'game',
    },
  },
  {
    id: 'article-sprint', path: '/article-sprint', icon: BookA, showChrome: true, category: 'practice',
    practice: {
      blurb: 'der / die / das recall drill', cta: 'Start Sprint',
      color: 'text-fuchsia-600 dark:text-fuchsia-400',
      wellClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-100 dark:border-fuchsia-900/50',
      order: 7,
      skill: 'grammar', level: 'A1', minutes: 4, mode: 'drill',
    },
  },
  {
    id: 'vocab-trainer', path: '/vocab-trainer', icon: Layers, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Leveled flashcards & quizzes from the full word pool', cta: 'Start Training',
      color: 'text-accent-600 dark:text-accent-400',
      wellClass: 'bg-accent-50 dark:bg-accent-950/40 border-accent-100 dark:border-accent-900/50',
      order: 8,
      skill: 'vocabulary', level: 'A1', minutes: 8, mode: 'drill',
    },
  },
  {
    id: 'sentence-builder', path: '/sentence-builder', icon: Puzzle, showChrome: true, category: 'practice',
    practice: {
      blurb: 'Build German sentences word by word', cta: 'Start Building',
      color: 'text-cyan-600 dark:text-cyan-400',
      wellClass: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/50',
      order: 9,
      skill: 'writing', level: 'A1', minutes: 7, mode: 'drill',
    },
  },
  {
    id: 'games', path: '/games', icon: Gamepad2, showChrome: false, category: 'practice',
    practice: {
      blurb: 'Conjugation Tic-Tac-Toe & number code cracker', cta: 'Play Now',
      color: 'text-success-600 dark:text-success-400',
      wellClass: 'bg-success-50 dark:bg-success-950/40 border-success-100 dark:border-success-900/50',
      order: 10,
      skill: 'vocabulary', level: 'A1', minutes: 5, mode: 'game',
    },
  },
  {
    id: 'email-builder', path: '/email-builder', icon: Mail, showChrome: false, category: 'practice',
    practice: {
      blurb: 'Goethe A1 Schreiben — guided exam emails', cta: 'Start Writing',
      color: 'text-fuchsia-600 dark:text-fuchsia-400',
      wellClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-100 dark:border-fuchsia-900/50',
      order: 11,
      skill: 'writing', level: 'A1', minutes: 12, mode: 'sim',
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
  /** Practice metadata (see ModulePractice) — surfaced as card chips. */
  skill: PracticeSkill;
  level: 'A1';
  minutes: number;
  mode: PracticeMode;
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
      skill: m.practice.skill,
      level: m.practice.level,
      minutes: m.practice.minutes,
      mode: m.practice.mode,
    }));
}

/**
 * The filter row on /practice. Order is intentional (not alphabetical): it
 * follows the order a learner typically needs them — the receptive skills first,
 * production skills after. `all` is the reset value and is never a skill.
 */
export const PRACTICE_SKILLS: ReadonlyArray<{ id: PracticeSkill | 'all'; en: string; de: string }> = [
  { id: 'all', en: 'All', de: 'Alle' },
  { id: 'vocabulary', en: 'Vocabulary', de: 'Wortschatz' },
  { id: 'grammar', en: 'Grammar', de: 'Grammatik' },
  { id: 'listening', en: 'Listening', de: 'Hören' },
  { id: 'speaking', en: 'Speaking', de: 'Sprechen' },
  { id: 'writing', en: 'Writing', de: 'Schreiben' },
];

/** A session this short counts as a "quick win" for the time filter. */
export const PRACTICE_QUICK_WIN_MINUTES = 6;

/** Localized session-shape label for a card chip. */
export function practiceModeLabel(mode: PracticeMode, isDE: boolean): string {
  if (isDE) {
    return { drill: 'Übung', game: 'Spiel', sim: 'Simulation', reference: 'Nachschlagen' }[mode];
  }
  return { drill: 'Drill', game: 'Game', sim: 'Simulation', reference: 'Reference' }[mode];
}

/**
 * Localized skill label. Reuses the PRACTICE_SKILLS table so the filter chip
 * and the card chip can never spell the same skill two different ways.
 */
export function practiceSkillLabel(skill: PracticeSkill, isDE: boolean): string {
  const entry = PRACTICE_SKILLS.find((s) => s.id === skill);
  if (!entry) return skill;
  return isDE ? entry.de : entry.en;
}
