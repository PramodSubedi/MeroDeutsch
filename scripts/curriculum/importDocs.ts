/**
 * scripts/curriculum/importDocs.ts — NotebookLM curriculum documents → unit JSON
 *
 * THE STEP THAT MAKES THE LESSONS APPEAR.
 *
 * The A1 spine config shipped with 15 units that were structurally correct but
 * thin: a title, a theme, a goal and a gate. The real course material lives in
 * the NotebookLM document package (three files):
 *
 *   unit_01…unit_15_*.md                       all 15 units, full 7-section shape
 *   MeroDeutsch_Complete_Full_A1_Curriculum.md  15-module overview (rules, specs)
 *   MeroDeutsch_Comprehensive_A1_Master_Curriculum.md
 *                                               8 units with the FULL 40-row
 *                                               trilingual lexicons, traps, culture
 *                                               notes, long dialogues and
 *                                               25-question banks
 *
 * This script parses all three and writes the result into each
 * `src/data/curriculum/units/mNN.json` under `lesson`, typed by
 * `src/data/curriculum/schema.ts`.
 *
 * MERGE RULE
 *   lexicon  — the comprehensive 40-row table wins when the master has that unit,
 *              otherwise the per-unit file's table is used.
 *   grammar  — the master's deep dive wins when present, per-unit foundations
 *              otherwise.
 *   dialogue — the master's longer dialogue wins when present.
 *   bank     — the master's 25-question bank when present, else the per-unit drills.
 *   traps / culture / minigame — master when present, per-unit otherwise.
 *
 * DATA QUALITY
 * The documents contain real defects (a lemma "Lamp" instead of "Lampe", a
 * non-grammatical example, speaker roles swapped in one dialogue). Corrections
 * come from an explicit table below and every one is reported: the documents are
 * never trusted verbatim, and never silently edited in place.
 *
 * Usage:
 *   npx tsx scripts/curriculum/importDocs.ts            # dry-run report only
 *   npx tsx scripts/curriculum/importDocs.ts --apply    # write units/mNN.json
 *   npx tsx scripts/curriculum/importDocs.ts --apply --only=4
 *   npx tsx scripts/curriculum/importDocs.ts --apply --docs-dir "E:\path\Package file"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CurriculumUnitFile,
  DialogueScript,
  DialogueTurn,
  GrammarBlock,
  LexiconEntry,
  LocalizedLabel,
  MiniGameSpec,
  PracticeItem,
  TrapItem,
  UnitLessonContent,
} from '../../src/data/curriculum/schema';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const UNITS_DIR = path.join(ROOT, 'src', 'data', 'curriculum', 'units');
/**
 * Lesson material lives in its own directory, NOT inside the spine unit files.
 *
 * Why: the spine is needed on every page (the sidebar rail, the Home CTA, the
 * checkpoint), while lesson material is large and only read on /lesson/:index.
 * Keeping them apart means the ~300 KB of document content is code-split into
 * one small chunk per unit instead of riding in the main bundle, and it makes the
 * authoring surface cleaner — a unit's lesson has no spine fields in it at all.
 */
const LESSONS_DIR = path.join(ROOT, 'src', 'data', 'curriculum', 'lessons');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? Number(onlyArg.split('=')[1]) : null;
const docsArg = args.find((a) => a.startsWith('--docs-dir='));
const DEFAULT_DOCS_DIR =
  'e:\\1. User\\Downloads\\Package file-20260909T163257Z-1-001\\Package file';
const DOCS_DIR = docsArg ? docsArg.slice('--docs-dir='.length).replace(/^"|"$/g, '') : DEFAULT_DOCS_DIR;

const warn: string[] = [];

/* ── markdown primitives ──────────────────────────────────────────────────── */

