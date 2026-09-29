/**
 * src/components/run/steps/ReferenceSteps.tsx
 *
 * The reference half of a run: the steps that teach and are never scored.
 *
 * ── WHY THEY ARE IN ONE FILE ────────────────────────────────────────────────
 * Nine small components that share one concern — "show the learner something,
 * then let them continue" — and no state between them. Splitting them across nine
 * files would mean nine import lines to get a container's padding right, and nine
 * places to re-check a contrast decision.
 *
 * ── THE ONE PRESENTATION RULE ───────────────────────────────────────────────
 * No step here uses the imperative voice. A lesson that says "Click the button"
 * teaches the app; one that says "Which sentence is correct?" teaches German.
 * Navigation language belongs to the runner, not to the content.
 *
 */
import { useLang } from '../../../hooks/useLang';
import { AudioButton } from '../../AudioButton';
import type {
  CultureStep,
  DialogueStep,
  ExplainStep,
  IntroStep,
  SummaryStep,
  TipStep,
  TrapStep,
  WordStep,
} from '../../../data/curriculum/steps';

const CARD = 'rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900';
const HEAD = 'text-base font-semibold text-ink-900 dark:text-ink-50';

/**
 * Localised label, preferring German when the app is in German mode.
 *
 * ── WHY THIS IS DEFENSIVE ────────────────────────────────────────────────────
 * This is the single place a step's title is read, and it is the one that
 * crashed. A generated `culture` step with no `title` reached `CultureStepView`,
 * which called `label(step.title)`, which dereferenced `.de` on `undefined` — a
 * TypeError that took the whole lesson down.
 *
 * A missing heading is a cosmetic defect. A thrown TypeError is a blank page, and
 * content mistakes must never be able to do that. So the fallback is a non-empty
 * string and the caller decides whether a heading is needed at all.
 */
function label(l: { en?: string; de?: string } | undefined, isDE: boolean, fallback = ''): string {
  if (!l) return fallback;
  if (isDE && l.de) return l.de;
  return l.en || l.de || fallback;
}

/** True when a label has anything to show, so no empty `<h2>` is rendered. */
function hasLabel(l: { en?: string; de?: string } | undefined): boolean {
  return Boolean(l?.en || l?.de);
}

/**
 * A run of text with the author's own emphasis, as data rather than as elements.
 *
 * Parsing markdown into a small typed list instead of straight to JSX is what
 * makes the cross-reference pass possible: the vocabulary link has to run
 * INSIDE a bold span, and it cannot do that by inspecting React children.
 */
type Span = { text: string; bold?: boolean; code?: boolean };

/**
 * Parse a small, deliberate subset of inline markdown: `**bold**` and `` `code` ``.
 *
 * Not a markdown parser. The full `marked` bundle is deliberately kept out of the
 * main chunk (`Layout.tsx` lazy-loads the chat panel for exactly this reason), and
 * an explanation only ever needs emphasis. Anything else is shown literally, which
 * is better than silently dropping text.
 */
function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
    if (part === '') continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      spans.push({ text: part.slice(2, -2), bold: true });
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      spans.push({ text: part.slice(1, -1), code: true });
    } else {
      spans.push({ text: part });
    }
  }
  return spans;
}

function renderSpan(span: Span, key: React.Key): React.ReactNode {
  if (span.code) {
    return (
      <code key={key} className="rounded bg-ink-100 px-1 font-mono text-[0.85em] dark:bg-ink-800">
        {span.text}
      </code>
    );
  }
  if (span.bold) {
    return (
      <strong key={key} className="font-semibold text-ink-900 dark:text-ink-50">
        {span.text}
      </strong>
    );
  }
  return <span key={key}>{span.text}</span>;
}

function inline(text: string): React.ReactNode[] {
  return parseInline(text).map(renderSpan);
}

/**
 * Prose into paragraphs and bullets.
 *
 * `body` is what a generator writes: blank-line separated paragraphs, with
 * `- ` (or `* `) starting a bullet. It is rendered rather than refused, because
 * refusing it means every generated explanation fails validation for a field the
 * author had no way to know about.
 */
function prose(body: string): { paragraphs: string[]; bullets: string[] } {
  const paragraphs: string[] = [];
  const bullets: string[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const blockBullets = lines.filter((l) => /^[-*]\s+/.test(l));
    if (blockBullets.length === lines.length && lines.length > 0) {
      bullets.push(...blockBullets.map((l) => l.replace(/^[-*]\s+/, '')));
    } else if (lines.length > 0) {
      paragraphs.push(lines.join(' '));
    }
  }
  return { paragraphs, bullets };
}

/* ── objectives ───────────────────────────────────────────────────────────── */

