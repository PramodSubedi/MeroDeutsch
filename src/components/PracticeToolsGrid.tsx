import { Link } from 'react-router-dom';
import { BookOpen, Mic, FileText, MessageSquare, Volume2, Zap } from 'lucide-react';
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
];

export function PracticeToolsGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
      {tools.map((tool, index) => (
        <Link
          key={index}
          to={tool.href}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        >
          <div>
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
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
  );
}