/** Strip inline emphasis/links/code so text is safe to render as plain copy. */
function clean(text: string): string {
  return text
    .replace(/`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** A markdown table → { columns, rows }, or null when the lines are not one. */
function parseTable(lines: string[]): { columns: string[]; rows: string[][] } | null {
  const tableLines = lines.filter((line) => isTableRow(line));
  if (tableLines.length < 2) return null;
  const columns = splitRow(tableLines[0]).map(clean);
  const rows: string[][] = [];
  for (let i = 1; i < tableLines.length; i++) {
    const cells = splitRow(tableLines[i]);
    // Skip the `|---|---|` separator row.
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    if (cells.every((cell) => cell === '')) continue;
    rows.push(cells.map(clean));
  }
  return rows.length > 0 ? { columns, rows } : null;
}

/** Split a markdown body into heading sections, keyed by heading text. */
function sections(markdown: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const mark of headingMarks(markdown)) {
    out.set(mark.title, markdown.slice(mark.bodyStart, mark.end));
  }
  return out;
}

interface HeadingMark {
  title: string;
  level: number;
  start: number;
  bodyStart: number;
  end: number;
}

/**
 * Every heading with the span it OWNS.
 *
 * `end` is the next heading of the SAME OR SHALLOWER level, not simply the next
 * heading: a `##` section owns its `###` subsections. Getting this wrong is
 * subtle and silent — the section body comes back as blank lines and the content
 * that lived under the subheadings appears to have vanished.
 */
function headingMarks(markdown: string): HeadingMark[] {
  const pattern = /^(#{1,4})\s+(.*)$/gm;
  const found: { title: string; level: number; start: number; bodyStart: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    found.push({
      title: match[2].trim(),
      level: match[1].length,
      start: match.index,
      bodyStart: match.index + match[0].length,
    });
  }
  return found.map((mark, i) => {
    const next = found.slice(i + 1).find((candidate) => candidate.level <= mark.level);
    return { ...mark, end: next ? next.start : markdown.length };
  });
}

/**
 * Find a section whose title CONTAINS one of the needles (emoji prefixes vary)
 * and return its FULL span, subheadings included.
 */
function findSection(markdown: string, needles: string[]): string {
  for (const mark of headingMarks(markdown)) {
    if (needles.some((needle) => mark.title.toLowerCase().includes(needle))) {
      return markdown.slice(mark.bodyStart, mark.end);
    }
  }
  return '';
}

function lbl(en: string, de: string): LocalizedLabel {
  return { en, de };
}

/** `die`, `der (m)`, `die (Pl.)` → a single article token. */
function parseArticle(cell: string): LexiconEntry['article'] {
  const value = cell.toLowerCase().replace(/\(.*?\)/g, '').trim();
  if (value === 'der' || value === 'die' || value === 'das') return value;
  if (value.startsWith('pl') || value.includes('plural')) return 'plural';
  return undefined;
}

/** Extract every ```json fenced block in a body. */
function jsonBlocks(body: string): string[] {
  return [...body.matchAll(/```json\s*([\s\S]*?)```/g)].map((match) => match[1]);
}

/* ── documented data-quality corrections (applied + reported, never silent) ── */

const WORD_FIXES: Record<string, string> = {
  Lamp: 'Lampe',
  Sofas: 'Sofa',
};

const EXAMPLE_FIXES: { match: string; replace: string; reason: string }[] = [
  {
    match: 'Meine Oma gebacken Kuchen.',
    replace: 'Meine Oma backt Kuchen.',
    reason: 'U04 lexicon example was not a sentence (missing verb form).',
  },
];

const DIALOGUE_LINE_FIX_UNIT = 2;
const DIALOGUE_LINE_FIX_REASON =
  'U02 dialogue had the shopkeeper and customer lines swapped (the customer was quoting the bill and the shopkeeper was taking payment).';
/** Exact raw line → corrected raw line. Line-keyed so a fix cannot cascade. */
const DIALOGUE_LINE_FIXES: Record<string, string> = {
  '- **Bäckerin:** "Gerne. Was kostet das?"': '- **Bäckerin:** "Gerne. Das macht zusammen 4,50 €."',
  '- **Kunde:** "Das macht zusammen 4,50 €."': '- **Kunde:** "Hier sind 5 Euro."',
  '- **Bäckerin:** "Hier sind 5 Euro."': '- **Bäckerin:** "Vielen Dank! Hier sind 50 Cent zurück."',
  '- **Kunde:** "Und 50 Cent zurück. Vielen Dank!"': '- **Kunde:** "Vielen Dank!"',
};

function fixWord(word: string): string {
  const stripped = word.replace(/^\*\*|\*\*$/g, '').trim();
  const fixed = WORD_FIXES[stripped];
  if (fixed) {
    warn.push(`  corrected lemma "${stripped}" → "${fixed}"`);
    return fixed;
  }
  return stripped;
}

function fixExample(text: string): string {
  let out = text;
  for (const fix of EXAMPLE_FIXES) {
    if (out.includes(fix.match)) {
      out = out.split(fix.match).join(fix.replace);
      warn.push(`  ${fix.reason}`);
    }
  }
  return out;
}

/* ── lexicon ──────────────────────────────────────────────────────────────── */

/** The master document's 11-column trilingual lexicon. */
function parseMasterLexicon(body: string): LexiconEntry[] {
  const table = parseTable(body.split('\n'));
  if (!table) return [];
  const entries: LexiconEntry[] = [];
  for (const row of table.rows) {
    // | # | lemma | gender | plural | ipa | en | ne | active/passive | exDE | exEN | exNE |
    if (row.length < 8) continue;
    const word = fixWord(row[1] ?? '');
    if (!word) continue;
    const exampleDe = fixExample(clean(row[8] ?? ''));
    const entry: LexiconEntry = {
      word,
      en: clean(row[5] ?? ''),
      ne: clean(row[6] ?? ''),
    };
    const article = parseArticle(row[2] ?? '');
    if (article) entry.article = article;
    if (clean(row[3] ?? '')) entry.plural = clean(row[3] ?? '');
    if (clean(row[4] ?? '')) entry.ipa = clean(row[4] ?? '');
    const frequency = clean(row[7] ?? '').toLowerCase();
    if (frequency.startsWith('passive')) entry.frequency = 'passive';
    else if (frequency.startsWith('active')) entry.frequency = 'active';
    if (exampleDe) {
      entry.examples = [{ de: exampleDe, en: clean(row[9] ?? ''), ne: clean(row[10] ?? '') }];
    }
    entries.push(entry);
  }
  return entries;
}

/** The per-unit files' 6-column core vocabulary table. */
function parseUnitLexicon(body: string): LexiconEntry[] {
  const table = parseTable(body.split('\n'));
  if (!table) return [];
  const entries: LexiconEntry[] = [];
  for (const row of table.rows) {
    // | word | part of speech | gender | english | nepali | example |
    if (row.length < 5) continue;
    const word = fixWord(row[0] ?? '');
    if (!word) continue;
    const entry: LexiconEntry = {
      word,
      en: clean(row[3] ?? ''),
      ne: clean(row[4] ?? ''),
    };
    const article = parseArticle(row[2] ?? '');
    if (article) entry.article = article;
    const pos = clean(row[1] ?? '');
    if (pos) entry.partOfSpeech = pos;
    const example = fixExample(clean(row[5] ?? ''));
    if (example) entry.examples = [{ de: example, en: '', ne: '' }];
    entries.push(entry);
  }
  return entries;
}

/* ── grammar, traps, culture ──────────────────────────────────────────────── */

interface NoteLines {
  prose: string[];
}

/** Strip leading "1." / "A." enumeration from a heading. */
function stripEnum(title: string): string {
  return clean(title.replace(/^\s*([0-9]+|[A-Z])\s*[.)]\s*/, ''));
}

/**
 * Grammar section → blocks. Each `###` subsection becomes one block that may
 * carry prose, a rule table, a decision-chart callout and/or bullets.
 */
function parseGrammarBlocks(body: string): GrammarBlock[] {
  const blocks: GrammarBlock[] = [];
  for (const [title, raw] of sections(body)) {
    const lines = raw.split('\n');
    const note: NoteLines = { prose: [] };
    const bullets: string[] = [];
    const callout: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || isTableRow(trimmed) || /^#{1,4}\s/.test(trimmed)) continue;
      if (/^>/.test(trimmed)) {
        callout.push(clean(trimmed.replace(/^>\s?/, '')));
        continue;
      }
      if (/^[-*+]\s/.test(trimmed)) {
        bullets.push(clean(trimmed.replace(/^[-*+]\s+/, '')));
        continue;
      }
      const cleaned = clean(trimmed);
      if (cleaned) note.prose.push(cleaned);
    }
    const block: GrammarBlock = { title: lbl(stripEnum(title), stripEnum(title)) };
    if (note.prose.length > 0) {
      block.notes = [{ en: note.prose.join(' '), ne: '', de: '' }];
    }
    const table = parseTable(lines);
    if (table) block.table = table;
    if (callout.length > 0) block.callout = callout.join('\n');
    if (bullets.length > 0) block.bullets = bullets;
    if (block.notes || block.table || block.callout || block.bullets) blocks.push(block);
  }
  return blocks;
}

/** The master's "Common Traps" list → TrapItem[]. */
function parseTraps(body: string): TrapItem[] {
  const traps: TrapItem[] = [];
  let current: TrapItem | null = null;
  const flush = () => {
    if (current) traps.push(current);
    current = null;
  };

  for (const line of body.split('\n')) {
    const heading = line.match(/^\s*\d+\.\s+\*\*(.+?)\*\*\s*$/);
    if (heading) {
      flush();
      const title = clean(heading[1]);
      current = { note: { en: title, ne: '', de: '' } };
      continue;
    }
    if (!current) continue;
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (!bullet) continue;
    const value = clean(bullet[1]);
    if (!value) continue;
    if (/[❌✗]|Falsch/i.test(value)) current.wrong = clean(value.replace(/^[❌✗]\s*/, ''));
    else if (/[✅✓]|Richtig/i.test(value)) current.right = clean(value.replace(/^[✅✓]\s*/, ''));
    else current.note = { en: [current.note.en, value].filter(Boolean).join(' '), ne: '', de: '' };
  }
  flush();
  // A trap does not have to show a wrong/right pair — several are pure warnings
  // ("mein Freund" implies boyfriend). Those still carry teaching value, so none
  // are dropped here.
  return traps;
}

/** "Cultural Context" bullets → plain body lines. */
function parseCulture(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s/.test(line))
    .map((line) => clean(line.replace(/^[-*+]\s+/, '')))
    .filter(Boolean);
}