export function IntroStepView({ step }: { step: IntroStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const lines = isDE && step.objectives.de?.length ? step.objectives.de : step.objectives.en;

  return (
    <section className={CARD} aria-labelledby="step-intro">
      <h2 id="step-intro" className={HEAD}>
        {isDE ? 'Das lernst du' : 'What you will learn'}
      </h2>
      {step.meta ? <p className="mt-0.5 text-micro text-ink-500 dark:text-ink-400">{step.meta}</p> : null}
      <ul className="mt-3 space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-800 dark:text-ink-100">
            <span aria-hidden="true" className="text-accent-600 dark:text-accent-400">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── one word ─────────────────────────────────────────────────────────────── */

export function WordStepView({ step }: { step: WordStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const e = step.entry;
  const example = e.examples?.[0];
  // `LexiconEntry` has no German gloss field — the German IS the headword. So the
  // gloss is always the English, and the two bridge languages (English, Nepali)
  // are shown together: for a learner whose first language is neither, the pair is
  // the point rather than a duplicate.
  const showNepali = !isDE && e.ne.trim() !== '' && e.ne !== e.en;

  return (
    <section className={CARD} aria-label={e.word}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-semibold text-ink-900 dark:text-ink-50">
            {e.article && e.article !== 'plural' ? (
              <span className="mr-1.5 text-ink-500 dark:text-ink-400">{e.article}</span>
            ) : null}
            {e.word}
            {e.plural ? <span className="ml-1.5 text-sm font-normal text-ink-500 dark:text-ink-400">pl. {e.plural}</span> : null}
          </p>
          {e.ipa ? <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{e.ipa}</p> : null}
          <p className="mt-1 text-sm text-ink-800 dark:text-ink-100">{e.en}</p>
          {showNepali ? <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{e.ne}</p> : null}
        </div>
        <AudioButton word={e.word} lang="de" className="shrink-0" />
      </div>
      {example ? (
        <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
          <p className="text-sm text-ink-800 dark:text-ink-100">{example.de}</p>
          <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{example.en}</p>
          {!isDE && example.ne ? <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{example.ne}</p> : null}
        </div>
      ) : null}
      {step.active ? (
        <p className="mt-3 text-micro font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-400">
          {isDE ? 'Aktiv — selbst benutzen' : 'Active — you produce this'}
        </p>
      ) : null}
    </section>
  );
}

/* ── prose, table, callout, bullets ───────────────────────────────────────── */

export function ExplainStepView({ step }: { step: ExplainStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { paragraphs, bullets: bodyBullets } = prose(step.body ?? '');
  const bullets = [...bodyBullets, ...(step.bullets ?? [])];

  return (
    <section className={CARD} aria-label={label(step.title, isDE, 'Explanation')}>
      {hasLabel(step.title) ? <h2 className={HEAD}>{label(step.title, isDE)}</h2> : null}
      {paragraphs.map((p, i) => (
        <p key={`p${i}`} className="mt-2 max-w-prose text-sm leading-relaxed text-ink-800 dark:text-ink-100">
          {inline(p)}
        </p>
      ))}
      {bullets.length > 0 ? (
        <ul className="mt-2 max-w-prose list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-800 dark:text-ink-100">
          {bullets.map((b, i) => (
            <li key={`b${i}`}>{inline(b)}</li>
          ))}
        </ul>
      ) : null}
      {step.notes?.map((n, i) => (
        <p key={`n${i}`} className="mt-2 text-sm text-ink-800 dark:text-ink-100">
          {isDE ? n.de || n.en : n.en}
        </p>
      ))}
      {step.table ? <StepTable columns={step.table.columns} rows={step.table.rows} /> : null}
      {step.callout ? (
        // These are 70+ character decision charts with no break opportunity, so
        // they get their own scroll container rather than pushing a phone wider.
        <pre className="mt-3 overflow-x-auto rounded-md bg-ink-50 p-3 text-xs leading-relaxed text-ink-900 dark:bg-ink-950 dark:text-ink-100">
          {step.callout}
        </pre>
      ) : null}
    </section>
  );
}

/**
 * A data table with a horizontally scrollable wrapper.
 *
 * The scroll container is not a nicety: the authored grammar tables are 5-7
 * columns wide and overflow a 360px viewport, which would otherwise widen the
 * whole page and push the run's own controls off screen.
 */
export function StepTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" className="border-b border-ink-200 px-2 py-1.5 font-semibold text-ink-900 dark:border-ink-700 dark:text-ink-50">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 align-top text-ink-800 dark:text-ink-100">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── traps ────────────────────────────────────────────────────────────────── */

export function TrapStepView({ step }: { step: TrapStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <section className={CARD} aria-label={isDE ? 'Häufiger Fehler' : 'Common trap'}>
      <h2 className={HEAD}>{isDE ? 'Häufiger Fehler' : 'Common trap'}</h2>
      {step.wrong ? (
        <div className="mt-3 rounded-md border border-danger-200 bg-danger-50 p-3 dark:border-danger-900 dark:bg-danger-950/40">
          <p className="text-micro font-semibold uppercase tracking-wider text-danger-700 dark:text-danger-300">{isDE ? 'Nicht so' : 'Not this'}</p>
          <p className="mt-1 text-sm text-ink-900 dark:text-ink-50">{step.wrong}</p>
        </div>
      ) : null}
      {step.right ? (
        <div className="mt-2 rounded-md border border-success-200 bg-success-50 p-3 dark:border-success-900 dark:bg-success-950/40">
          <p className="text-micro font-semibold uppercase tracking-wider text-success-700 dark:text-success-300">{isDE ? 'Sondern so' : 'Instead'}</p>
          <p className="mt-1 text-sm text-ink-900 dark:text-ink-50">{step.right}</p>
        </div>
      ) : null}
      <p className="mt-3 text-sm text-ink-800 dark:text-ink-100">{isDE ? step.note.de || step.note.en : step.note.en}</p>
      {!isDE && step.note.ne ? <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{step.note.ne}</p> : null}
    </section>
  );
}

/* ── culture ──────────────────────────────────────────────────────────────── */

/**
 * A tip callout.
 *
 * Visually distinct from a trap on purpose: a trap is amber and framed as a
 * warning, a tip is sky and framed as an anchor. The two carry opposite
 * instructions — "don't do this" versus "carry this" — and giving them the same
 * treatment would make advice look like a mistake.
 */
export function TipStepView({ step }: { step: TipStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <aside
      className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40"
      aria-label={isDE ? 'Tipp' : 'Tip'}
    >
      <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
        <span aria-hidden="true">💡</span>
        {step.title ? label(step.title, isDE) : isDE ? 'Tipp' : 'Tip'}
      </p>
      <p className="mt-1.5 text-sm text-ink-900 dark:text-ink-50">{inline(step.body)}</p>
      {step.example ? (
        <p lang="de" className="mt-2 border-l-2 border-sky-300 pl-2 text-sm text-ink-800 dark:border-sky-800 dark:text-ink-100">
          {step.example}
        </p>
      ) : null}
    </aside>
  );
}

export function CultureStepView({ step }: { step: CultureStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <section className={CARD} aria-label={label(step.title, isDE, 'Cultural note')}>
      {/* No heading when the step has none. `label` already survives a missing
          title; this avoids emitting an empty `<h2>` on top of it. */}
      {hasLabel(step.title) ? <h2 className={HEAD}>{label(step.title, isDE)}</h2> : null}
      <ul className="mt-2 space-y-2">
        {(Array.isArray(step.body) ? step.body : [step.body ?? ''])
          .filter((line) => line.trim() !== '')
          .map((line, i) => (
            <li key={i} className="text-sm text-ink-800 dark:text-ink-100">
              {inline(line)}
            </li>
          ))}
      </ul>
    </section>
  );
}

/* ── dialogue ─────────────────────────────────────────────────────────────── */

export function DialogueStepView({ step }: { step: DialogueStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // `LangMode` is only 'normal' | 'german' — there is no separate Nur-DE mode, so
  // the glosses are hidden only when the STEP author says so. Hiding them by
  // language mode would be a product decision made in the presentation layer,
  // where the content author cannot see or override it.
  const hideGloss = step.showTranslations === false;
  const turns = step.turns ?? [];

  return (
    <section className={CARD} aria-label={label(step.title, isDE, 'Dialogue')}>
      {hasLabel(step.title) ? <h2 className={HEAD}>{label(step.title, isDE)}</h2> : null}
      {step.scenario ? <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{label(step.scenario, isDE)}</p> : null}
      <ol className="mt-3 space-y-2">
        {turns.map((turn, i) => (
          <li key={i} className="rounded-md bg-ink-50 p-2.5 dark:bg-ink-800/60">
            <p className="text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{turn.speaker}</p>
            <div className="mt-1 flex items-start justify-between gap-2">
              {/* The audio button speaks `turn.de`. The contract already requires
                  it, and the guard is here so a missing one costs a missing
                  button rather than the whole dialogue. */}
              <p lang="de" className="text-sm text-ink-900 dark:text-ink-50">
                {turn.de}
              </p>
              {turn.de ? <AudioButton word={turn.de} lang="de" showSpeedToggle={false} className="shrink-0" /> : null}
            </div>
            {!hideGloss && turn.en ? <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{turn.en}</p> : null}
            {!hideGloss && !isDE && turn.ne ? <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{turn.ne}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── summary ──────────────────────────────────────────────────────────────── */

export function SummaryStepView({ step }: { step: SummaryStep }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <section className={CARD} aria-label={isDE ? 'Zusammenfassung' : 'Summary'}>
      <h2 className={HEAD}>{step.title ? label(step.title, isDE) : isDE ? 'Geschafft' : 'You have reached the end'}</h2>
      <p className="mt-2 text-sm text-ink-800 dark:text-ink-100">
        {isDE
          ? 'Du hast diese Lektion durchgearbeitet. Wiederhole sie jederzeit über die Werkzeuge im Seitenbereich.'
          : 'You have worked through this lesson. Revisit it any time with the tools in the side rail.'}
      </p>
    </section>
  );
}
