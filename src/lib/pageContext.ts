/**
 * src/lib/pageContext.ts — ground the companion in the current screen.
 *
 * WHAT THIS IS FOR
 * ----------------
 * "Explain this page" is only useful if Mero knows what "this page" is. The
 * available, always-correct grounding is:
 *
 *   1. the route's human label (from the app's own route table),
 *   2. the current module's REAL curriculum content — rule table, honorifics,
 *      grammar note — read from the same JSON the lesson pages render,
 *   3. this learner's mistakes IN THAT MODULE, from the review queue.
 *
 * Plus, when a page has published one (see `pageStateSignal`), the exact
 * subject it is showing: the current noun on /articles, the open word in the
 * Glossary, and so on.
 *
 * Nothing here is generated or inferred — it is assembled, not guessed.
 */

import { A1_CURRICULUM, A1_UNITS } from '../data/a1Path';
import { contextLabelFor } from '../config/routeLabels';
import { getPageFocus } from './pageStateSignal';
import type { ContextSnapshot } from '../types/chatbot';

export interface PageContext {
  label: string;
  /** Prompt-ready facts. Empty array when nothing is known. */
  facts: string[];
  /** The concrete thing on screen, when a page published it. */
  focus: { subject: string; detail?: string } | null;
  /** A ready-made question the UI can offer as a one-tap chip. */
  suggestedQuestion: string;
}

const pick = (l: { en: string; de: string } | undefined, isDE: boolean): string =>
  l ? (isDE ? l.de : l.en) : '';

export function buildPageContext(
  pathname: string,
  ctx: ContextSnapshot,
): PageContext {
  const isDE = ctx.isDE;
  const label = contextLabelFor(pathname, isDE);
  const facts: string[] = [];

  // 1. the current module, and its REAL teaching content
  const unitIndex = Math.max(0, Math.min(ctx.a1.unitIndex, A1_UNITS.length - 1));
  const unit = A1_CURRICULUM.units[unitIndex];
  facts.push(`Page: ${label} (${pathname})`);
  if (unit) {
    facts.push(`Course module: ${unitIndex + 1} "${pick(unit.title, isDE)}" — ${pick(unit.goal, isDE)}`);
    const ped = unit.pedagogy;
    if (ped?.grammarNote) facts.push(`Module note: ${pick(ped.grammarNote, isDE)}`);
    if (ped?.ruleTable?.rows.length) {
      for (const row of ped.ruleTable.rows.slice(0, 5)) {
        facts.push(`Rule: ${pick(row.label, isDE)} — ${pick(row.usage, isDE)} (e.g. ${pick(row.example, isDE)})`);
      }
    }
    if (ped?.honorifics?.rows.length) {
      const row = ped.honorifics.rows[0];
      facts.push(`Honorifics: ${row.pronoun.en} / ${row.pronoun.ne} — ${pick(row.usage, isDE)}`);
    }
    if (ped?.genderLegend) facts.push(`Gender legend: ${pick(ped.genderLegend, isDE)}`);
  }

  // 2. this learner's mistakes in the modules behind this page
  const mine = ctx.review.recent.filter((r) => r.moduleType);
  if (mine.length) {
    facts.push(
      `The learner's recent mistakes: ${mine
        .map((r) => `"${r.itemKey}" in ${r.moduleType} (answered "${r.userAnswer}", correct "${r.correctAnswer}")`)
        .join('; ')}`,
    );
  }

  // 3. what the page is literally showing, if it published a focus
  const published = getPageFocus();
  const focus = published ? { subject: published.subject, detail: published.detail } : null;
  if (published?.subject) {
    facts.push(`On screen right now: ${published.subject}${published.detail ? ` — ${published.detail}` : ''}`);
  }

  const suggestedQuestion =
    published?.suggestedQuestion ??
    (isDE ? 'Erkläre mir diese Seite' : 'Explain this page to me');

  return { label, facts, focus, suggestedQuestion };
}