/**
 * Dialogue lines → turns. Handles both document shapes:
 *   `- **Anna:** "Guten Tag!" *(Good day!)*`      (per-unit files)
 *   `* **Anna:** "Guten Tag!" *(Good day!)*  `   (master)
 *
 * Known role swaps are corrected from `DIALOGUE_LINE_FIXES` BEFORE parsing, by
 * exact-line lookup, so a corrected line can never be re-matched by a later
 * rule.
 */
function parseDialogue(body: string, unitNo: number): DialogueScript | undefined {
  const scenarioRaw = body.match(/\*\*Scenario:?\s*([^*]+?)\*\*/i)?.[1];
  const turns: DialogueTurn[] = [];
  for (const rawLine of body.split('\n')) {
    const fixedLine = DIALOGUE_LINE_FIXES[rawLine.trim()];
    if (fixedLine !== undefined && unitNo === DIALOGUE_LINE_FIX_UNIT) {
      warn.push(`  ${DIALOGUE_LINE_FIX_REASON}`);
    }
    const line = fixedLine ?? rawLine;
    const match = line.match(/^\s*[-*+]\s+\*\*(.+?)\*\*:?\s*(.*)$/);
    if (!match) continue;
    const speaker = clean(match[1]);
    if (/^scenario/i.test(speaker)) continue;
    const rest = match[2] ?? '';
    const quoted = rest.match(/"([^"]*)"/);
    if (!quoted) continue;
    const turn: DialogueTurn = { speaker, de: fixExample(clean(quoted[1])) };
    const translation = rest.match(/\*\((.*)\)\*/);
    if (translation) turn.en = clean(translation[1]);
    turns.push(turn);
  }
  if (turns.length === 0) return undefined;
  const script: DialogueScript = {
    id: `m${String(unitNo).padStart(2, '0')}-dialogue`,
    title: lbl('Dialogue', 'Dialog'),
  };
  if (scenarioRaw) script.scenario = lbl(clean(scenarioRaw), clean(scenarioRaw));
  script.turns = turns;
  return script;
}

