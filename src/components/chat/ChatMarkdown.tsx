/**
 * src/components/chat/ChatMarkdown.tsx — render model output.
 *
 * SECURITY POSTURE
 * ----------------
 * `marked` is configured once, module-wide, and its output is injected via
 * `dangerouslySetInnerHTML`. Two facts are worth stating plainly:
 *
 *  1. `marked` v15 REMOVED its `sanitize` option. There is no supported way to
 *     strip raw HTML through the library any more.
 *  2. So every reply is passed through `lib/sanitizeHtml.ts` — an allowlist
 *     sanitiser — BEFORE it reaches the DOM. Do not "simplify" this away: the
 *     risk was previously documented as acceptable only because the sole
 *     producer is a model the learner runs on their own machine, and
 *     `settings.baseUrl` is user-editable *and* admin-settable via
 *     `chatbot_base_url`, so a shared or proxied model is one config row away.
 *
 * `breaks: true` because the model writes plain lines and single newlines
 * should render as breaks in a narrow sidebar.
 */

import { useMemo } from 'react';
import { marked } from 'marked';

import { sanitizeHtml } from '../../lib/sanitizeHtml';

marked.setOptions({ gfm: true, breaks: true });

export function ChatMarkdown({ text }: { text: string }) {
  // Sanitised on the way out, not on the way in: the input is the learner's or
  // the model's own markdown, and the thing that reaches innerHTML is the only
  // thing that needs constraining.
  const html = useMemo(
    () => sanitizeHtml(marked.parse(text, { async: false }) as string),
    [text],
  );
  return (
    <div
      className="text-body leading-relaxed [&_a]:underline [&_code]:rounded-sm [&_code]:bg-ink-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-1.5 [&_strong]:font-semibold [&_ul]:list-disc dark:[&_code]:bg-ink-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Flatten markdown to plain speakable text.
 *
 * Without this, `speakText` reads "Der Akkusativ braucht **den**" as literal
 * asterisks — the TTS engine has no idea what markdown is. Also drops code
 * fences, link targets and list bullets, which would otherwise be read aloud
 * character by character.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/(\*\*\*|\*\*|___|__|\*|_|~~)/g, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
