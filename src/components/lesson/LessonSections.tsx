/**
 * src/components/lesson/LessonSections.tsx
 *
 * Renders a unit's DOCUMENT content — the material authored in
 * `src/data/curriculum/units/mNN.json` under `lesson` (objectives, trilingual
 * lexicon, grammar blocks, traps, culture notes, dialogue, practice bank,
 * mini-game spec).
 *
 * WHY A REGISTRY
 * Every block is chosen by its `type` string, so adding a NEW kind of lesson
 * content is one component plus one line in `SECTION_RENDERERS` — no changes
 * here, on the lesson page, or in the unit files' consumers. The alternative
 * (a long if/else in a page) is exactly the pattern this refactor was meant to
 * remove.
 *
 * NUR-DE (C1.5)
 * English and Nepali helper text is hidden when `langMode === 'german'`; German
 * and the pedagogy (gender colours, IPA, examples) always render, and nothing
 * ever renders an empty table.
 */
import { useLang } from '../../hooks/useLang';
import { theme, genderTokenFor } from '../../config/theme';
import type {
  DialogueScript,
  GrammarBlock,
  LexiconEntry,
  MiniGameSpec,
  PracticeItem,
  TrapItem,
  UnitLessonContent,
} from '../../data/curriculum/schema';

type Localized = { en?: string; ne?: string; de?: string };

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-h2 font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
      {meta ? (
        <p className="mt-1 text-meta uppercase tracking-wider text-ink-500 dark:text-ink-400">{meta}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Pick the best available language string, preferring German in Nur-DE mode. */
function pick(value: Localized | undefined, isDE: boolean): string {
  if (!value) return '';
  if (isDE) return value.de || value.en || '';
  return value.en || value.de || '';
}

function Objectives({ lesson, isDE }: { lesson: UnitLessonContent; isDE: boolean }) {
  const objectives = lesson.objectives;
  if (!objectives || objectives.en.length === 0) return null;
  return (
    <Section title={isDE ? 'Lernziele' : 'Learning objectives'}>
      <ul className="space-y-1.5">
        {objectives.en.map((item, i) => (
          <li key={i} className="flex gap-2 text-body text-ink-700 dark:text-ink-200">
            <span className={theme.gender.der.text}>▸</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ArticleCell({ entry }: { entry: LexiconEntry }) {
  if (!entry.article) return <span className="text-ink-400">—</span>;
  const token = genderTokenFor(entry.article);
  return (
    <span className={`font-mono text-meta font-semibold ${token.text}`}>
      {entry.article === 'plural' ? 'Pl.' : entry.article}
    </span>
  );
}

function LexiconTable({ entries, isDE }: { entries: LexiconEntry[]; isDE: boolean }) {
  if (entries.length === 0) return null;
  return (
    <Section title={isDE ? 'Vokabeln' : 'Vocabulary'} meta={`${entries.length} ${isDE ? 'Wörter' : 'words'}`}>
      <div className="overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="bg-ink-50 dark:bg-ink-800">
              <Th className="text-left">{isDE ? 'Wort' : 'Word'}</Th>
              <Th>{isDE ? 'Artikel' : 'Article'}</Th>
              <Th>{isDE ? 'Plural' : 'Plural'}</Th>
              <Th>IPA</Th>
              {!isDE && <Th>English</Th>}
              <Th>{isDE ? 'Nepali' : 'Nepali'}</Th>
              <Th className="text-left">{isDE ? 'Beispiel' : 'Example'}</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={`${entry.word}-${i}`} className="border-t border-ink-200 dark:border-ink-800">
                <Td className="font-semibold text-ink-900 dark:text-ink-50">
                  {entry.word}
                  {entry.frequency === 'passive' ? (
                    <span className="ml-1.5 text-micro uppercase text-ink-400">passiv</span>
                  ) : null}
                </Td>
                <Td><ArticleCell entry={entry} /></Td>
                <Td className="text-ink-600 dark:text-ink-300">{entry.plural || '—'}</Td>
                <Td className="font-mono text-micro text-ink-500 dark:text-ink-400">{entry.ipa || '—'}</Td>
                {!isDE && <Td className="text-ink-600 dark:text-ink-300">{entry.en}</Td>}
                <Td className="text-ink-600 dark:text-ink-300">{entry.ne}</Td>
                <Td className="text-ink-600 dark:text-ink-300">
                  {entry.examples?.[0]?.de ?? '—'}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

/* ── grammar ──────────────────────────────────────────────────────────────── */

/**
 * True when a note is really a PICTURE, not prose.
 *
 * The imported curriculum documents contain hand-drawn ASCII tables built from
 * box-drawing characters (┌ ─ ┬ ┐ …). Those runs are 70+ characters with no
 * break opportunities, so rendering one in a prose <p> makes it 776px wide
 * inside a 292px column — which does not just look wrong, it pushes the whole
 * page sideways on a phone. (This was a real horizontal-scroll bug on every
 * lesson whose grammar block carried one.)
 *
 * A newline or any box-drawing rune is an unambiguous signal, and rendering
 * such a note in the same scrollable <pre> the `callout` field already uses
 * fixes it wherever the art happens to sit in the source document, without
 * having to hand-edit the imported JSON.
 */
function isPreformatted(text: string): boolean {
  return /[\n\r]/.test(text) || /[\u2500-\u257F]/.test(text);
}

/** A prose note, or a scrollable <pre> when the note is really ASCII art. */
function GrammarNote({ text }: { text: string }) {
  if (isPreformatted(text)) {
    return (
      <pre className="mt-2 overflow-x-auto rounded-md bg-ink-50 p-3 font-mono text-meta text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        {text}
      </pre>
    );
  }
  // `break-words` is belt-and-braces for any other long unbreakable token the
  // documents might contain (URLs, compounds) in narrow columns.
  return <p className="mt-2 break-words text-body text-ink-700 dark:text-ink-200">{text}</p>;
}

function GrammarBlockView({ block, isDE }: { block: GrammarBlock; isDE: boolean }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h3 className="break-words font-semibold text-ink-900 dark:text-ink-50">{pick(block.title, isDE)}</h3>

      {block.notes?.map((note, i) => {
        const text = pick(note, isDE);
        return text ? <GrammarNote key={i} text={text} /> : null;
      })}

      {block.callout ? (
        <pre className="mt-3 overflow-x-auto rounded-md bg-ink-50 p-3 font-mono text-meta text-ink-700 dark:bg-ink-800 dark:text-ink-200">
          {block.callout}
        </pre>
      ) : null}

      {block.bullets?.length ? (
        <ul className="mt-3 space-y-1.5">
          {block.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-body text-ink-700 dark:text-ink-200">
              <span className={theme.gender.der.text}>•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {block.table ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-ink-200 dark:border-ink-700">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="bg-ink-50 dark:bg-ink-800">
                {block.table.columns.map((column, i) => (
                  <Th key={i} className="text-left">
                    {column}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map((row, r) => (
                <tr key={r} className="border-t border-ink-200 dark:border-ink-800">
                  {row.map((cell, c) => (
                    <Td key={c} className="text-ink-700 dark:text-ink-200">
                      {cell}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function GrammarBlocks({ blocks, isDE }: { blocks: GrammarBlock[]; isDE: boolean }) {
  if (blocks.length === 0) return null;
  return (
    <Section title={isDE ? 'Grammatik' : 'Grammar'}>
      <div className="space-y-3">
        {blocks.map((block, i) => (
          <GrammarBlockView key={i} block={block} isDE={isDE} />
        ))}
      </div>
    </Section>
  );
}

/* ── traps + culture ──────────────────────────────────────────────────────── */

function TrapsBlock({ traps, isDE }: { traps: TrapItem[]; isDE: boolean }) {
  if (traps.length === 0) return null;
  return (
    <Section title={isDE ? 'Typische Fehler' : 'Common traps'}>
      <div className="space-y-2">
        {traps.map((trap, i) => (
          <div
            key={i}
            className="rounded-lg border border-danger-200 bg-danger-50/40 p-3 dark:border-danger-900 dark:bg-danger-950/20"
          >
            {trap.wrong ? (
              <p className="text-body text-danger-700 dark:text-danger-300">
                <span className="font-semibold">✗ </span>
                {trap.wrong}
              </p>
            ) : null}
            {trap.right ? (
              <p className="mt-1 text-body text-success-700 dark:text-success-300">
                <span className="font-semibold">✓ </span>
                {trap.right}
              </p>
            ) : null}
            {pick(trap.note, isDE) ? (
              <p className="mt-1.5 text-meta text-ink-600 dark:text-ink-300">
                {pick(trap.note, isDE)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function CultureBlock({ lesson, isDE }: { lesson: UnitLessonContent; isDE: boolean }) {
  const culture = lesson.culture;
  if (!culture || culture.body.length === 0) return null;
  return (
    <Section title={pick(culture.title, isDE)}>
      <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4 dark:border-ink-800 dark:bg-ink-800/40">
        <ul className="space-y-2">
          {culture.body.map((line, i) => (
            <li key={i} className="text-body text-ink-700 dark:text-ink-200">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ── dialogue, practice bank, mini-game ───────────────────────────────────── */

function DialogueBlock({ dialogue, isDE }: { dialogue: DialogueScript; isDE: boolean }) {
  return (
    <Section title={pick(dialogue.title, isDE)} meta={pick(dialogue.scenario, isDE) || undefined}>
      <ol className="space-y-2">
        {dialogue.turns.map((turn, i) => (
          <li
            key={i}
            className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900"
          >
            <p className="text-micro font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">
              {turn.speaker}
            </p>
            <p className="mt-1 text-body font-medium text-ink-900 dark:text-ink-50">{turn.de}</p>
            {!isDE && turn.en ? (
              <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">{turn.en}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function PracticeBank({ items, isDE }: { items: PracticeItem[]; isDE: boolean }) {
  if (items.length === 0) return null;
  return (
    <Section
      title={isDE ? 'Übungen' : 'Practice bank'}
      meta={`${items.length} ${isDE ? 'Aufgaben' : 'questions'}`}
    >
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            {/* Native <details> so the answer stays hidden until asked for, with
                no state, no layout jump and full keyboard support. */}
            <details className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900">
              <summary className="cursor-pointer text-body text-ink-800 dark:text-ink-100">
                <span className="mr-2 text-micro font-semibold uppercase text-ink-400">
                  {item.kind}
                </span>
                {item.prompt}
              </summary>
              <div className="mt-2 space-y-2 border-t border-ink-200 pt-2 dark:border-ink-800">
                {item.options?.length ? (
                  <ul className="space-y-1">
                    {item.options.map((option, o) => (
                      <li key={o} className="text-body text-ink-700 dark:text-ink-200">
                        <span className="mr-2 text-micro uppercase text-ink-400">
                          {String.fromCharCode(65 + o)}
                        </span>
                        {option}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.answer ? (
                  <p className="text-body font-semibold text-success-700 dark:text-success-300">
                    {item.answer}
                  </p>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function MiniGameCard({ spec, isDE }: { spec: MiniGameSpec; isDE: boolean }) {
  return (
    <Section title={isDE ? 'Interaktive Übung' : 'Interactive exercise'}>
      <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4 dark:border-ink-800 dark:bg-ink-800/40">
        <p className="font-mono text-meta text-accent-700 dark:text-accent-300">{spec.type}</p>
        {spec.title ? <p className="mt-1 text-body text-ink-800 dark:text-ink-100">{spec.title}</p> : null}
        {spec.id ? <p className="mt-0.5 text-micro text-ink-500 dark:text-ink-400">{spec.id}</p> : null}
      </div>
    </Section>
  );
}

/* ── the registry + entry point ───────────────────────────────────────────── */

const SECTION_RENDERERS: Record<
  string,
  (lesson: UnitLessonContent, isDE: boolean) => React.ReactNode
> = {
  objectives: (lesson, isDE) => <Objectives lesson={lesson} isDE={isDE} />,
  lexicon: (lesson, isDE) => <LexiconTable entries={lesson.lexicon ?? []} isDE={isDE} />,
  grammar: (lesson, isDE) => <GrammarBlocks blocks={lesson.grammar ?? []} isDE={isDE} />,
  traps: (lesson, isDE) => <TrapsBlock traps={lesson.traps ?? []} isDE={isDE} />,
  culture: (lesson, isDE) => <CultureBlock lesson={lesson} isDE={isDE} />,
  dialogue: (lesson, isDE) =>
    lesson.dialogue ? <DialogueBlock dialogue={lesson.dialogue} isDE={isDE} /> : null,
  practiceBank: (lesson, isDE) => <PracticeBank items={lesson.practiceBank ?? []} isDE={isDE} />,
  miniGame: (lesson, isDE) =>
    lesson.miniGame ? <MiniGameCard spec={lesson.miniGame} isDE={isDE} /> : null,
};

/** The order a reader should meet the material in. */
const SECTION_ORDER = [
  'objectives',
  'lexicon',
  'grammar',
  'traps',
  'culture',
  'dialogue',
  'miniGame',
  'practiceBank',
];

/**
 * Render a unit's lesson content.
 *
 * Renders nothing (never an error) when a unit has no `lesson` block yet — that
 * is the normal state for a unit whose content has not been imported, not a
 * failure.
 */
export function LessonSections({ lesson }: { lesson?: UnitLessonContent }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  if (!lesson) return null;

  return (
    <div>
      {SECTION_ORDER.map((type) => (
        <div key={type}>{SECTION_RENDERERS[type]?.(lesson, isDE)}</div>
      ))}
    </div>
  );
}