/** The master's 25-question bank (`**[MCQ]** …`). */
function parsePracticeBank(body: string): PracticeItem[] {
  const items: PracticeItem[] = [];
  let current: PracticeItem | null = null;
  const flush = () => {
    if (current) items.push(current);
    current = null;
  };

  for (const raw of body.split('\n')) {
    const head = raw.match(/^\s*\d+\.\s+\*\*\[(.+?)\]\*\*\s*(.*)$/);
    if (head) {
      flush();
      let prompt = clean(head[2]);
      const item: PracticeItem = { kind: clean(head[1]), prompt };
      const arrow = prompt.match(/\\?\(?\\rightarrow\)?\s*\*\*(.+?)\*\*/);
      if (arrow) {
        item.answer = clean(arrow[1]);
        prompt = clean(prompt.replace(arrow[0], ''));
        item.prompt = prompt;
      }
      current = item;
      continue;
    }
    if (!current) continue;
    const line = raw.trim();
    if (!/^[-*+]\s/.test(line)) continue;
    const text = clean(line.replace(/^[-*+]\s+/, ''));
    if (/[A-D]\)/.test(text)) {
      current.options = text
        .split('|')
        .map((option) => clean(option.replace(/^[A-D]\)\s*/, '')))
        .filter(Boolean);
      const bolded = line.match(/\*\*([^*]+)\*\*/);
      if (bolded && !current.answer) current.answer = clean(bolded[1]);
    }
  }
  flush();
  return items;
}

/** The per-unit files' "Practice & Self-Assessment Drills" numbered list. */
function parseDrills(body: string): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (const raw of body.split('\n')) {
    const match = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (!match) continue;
    let text = clean(match[1]);
    if (!text) continue;
    let answer: string | undefined;
    const answerMatch = text.match(/\(Answer:\s*(.+?)\)\s*$/i) ?? text.match(/->\s*(.+)$/);
    if (answerMatch) {
      answer = clean(answerMatch[1]);
      text = clean(text.replace(answerMatch[0], ''));
    }
    const kind = /translate/i.test(text)
      ? 'Translation'
      : /fill in|choose|correct/i.test(text)
        ? 'Fill-in'
        : 'Drill';
    const item: PracticeItem = { kind, prompt: text };
    if (answer) item.answer = answer;
    items.push(item);
  }
  return items;
}

/** The document's interactive component: type, id and the raw JSON payload. */
function parseMiniGame(body: string): MiniGameSpec | undefined {
  const raw = jsonBlocks(body)[0];
  if (!raw) return undefined;
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    warn.push('  mini-game JSON block did not parse; kept as text');
    return undefined;
  }
  const directType = body.match(/\*\*Component Type:?\*\*\s*`([^`]+)`/)?.[1];
  const directId = body.match(/\*\*ID:?\*\*\s*`([^`]+)`/)?.[1];
  // The master's payload nests one spec object inside { unit_id, route, … }.
  const container = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  const nested = Object.values(container ?? {}).find(
    (value) => value && typeof value === 'object' && !Array.isArray(value) && 'id' in (value as object)
  ) as { id?: string; title?: string; type?: string } | undefined;

  return {
    type: clean(directType ?? nested?.type ?? 'payload'),
    id: clean(directId ?? nested?.id ?? ''),
    title: nested?.title ? clean(nested.title) : undefined,
    payload,
  };
}

/** The document's declared route (`/vocab`), when the payload carries one. */
function payloadRoute(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'route' in payload) {
    const route = (payload as { route?: unknown }).route;
    if (typeof route === 'string' && route.startsWith('/')) return route;
  }
  return undefined;
}

/* ── source readers ───────────────────────────────────────────────────────── */

const MASTER_FILE = 'MeroDeutsch_Comprehensive_A1_Master_Curriculum.md';
const V3_FILE = 'MeroDeutsch_A1_Beginner_First_Curriculum_v3.md';
const OVERVIEW_FILE = 'MeroDeutsch_Complete_Full_A1_Curriculum.md';

/** Split a document on its `# Unit NN:` / `## Module NN:` headings, by unit number. */
function indexByUnit(markdown: string): Map<number, string> {
  const blocks = new Map<number, string>();
  const pattern = /^#{1,2}\s+[^\p{L}\p{N}\n]*?(?:Unit|Module)\s+(\d{1,2})\b[^\n]*\n/gimu;
  const marks: { unit: number; start: number; bodyStart: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    marks.push({
      unit: Number(match[1]),
      start: match.index,
      bodyStart: match.index + match[0].length,
    });
  }
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : markdown.length;
    const existing = blocks.get(marks[i].unit) ?? '';
    blocks.set(marks[i].unit, existing + markdown.slice(marks[i].bodyStart, end));
  }
  return blocks;
}

function readDoc(file: string): string | undefined {
  const full = path.join(DOCS_DIR, file);
  if (!fs.existsSync(full)) return undefined;
  return fs.readFileSync(full, 'utf8');
}

