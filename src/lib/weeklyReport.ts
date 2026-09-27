/**
 * src/lib/weeklyReport.ts — "how did I actually do?" from real data only.
 *
 * NO INVENTED NUMBERS
 * -------------------
 * Every figure here comes from the live snapshot: XP, level, streak, per-skill
 * accuracy, the due queue, checkpoint passes. A 3B model asked to "summarise my
 * week" will invent a Tuesday. So the report is assembled HERE, as data, and
 * the model is only allowed to write the one-line commentary around it.
 */

import type { ContextSnapshot, ReportSection } from '../types/chatbot';
import { A1_CURRICULUM } from '../data/a1Path';

const SKILL_LABEL: Record<string, LocalizedLabel> = {
  grammar: { en: 'Grammar', de: 'Grammatik' },
  vocabulary: { en: 'Vocabulary', de: 'Wortschatz' },
  listening: { en: 'Listening', de: 'Hören' },
  spelling: { en: 'Spelling', de: 'Rechtschreibung' },
};

interface LocalizedLabel {
  en: string;
  de: string;
}

const pick = (label: LocalizedLabel | undefined, isDE: boolean): string =>
  label ? (isDE ? label.de : label.en) : '';

/** Build the report's data blocks. Pure — the model sees these as facts. */
export function buildReport(ctx: ContextSnapshot): ReportSection[] {
  const isDE = ctx.isDE;
  const measured = ctx.skills.filter((s) => s.total > 0);
  const best = measured.length ? measured.reduce((a, b) => (a.accuracy >= b.accuracy ? a : b)) : null;
  const worst = measured.length ? measured.reduce((a, b) => (a.accuracy <= b.accuracy ? a : b)) : null;

  const sections: ReportSection[] = [
    {
      title: isDE ? 'Level' : 'Level',
      value: `${ctx.xp.level} · ${ctx.xp.totalXp} XP · ${ctx.xp.rank}`,
    },
    {
      title: isDE ? 'Serie' : 'Streak',
      value: isDE
        ? `${ctx.streak.current} ${ctx.streak.current === 1 ? 'Tag' : 'Tage'} (Bestwert ${ctx.streak.longest})`
        : `${ctx.streak.current} day(s) · best ${ctx.streak.longest}`,
    },
    {
      title: isDE ? 'Kurs' : 'Course',
      value: isDE
        ? `Modul ${ctx.a1.unitIndex + 1} von ${A1_CURRICULUM.units.length} · ${ctx.a1.completedCount}/${ctx.a1.totalLearnNodes} Knoten · ${ctx.a1.passedCheckpoints} Prüfungen bestanden`
        : `Module ${ctx.a1.unitIndex + 1} of ${A1_CURRICULUM.units.length} · ${ctx.a1.completedCount}/${ctx.a1.totalLearnNodes} nodes · ${ctx.a1.passedCheckpoints} checkpoints passed`,
    },
  ];

  if (measured.length) {
    sections.push({
      title: isDE ? 'Fähigkeiten' : 'Skills',
      value: measured
        .map((s) => `${pick(SKILL_LABEL[s.category], isDE)} ${Math.round(s.accuracy)}% (${s.total})`)
        .join(' · '),
    });
  }
  if (best && worst && best.category !== worst.category) {
    sections.push({
      title: isDE ? 'Stärke / Schwäche' : 'Strength / Weakness',
      value: isDE
        ? `${pick(SKILL_LABEL[best.category], isDE)} ${Math.round(best.accuracy)}% ← → ${pick(SKILL_LABEL[worst.category], isDE)} ${Math.round(worst.accuracy)}%`
        : `${pick(SKILL_LABEL[best.category], isDE)} ${Math.round(best.accuracy)}% ← → ${pick(SKILL_LABEL[worst.category], isDE)} ${Math.round(worst.accuracy)}%`,
    });
  }
  if (reviewLine(ctx)) {
    sections.push({ title: isDE ? 'Warteschlange' : 'Review queue', value: reviewLine(ctx)! });
  }
  if (ctx.a1.pushNode) {
    sections.push({
      title: isDE ? 'Als Nächstes' : 'Next step',
      value: isDE ? ctx.a1.pushNode.labelDE : ctx.a1.pushNode.label,
    });
  }
  return sections;
}

function reviewLine(ctx: ContextSnapshot): string | null {
  if (ctx.review.total === 0) return null;
  return ctx.isDE
    ? `${ctx.review.total} Einträge, ${ctx.review.due} fällig`
    : `${ctx.review.total} items, ${ctx.review.due} due`;
}

/** Plain-text fallback, used when no model is reachable. */
export function reportAsText(ctx: ContextSnapshot): string {
  return buildReport(ctx)
    .map((s) => `${s.title}: ${s.value}`)
    .join('\n');
}
