/**
 * src/lib/slashCommands.ts — power-user shortcuts, parsed BEFORE the router.
 *
 * WHY THEY RUN FIRST
 * ------------------
 * `/practice` and "what should I practise" mean the same thing, but only the
 * slash version is unambiguous. Routing it through the keyword rules would let
 * "what should I practice" accidentally out-rank an explicit `/why`. So a
 * leading slash is authoritative and short-circuits classification entirely.
 *
 * The parser is pure and total: it never throws, and text that merely CONTAINS
 * a slash (`3/4`, `der/die/das`) is not a command.
 */

import type { Intent } from '../types/chatbot';

export interface ParsedCommand {
  /** Lower-cased command word, without the slash. Empty when not a command. */
  command: string;
  /** The rest of the line — the lookup term for `/vocab`. */
  argument: string;
  /** The intent this command forces. Null for `/help` and `/stop`. */
  intent: Intent | null;
}

/** Command word -> forced intent. `/stop` and `/help` act on the UI instead. */
const COMMAND_INTENTS: Record<string, Intent | null> = {
  progress: 'progress_check',
  practice: 'start_quiz',
  quiz: 'start_quiz',
  why: 'explain_mistake',
  vocab: 'vocab_lookup',
  course: 'curriculum_help',
  report: 'report',
  page: 'page_help',
  help: null,
  stop: null,
};

/**
 * Parse a message as a slash command.
 *
 * Only a slash at the VERY START counts, so "3/4" and "der/die/das" pass
 * through to the normal router untouched.
 */
export function parseCommand(raw: string): ParsedCommand {
  const text = raw.trim();
  const none: ParsedCommand = { command: '', argument: '', intent: null };
  if (!text.startsWith('/')) return none;

  // Strip a leading slash or backslash, split once on whitespace.
  const body = text.replace(/^[/\\]+/, '');
  const match = body.match(/^(\S+)\s*([\s\S]*)$/);
  if (!match) return none;

  const command = match[1].toLowerCase();
  if (!(command in COMMAND_INTENTS)) return none;

  return { command, argument: match[2].trim(), intent: COMMAND_INTENTS[command] };
}

/** True when the text should be treated as a command rather than a question. */
export function isCommand(raw: string): boolean {
  return parseCommand(raw).command !== '';
}

/** The `/help` listing, shown in the chat. */
export const COMMAND_HELP: ReadonlyArray<{ usage: string; en: string; de: string }> = [
  { usage: '/progress', en: 'Your XP, level and streak', de: 'XP, Level und Serie' },
  { usage: '/practice', en: 'Start a 3-question drill', de: 'Starte eine 3-Fragen-Übung' },
  { usage: '/why', en: 'Explain my latest mistake', de: 'Erkläre meinen letzten Fehler' },
  { usage: '/vocab <word>', en: 'Look up a word', de: 'Wort nachschlagen' },
  { usage: '/course', en: 'Where am I in the course?', de: 'Wo bin ich im Kurs?' },
  { usage: '/page', en: 'Explain this page', de: 'Erkläre diese Seite' },
  { usage: '/report', en: 'Weekly report', de: 'Wochenbericht' },
  { usage: '/help', en: 'This list', de: 'Diese Liste' },
];

/** The message shown when the command word is unknown. */
export function unknownCommandHelp(isDE: boolean): string {
  return isDE
    ? 'Unbekannter Befehl. Versuche /help.'
    : 'Unknown command. Try /help.';
}