/** Lesson material parsed from ONE per-unit file. */
function readUnitFile(unitNo: number): UnitLessonContent {
  const padded = String(unitNo).padStart(2, '0');
  const files = fs
    .readdirSync(DOCS_DIR)
    .filter((name) => name.startsWith(`unit_${padded}_`) && name.endsWith('.md'));
  if (files.length === 0) return {};
  const markdown = fs.readFileSync(path.join(DOCS_DIR, files[0]), 'utf8');

  const lesson: UnitLessonContent = {};
  const cefr = markdown.match(/\*\*CEFR Level:?\*\*\s*`?([A-Z0-9.]+)`?/)?.[1];
  if (cefr) lesson.cefr = clean(cefr);
  const route = markdown.match(/\*\*Application Route:?\*\*\s*`([^`]+)`/)?.[1];
  if (route) lesson.docRoute = route;

  const objectives = findSection(markdown, ['learning objectives']);
  if (objectives.trim()) {
    const sentences = clean(objectives).split(/(?<=[.!?])\s+/).filter(Boolean);
    lesson.objectives = { en: sentences };
  }

  const lexicon = parseUnitLexicon(findSection(markdown, ['vocabulary table']));
  if (lexicon.length > 0) lesson.lexicon = lexicon;

  const grammar = parseGrammarBlocks(findSection(markdown, ['grammar & structural']));
  if (grammar.length > 0) lesson.grammar = grammar;

  const dialogue = parseDialogue(findSection(markdown, ['dialogue script']), unitNo);
  if (dialogue) lesson.dialogue = dialogue;

  const miniGame = parseMiniGame(findSection(markdown, ['mini-game', 'component specification']));
  if (miniGame) lesson.miniGame = miniGame;

  const drills = parseDrills(findSection(markdown, ['practice & self-assessment', 'practice']));
  if (drills.length > 0) lesson.practiceBank = drills;

  return lesson;
}

/** Lesson material parsed from the master document for ONE unit (when present). */
function readMasterUnit(block: string, unitNo: number): UnitLessonContent {
  const lesson: UnitLessonContent = {};

  const lexicon = parseMasterLexicon(findSection(block, ['trilingual lexicon']));
  if (lexicon.length > 0) lesson.lexicon = lexicon;

  const grammar = parseGrammarBlocks(findSection(block, ['grammar deep dive']));
  if (grammar.length > 0) lesson.grammar = grammar;

  const traps = parseTraps(findSection(block, ['common traps']));
  if (traps.length > 0) lesson.traps = traps;

  const cultureBody = findSection(block, ['cultural context']);
  const culture = parseCulture(cultureBody);
  if (culture.length > 0) {
    lesson.culture = { title: lbl('Cultural context', 'Kultureller Kontext'), body: culture };
  }

  const dialogue = parseDialogue(findSection(block, ['real-world dialogue script']), unitNo);
  if (dialogue) lesson.dialogue = dialogue;

  const miniGame = parseMiniGame(findSection(block, ['json mini-game payload', 'mini-game payload']));
  if (miniGame) {
    lesson.miniGame = miniGame;
    const route = payloadRoute(miniGame.payload);
    if (route) lesson.docRoute = route;
  }

  const bank = parsePracticeBank(findSection(block, ['practice bank']));
  if (bank.length > 0) lesson.practiceBank = bank;

  const cefr = block.match(/\*\*CEFR Target:?\*\*\s*([A-Z0-9. ]+?)\s*(?:\(|$)/)?.[1];
  if (cefr) lesson.cefr = clean(cefr);

  return lesson;
}

/**
 * Merge the master document over the per-unit file.
 *
 * The master WINS for every key it defines — that is the documented rule: its
 * 40-row lexicon, deeper grammar, longer dialogue and 25-question bank replace
 * the per-unit file's shorter versions. `readMasterUnit` only sets the keys it
 * actually found, so anything it is silent about (traps, culture) still falls
 * through from the per-unit file.
 */
function overlay(base: UnitLessonContent, extra: UnitLessonContent): UnitLessonContent {
  const out: UnitLessonContent = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/* ── v3 (the newest document) ──────────────────────────────────────────────── */

/**
 * The v3 document: `MeroDeutsch_A1_Beginner_First_Curriculum_v3.md`.
 *
 * WHY IT IS TREATED DIFFERENTLY FROM EVERY OTHER SOURCE
 * v3 is the newest file in the package and the only one that states a PAGE
 * SPECIFICATION — the "Standardized 7-Step Unit Micro-Scaffolding Matrix". It
 * is also the only document written with a trilingual 7-column lexicon carrying
 * part-of-speech and an active/passive tag, so it is authoritative for
 * STRUCTURE and for those two lexicon fields.
 *
 * BUT IT IS NOT A CONTENT SUPERSET, and treating it as one would delete material.
 * Measured against its own promise of "30-40 Essential Words":
 *
 *   unit    01  02  03  04  05  06  07  08  09  10
 *   v3      19  18   5  12   4   4   2   3   2   1
 *   master   -   -   -  40  40  40  40  40  40  40
 *
 * Importing v3 wholesale would take Unit 10 from 40 words down to 1. The merge
 * is therefore FIELD-LEVEL, not document-level: v3 supplies the scaffolding and
 * the tags, and the richest available lexicon/bank wins on volume.
 */

/** v3's 7-column trilingual lexicon. */
function parseV3Lexicon(body: string): LexiconEntry[] {
  const entries: LexiconEntry[] = [];
  for (const sub of sections(body).values()) {
    const table = parseTable(sub.split('\n'));
    if (!table) continue;
    const cols = table.columns.map((c) => c.toLowerCase());
    // | German Lemma | POS | IPA | English | Nepali | Type | Example Sentence |
    const lemmaAt = cols.findIndex((c) => c.includes('lemma') || c.includes('word'));
    if (lemmaAt === -1) continue;
    for (const row of table.rows) {
      if (row.length <= lemmaAt) continue;
      const word = fixWord(clean(row[lemmaAt] ?? '').replace(/\*\*/g, ''));
      if (!word) continue;
      // Columns are read from the HEADER, not assumed, because v3 emits more
      // than one lexicon shape and assuming positions silently mixes them.
      const at = (needle: string): string => {
        const i = cols.findIndex((c) => c.includes(needle));
        return i === -1 ? '' : clean(row[i] ?? '').replace(/\*\*/g, '');
      };
      const entry: LexiconEntry = { word, en: at('english'), ne: at('nepali') || at('devanagari') };
      const pos = at('pos') || at('part of speech');
      if (pos) entry.partOfSpeech = pos;
      const ipa = at('ipa') || at('phonetic');
      if (ipa) entry.ipa = ipa;
      const type = (at('type') || at('active')).toLowerCase();
      if (type.startsWith('passive')) entry.frequency = 'passive';
      else if (type.startsWith('active')) entry.frequency = 'active';
      // The example cell packs all three languages: "Er kommt aus X. (He comes
      // from Y. Z)" — split the parenthesised tail rather than guessing.
      const rawExample = at('example');
      const exDe = fixExample(rawExample.replace(/\s*\([^)]*\)\s*$/, '').trim());
      if (exDe) {
        const tail = rawExample.match(/\(([^)]*)\)\s*$/)?.[1] ?? '';
        const parts = tail.split(/\s*[|;]\s*/);
        entry.examples = [{ de: exDe, en: clean(parts[0] ?? ''), ne: clean(parts.slice(1).join(' · ')) }];
      }
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * v3's practice suite: `1. <prompt> -> **<answer>**` per line.
 *
 * These are FREE-RESPONSE items, not MCQ — the source gives an answer but no
 * option list — so they are deliberately NOT given `options`. Inventing four
 * distractors would be fabricating assessment content.
 */
function parseV3Quiz(body: string): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (const raw of body.split('\n')) {
    const match = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (!match) continue;
    const text = clean(match[1]);
    if (!text) continue;
    const arrow = text.match(/->\s*(.+)$/);
    if (!arrow) continue;
    let prompt = clean(text.slice(0, text.length - arrow[0].length));
    let answer = clean(arrow[1]);
    if (!prompt || !answer) continue;
    // The answer is written as a lettered option ("**B) Wie heißen Sie?**")
    // when the author meant multiple choice. Strip the marker, keep the value,
    // and record the kind honestly.
    const lettered = answer.match(/^([A-D])\)\s*(.*)$/);
    if (lettered) answer = clean(lettered[2]);
    const kind = /___/.test(prompt)
      ? 'Fill-in'
      : /unscramble|scramble/i.test(prompt)
        ? 'Sentence Unscramble'
        : lettered
          ? 'Recall'
          : 'Drill';
    if (/^`?\[/.test(prompt)) {
      // "Unscramble: `[aus] [komme] [Nepal] [Ich]`" — the leading label reads
      // badly once the kind is shown separately.
      prompt = clean(prompt.replace(/^Unscramble:\s*/i, 'Reorder into a sentence: '));
    }
    items.push({ kind, prompt, answer });
  }
  return items;
}

