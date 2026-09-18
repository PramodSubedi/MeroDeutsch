import { Link } from 'react-router-dom';
import { BookA, BookOpen, Mic, FileText, MessageSquare, Volume2, Zap, Layers, Puzzle, Gamepad2, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ToolItem {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  wellClass: string;
  href: string;
  buttonText: string;
}

/** All practice tools */
const tools: ToolItem[] = [
  {
    title: 'Glossary',
    description: 'Search German words and meanings',
    icon: BookOpen,
    iconColor: 'text-blue-600 dark:text-blue-400',
    wellClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50',
    href: '/glossary',
    buttonText: 'Open Glossary',
  },
  {
    title: 'Dictation',
    description: 'Listen and type words accurately',
    icon: Mic,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    wellClass: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/50',
    href: '/dictation',
    buttonText: 'Open Dictation',
  },
  {
    title: 'Grammar',
    description: 'Master essential grammar rules',
    icon: FileText,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    wellClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50',
    href: '/grammar',
    buttonText: 'Open Grammar',
  },
  {
    title: 'Role-play',
    description: 'Practice real-world conversations',
    icon: MessageSquare,
    iconColor: 'text-amber-600 dark:text-amber-400',
    wellClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50',
    href: '/roleplay',
    buttonText: 'Open Role-play',
  },
  {
    title: 'Pronunciation',
    description: 'Improve speech and accent training',
    icon: Volume2,
    iconColor: 'text-rose-600 dark:text-rose-400',
    wellClass: 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/50',
    href: '/pronunciation',
    buttonText: 'Open Pronunciation',
  },
  {
    title: 'Rapid Blitz',
    description: '60-second mode-focused challenge game',
    icon: Zap,
    iconColor: 'text-orange-600 dark:text-orange-400',
    wellClass: 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/50',
    href: '/rapid-blitz',
    buttonText: 'Choose Mode',
  },
  // Article Sprint (der/die/das) — now its own route + grid card (was inlined on /practice).
  {
    title: 'Article Sprint',
    description: 'der / die / das recall drill',
    icon: BookA,
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    wellClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-100 dark:border-fuchsia-900/50',
    href: '/article-sprint',
    buttonText: 'Start Sprint',
  },
  {
    title: 'Vocab Trainer',
    description: 'Leveled flashcards & quizzes from the full word pool',
    icon: Layers,
    iconColor: 'text-violet-600 dark:text-violet-400',
    wellClass: 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/50',
    href: '/vocab-trainer',
    buttonText: 'Start Training',
  },
  // v0.2.0 discoverability: Sentence Builder joins the practice grid.
  {
    title: 'Sentence Builder',
    description: 'Build German sentences word by word',
    icon: Puzzle,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    wellClass: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/50',
    href: '/sentence-builder',
    buttonText: 'Start Building',
  },
  // NotebookLM workbook mechanics — games hub + Goethe A1 Schreiben trainer.
  {
    title: 'German Games',
    description: 'Conjugation Tic-Tac-Toe & number code cracker',
    icon: Gamepad2,
    iconColor: 'text-teal-600 dark:text-teal-400',
    wellClass: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/50',
    href: '/games',
    buttonText: 'Play Now',
  },
  {
    title: 'Email Builder',
    description: 'Goethe A1 Schreiben — guided exam emails',
    icon: Mail,
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    wellClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-100 dark:border-fuchsia-900/50',
    href: '/email-builder',
    buttonText: 'Start Writing',
  },
];

interface PracticeToolsGridProps {
  /** Show only the first N tools (quick-access mode, e.g. on /learn). */
  limit?: number;
  /** Append a "See all tools" link to /practice (used with limit). */
  footerLink?: boolean;
}

export function PracticeToolsGrid({ limit, footerLink = false }: PracticeToolsGridProps) {
  const visible = limit ? tools.slice(0, limit) : tools;
  return (
    <div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
      {visible.map((tool, index) => (
        <Link
          key={index}
          to={tool.href}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 group-hover:scale-105 transition-transform ${tool.wellClass}`}>
              <tool.icon className={`w-5 h-5 ${tool.iconColor}`} strokeWidth={2} aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{tool.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{tool.description}</p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors inline-flex items-center gap-1">
              <span>{tool.buttonText}</span>
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
    {footerLink && limit && limit < tools.length && (
      <Link
        to="/practice"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-800 active:scale-95 dark:text-blue-300"
      >
        {`See all tools (${tools.length})`} <span aria-hidden="true">→</span>
      </Link>
    )}
    </div>
  );
}
