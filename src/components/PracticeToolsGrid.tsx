import type React from 'react';
import { Link } from 'react-router-dom';

interface ToolItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  buttonText: string;
}

const icons = {
  glossary: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  dictation: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  grammar: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  roleplay: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  pronunciation: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  ),
};

const tools: ToolItem[] = [
  {
    title: "Glossary",
    description: "Search German words and meanings",
    icon: icons.glossary,
    href: "/glossary",
    buttonText: "Open Glossary →",
  },
  {
    title: "Dictation",
    description: "Listen and type words accurately",
    icon: icons.dictation,
    href: "/dictation",
    buttonText: "Open Dictation →",
  },
  {
    title: "Grammar",
    description: "Master essential grammar rules",
    icon: icons.grammar,
    href: "/grammar",
    buttonText: "Open Grammar →",
  },
  {
    title: "Role-play",
    description: "Practice real-world conversations",
    icon: icons.roleplay,
    href: "/roleplay",
    buttonText: "Open Role-play →",
  },
  {
    title: "Pronunciation",
    description: "Improve speech and accent training",
    icon: icons.pronunciation,
    href: "/pronunciation",
    buttonText: "Open Pronunciation →",
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
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              {tool.icon}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{tool.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{tool.description}</p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors inline-flex items-center gap-1.5">
              <span>{tool.buttonText}</span>
              <span className="transform group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