/** v3's "Unit Overview" → objectives, and its CEFR line. */
function parseV3Overview(body: string): { objectives: string[]; cefr?: string } {
  const objectives: string[] = [];
  const goal = body.match(/\*\*Core Goal:?\*\*\s*(.+)/)?.[1];
  if (goal) objectives.push(clean(goal));
  const hook = body.match(/\*\*Micro-Hook:?\*\*\s*(.+)/)?.[1];
  if (hook) objectives.push(clean(hook));
  const time = body.match(/\*\*Estimated Time:?\*\*\s*([^|]+)\|/)?.[1];
  if (time) {
    const prereq = body.match(/\*\*Prerequisites:?\*\*\s*(.+)/)?.[1];
    objectives.push(
      clean(`Estimated time ${time.trim()}${prereq ? ` · Prerequisites: ${clean(prereq)}` : ''}`)
    );
  }
  const cefr = body.match(/\*\*CEFR Level:?\*\*\s*([A-Z0-9.]+)/)?.[1];
  return { objectives, cefr: cefr ? clean(cefr) : undefined };
}

/** Lesson material parsed from the v3 document for ONE unit (when authored). */
function readV3Unit(block: string): UnitLessonContent {
  const lesson: UnitLessonContent = {};

  const overview = parseV3Overview(findSection(block, ['unit overview', 'pedagogical gateway']));
  if (overview.objectives.length > 0) lesson.objectives = { en: overview.objectives };
  if (overview.cefr) lesson.cefr = overview.cefr;

  const lexicon = parseV3Lexicon(findSection(block, ['atomic building blocks']));
  if (lexicon.length > 0) lesson.lexicon = lexicon;

  const grammar = parseGrammarBlocks(findSection(block, ['unlocking the pattern']));
  if (grammar.length > 0) lesson.grammar = grammar;

  const traps = parseTraps(findSection(block, ['pitfalls', 'memory shortcuts']));
  if (traps.length > 0) lesson.traps = traps;

  const culture = parseCulture(findSection(block, ['cultural etiquette', 'pitfalls']));
  if (culture.length > 0) {
    lesson.culture = { title: lbl('Cultural context', 'Kultureller Kontext'), body: culture };
  }

  const dialogue = parseDialogue(findSection(block, ['real-world immersion']), 0);
  if (dialogue) lesson.dialogue = dialogue;

  const bank = parseV3Quiz(findSection(block, ['gamified checkpoint', 'practice suite']));
  if (bank.length > 0) lesson.practiceBank = bank;

  return lesson;
}

