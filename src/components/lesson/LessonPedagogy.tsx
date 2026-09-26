/**
 * src/components/lesson/LessonPedagogy.tsx
 *
 * The per-lesson TEACHING aids, rendered on the lesson page above the imported
 * document content.
 *
 * WHY THIS MOVED HERE
 * These blocks used to live inside each roadmap card on /learn. With the roadmap
 * reduced to fifteen lesson names, they had nowhere to go — and dropping them
 * would have silently deleted content the curriculum requires: the du/Sie
 * honorifics table, the EN/NE/DE word-order comparison, the um/am/im rule table,
 * the gender suffix note, the umlaut callout.
 *
 * The lesson page is where they belong anyway. The roadmap's job is "what order
 * do I learn in"; a three-column honorifics table is a study aid, and study aids
 * belong on the page you study on.
 *
 * NOTHING IS INVENTED HERE. Every block is rendered from the unit's own
 * `pedagogy` object in `data/curriculum/units/mNN.json`, and a unit that has no
 * `honorifics` simply renders no honorifics table. There is no fallback copy, so
 * a learner can trust that what they read is the curriculum's own material.
 *
 * ORDER: the short callouts first (they orient), then the tables (they teach).
 */
import { useLang } from '../../hooks/useLang';
import { HonorificsTable } from '../grammar/HonorificsTable';
import { GrammarComparisonTable } from '../grammar/GrammarComparisonTable';
import { GrammarRuleTable } from '../grammar/GrammarRuleTable';
import type { LocalizedLabel, UnitPedagogy } from '../../data/curriculum/schema';

type Localized = LocalizedLabel;

/** Best available string, preferring German in Nur-DE mode. */
function pick(value: Localized | undefined, isDE: boolean): string {
  if (!value) return '';
  return isDE ? value.de || value.en || '' : value.en || value.de || '';
}

/** A short teaching note: one line, accent bar on the left, no chrome. */
function Note({ children }: { children: string }) {
  return (
    <p className="border-l-2 border-accent-300 py-0.5 pl-3 text-body text-ink-700 dark:border-accent-700 dark:text-ink-200">
      {children}
    </p>
  );
}

export function LessonPedagogy({ pedagogy }: { pedagogy?: UnitPedagogy }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  if (!pedagogy) return null;

  const grammarNote = pick(pedagogy.grammarNote, isDE);
  const genderLegend = pick(pedagogy.genderLegend, isDE);
  const umlautCallout = pick(pedagogy.umlautCallout, isDE);
  const suffixNote = pick(pedagogy.suffixNote, isDE);

  // One section, and only if there is genuinely something in it.
  const hasAnything =
    grammarNote ||
    genderLegend ||
    umlautCallout ||
    suffixNote ||
    pedagogy.honorifics ||
    pedagogy.grammarComparison ||
    pedagogy.ruleTable;
  if (!hasAnything) return null;

  return (
    <section className="mt-8 border-t border-ink-200 pt-6 dark:border-ink-800">
      <h2 className="text-h2 font-semibold text-ink-900 dark:text-ink-50">
        {isDE ? 'Hinweise zur Grammatik' : 'Grammar notes'}
      </h2>

      <div className="mt-3 space-y-3">
        {grammarNote ? <Note>{grammarNote}</Note> : null}
        {umlautCallout ? <Note>{umlautCallout}</Note> : null}
        {suffixNote ? <Note>{suffixNote}</Note> : null}
        {genderLegend ? <Note>{genderLegend}</Note> : null}
      </div>

      {pedagogy.ruleTable && (
        <div className="mt-4">
          <GrammarRuleTable title={pedagogy.ruleTable.title} rows={pedagogy.ruleTable.rows} />
        </div>
      )}

      {pedagogy.honorifics && (
        <div className="mt-4">
          <HonorificsTable title={pedagogy.honorifics.title} rows={pedagogy.honorifics.rows} />
        </div>
      )}

      {pedagogy.grammarComparison && (
        <div className="mt-4">
          <GrammarComparisonTable
            title={pedagogy.grammarComparison.title}
            rows={pedagogy.grammarComparison.rows}
          />
        </div>
      )}
    </section>
  );
}
