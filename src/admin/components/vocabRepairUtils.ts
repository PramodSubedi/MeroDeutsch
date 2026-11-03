/** Pure helpers for the vocab.repair form. Extracted so VocabularyRepair.tsx
 * only exports a React component (react/only-export-components). */

import type { RepairEditInput } from '../data/adminActions';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Parse `word<TAB>translation` lines into edits.
 *
 * Only `translation_en` is offered here. That is the field the corruption is in,
 * and every other field is a separate judgement the page above says needs a
 * human.
 */
export function parseRepairLines(text: string): { edits: RepairEditInput[]; problems: string[] } {
  const edits: RepairEditInput[] = [];
  const problems: string[] = [];

  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [word, ...rest] = line.split('\t');
    const value = rest.join('\t').trim();
    if (!value) {
      problems.push(`line ${i + 1}: needs WORD<TAB>TRANSLATION`);
      return;
    }
    if (!word?.trim()) {
      problems.push(`line ${i + 1}: missing the word`);
      return;
    }
    edits.push({ id: word.trim(), field: 'translationEn', value });
  });

  if (edits.length === 0 && problems.length === 0) problems.push('nothing to repair');
  return { edits, problems };
}

/** True when every line's first column looks like a UUID the server will accept. */
export function looksLikeIds(edits: RepairEditInput[]): boolean {
  return edits.every((e) => UUID_RE.test(e.id));
}