/**
 * MCQ OPTION NORMALISATION — a real data defect in the master document.
 *
 * The source writes an option list into one cell:
 *   `A) Position 1 | B) Position 2 | C) Before the verb | D) Very end`
 * and bolds the chosen one. Splitting on `|` and stripping the `X)` marker works,
 * EXCEPT that the first option is sometimes written WITHOUT its letter
 * ("Position 1 | B) Position 2 | …"). The result is a set where one option kept
 * its marker and the rest lost theirs, and an `answer` still carrying "D) " —
 * which matches no option in the list, so an exercise built from it could never
 * be scored correct.
 *
 * So: strip the marker from every option AND from the answer, then re-attach the
 * answer by VALUE. An answer that matches nothing is de-lettered and REPORTED,
 * because that is a content problem the author should see, not one to hide.
 */
function normaliseMcq(items: PracticeItem[]): PracticeItem[] {
  return items.map((item) => {
    if (!item.options || item.options.length === 0 || !item.answer) return item;
    const options = item.options.map((option) => clean(option.replace(/^[A-D]\)\s*/, '')));
    const answer = clean(item.answer.replace(/^[A-D]\)\s*/, ''));
    if (!options.some((option) => option === answer)) {
      warn.push(`  MCQ answer "${item.answer}" matches no option in "${item.prompt.slice(0, 48)}…"`);
    }
    return { ...item, options, answer };
  });
}

/**
 * Field-level merge of the two rich sources.
 *
 * `base` is the thin per-unit file, `master` the 8-unit comprehensive document,
 * `v3` the newest document. The rules are per-FIELD, not "newest wins", because
 * newest-wins would delete most of the vocabulary (see the v3 note above):
 *
 *   lexicon      whichever has MORE entries, then v3's partOfSpeech/frequency
 *                merged onto the winner BY LEMMA. Volume decides; v3 decorates.
 *   practiceBank whichever has more items. v3 has ~0 after Unit 03, the master
 *                has 25 for the 8 units it covers, the per-unit file has 3.
 *   objectives   v3 wins — Core Goal + Micro-Hook + prerequisites is strictly
 *                richer than a bullet list.
 *   grammar      most blocks wins; ties to the master, whose parse is proven.
 *   everything   first source that defined it, in order v3 → master → base.
 */
function mergeSources(
  base: UnitLessonContent,
  master: UnitLessonContent | undefined,
  v3: UnitLessonContent | undefined
): UnitLessonContent {
  const out: UnitLessonContent = { ...base };
  const fromMaster = master ?? {};
  const fromV3 = v3 ?? {};

  // --- lexicon: volume wins across ALL THREE sources, then v3's tags merge in
  // The base (thin per-unit file) MUST be in this comparison. An earlier version
  // compared only master-vs-v3, so wherever v3 existed but was thin it beat a
  // richer base outright — that silently cost Unit 07 ten of its fourteen words
  // and Unit 01 five. Losing vocabulary is the one failure mode this merge must
  // never have, so every candidate is measured, including the base.
  const masterLex = fromMaster.lexicon;
  const v3Lex = fromV3.lexicon;
  const baseLex = base.lexicon;
  const lexCandidates = [masterLex, v3Lex, baseLex].filter(
    (l): l is LexiconEntry[] => Array.isArray(l) && l.length > 0
  );
  if (lexCandidates.length > 0) {
    const winner = lexCandidates.reduce((a, b) => (b.length > a.length ? b : a));
    const v3ByLemma = new Map((v3Lex ?? []).map((entry) => [entry.word.toLowerCase(), entry]));
    out.lexicon = winner.map((entry) => {
      const tag = v3ByLemma.get(entry.word.toLowerCase());
      if (!tag) return entry;
      return {
        ...entry,
        partOfSpeech: entry.partOfSpeech ?? tag.partOfSpeech,
        frequency: entry.frequency ?? tag.frequency,
        examples: entry.examples?.length ? entry.examples : tag.examples,
      };
    });
  }

  // --- practice bank: item count wins --------------------------------------
  const banks = [fromMaster.practiceBank, fromV3.practiceBank, base.practiceBank].filter(
    (bank): bank is PracticeItem[] => Array.isArray(bank) && bank.length > 0
  );
  if (banks.length > 0) {
    out.practiceBank = normaliseMcq(banks.reduce((a, b) => (b.length > a.length ? b : a)));
  }

  // --- objectives: whichever source says more, so a thin v3 cannot thinen it --
  // v3's Core Goal + Micro-Hook is richer than a bare bullet list, but v3 only
  // emits the third line (time + prerequisites) when the `**Estimated Time:**`
  // pattern matches. Where it does not, "v3 always wins" REPLACED a longer base
  // list with a shorter one — Unit 09 went 3 objectives to 2. Volume decides.
  const objCandidates = [fromV3.objectives, fromMaster.objectives, base.objectives].filter(
    (o): o is NonNullable<UnitLessonContent['objectives']> =>
      Array.isArray(o?.en) && o.en.length > 0
  );
  if (objCandidates.length > 0) {
    out.objectives = objCandidates.reduce((a, b) => (b.en.length > a.en.length ? b : a));
  }

  // --- grammar: most blocks, ties to master --------------------------------
  const grammars = [fromMaster.grammar, fromV3.grammar, base.grammar].filter(
    (g): g is GrammarBlock[] => Array.isArray(g) && g.length > 0
  );
  if (grammars.length > 0) out.grammar = grammars.reduce((a, b) => (b.length > a.length ? b : a));

  // --- remaining keys: first source that defined it -------------------------
  for (const source of [fromV3, fromMaster]) {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      if (key === 'lexicon' || key === 'practiceBank' || key === 'grammar' || key === 'objectives') {
        continue; // already merged by rule above
      }
      if ((out as Record<string, unknown>)[key] === undefined) {
        (out as Record<string, unknown>)[key] = value;
      }
    }
  }
  if (!out.cefr && fromV3.cefr) out.cefr = fromV3.cefr;

  return out;
}



/* ── main ─────────────────────────────────────────────────────────────────── */

function countLesson(lesson: UnitLessonContent): string {
  return [
    lesson.objectives ? `${lesson.objectives.en.length} obj` : null,
    lesson.lexicon ? `${lesson.lexicon.length} w` : null,
    lesson.grammar ? `${lesson.grammar.length} g` : null,
    lesson.traps ? `${lesson.traps.length} t` : null,
    lesson.culture ? 'culture' : null,
    lesson.dialogue ? `${lesson.dialogue.turns.length} turns` : null,
    lesson.practiceBank ? `${lesson.practiceBank.length} q` : null,
    lesson.miniGame ? lesson.miniGame.type : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function main(): void {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Documents directory not found: ${DOCS_DIR}`);
    console.error('Pass the package folder with --docs-dir="E:\\path\\Package file".');
    process.exit(1);
  }

  const masterMarkdown = readDoc(MASTER_FILE);
  const master = masterMarkdown ? indexByUnit(masterMarkdown) : new Map<number, string>();
  const v3Markdown = readDoc(V3_FILE);
  const v3 = v3Markdown ? indexByUnit(v3Markdown) : new Map<number, string>();
  const overview = readDoc(OVERVIEW_FILE);
  const overviewIndex = overview ? indexByUnit(overview) : new Map<number, string>();

  console.log(`docs:  ${DOCS_DIR}`);
  console.log(`master units:    ${[...master.keys()].sort((a, b) => a - b).join(', ') || 'none'}`);
  console.log(`v3 units:        ${[...v3.keys()].sort((a, b) => a - b).join(', ') || 'none'}`);
  console.log(`overview units:  ${[...overviewIndex.keys()].sort((a, b) => a - b).join(', ') || 'none'}\n`);

  const targets = only
    ? [only]
    : fs
        .readdirSync(UNITS_DIR)
        .filter((file) => /^m\d{2}\.json$/.test(file))
        .map((file) => Number(file.slice(1, 3)))
        .sort((a, b) => a - b);

  let written = 0;
  for (const unitNo of targets) {
    const unitFile = path.join(UNITS_DIR, `m${String(unitNo).padStart(2, '0')}.json`);
    if (!fs.existsSync(unitFile)) {
      console.log(`m${String(unitNo).padStart(2, '0')}  — no unit file, skipped`);
      continue;
    }
    const before = warn.length;
    const unit = JSON.parse(fs.readFileSync(unitFile, 'utf8')) as CurriculumUnitFile;

    // Per-unit file is the base. The two rich documents are merged FIELD-LEVEL
    // (see mergeSources): volume decides the lexicon and the bank, while v3 wins
    // on structure and supplies the POS / active-passive tags. The overview only
    // contributes when a unit still has no grammar block after all of that.
    let lesson = readUnitFile(unitNo);
    const v3Block = v3.get(unitNo);
    const masterBlock = master.get(unitNo);
    lesson = mergeSources(lesson, masterBlock ? readMasterUnit(masterBlock, unitNo) : undefined, v3Block ? readV3Unit(v3Block) : undefined);
    if ((!lesson.grammar || lesson.grammar.length === 0) && overviewIndex.has(unitNo)) {
      const overviewGrammar = parseGrammarBlocks(
        findSection(
          overviewIndex.get(unitNo) ?? '',
          ['grammar blueprint', 'grammar rule', 'syntactic rule']
        )
      );
      if (overviewGrammar.length > 0) lesson.grammar = overviewGrammar;
    }

    const hasContent = Object.keys(lesson).length > 0;
    // Lesson material goes to its own file; the spine only records whether one
    // exists, which is all the "Open lesson" button and the validator need.
    delete (unit as unknown as Record<string, unknown>).lesson;
    if (hasContent) {
      (unit as unknown as Record<string, unknown>).hasLesson = true;
      if (apply) {
        fs.mkdirSync(LESSONS_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(LESSONS_DIR, `m${String(unitNo).padStart(2, '0')}.json`),
          JSON.stringify(lesson, null, 2) + '\n',
          'utf8'
        );
      }
    } else {
      delete (unit as unknown as Record<string, unknown>).hasLesson;
    }

    if (apply) {
      fs.writeFileSync(unitFile, JSON.stringify(unit, null, 2) + '\n', 'utf8');
      written += 1;
    }
    console.log(
      `m${String(unitNo).padStart(2, '0')}  ${hasContent ? countLesson(lesson) : 'NO CONTENT PARSED'}` +
        `${masterBlock ? '  [master]' : ''}${v3Block ? '  [v3]' : ''}${!apply ? '  (dry run)' : ''}`
    );
    for (const note of warn.slice(before)) console.log(note);
  }

  console.log(
    apply
      ? `\n✓ wrote lesson content into ${written} unit file(s).`
      : '\nDRY RUN — nothing written. Re-run with --apply.'
  );
}

main();


