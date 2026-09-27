/**
 * The `vocab.repair` form.
 *
 * ── WHY IT IS A TEXTAREA, NOT A TABLE OF INPUTS ────────────────────────────
 * A grid of 45 input boxes implies "here are the rows to fix", which is exactly
 * the claim the page above disclaims: some flagged rows are CORRECT. Pasting
 * only the rows an admin has actually decided to change keeps the judgement with
 * the person who can read German, and means an untouched row can never be
 * submitted by accident.
 *
 * ── WHY IT IS ALL-OR-NOTHING ───────────────────────────────────────────────
 * The function rejects the entire batch if any single edit is invalid, so the
 * form states that up front rather than letting an operator discover it after
 * composing twenty fixes.
 */
import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { theme } from '../../config/theme';
import { runAdminAction, type AdminActionResult, type RepairEditInput } from '../data/adminActions';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Parse `word<TAB>translation` lines into edits.
 *
 * Only `translation_en` is offered here. That is the field the corruption is in,
 * and every other field is a separate judgement the page above says needs a
 * human. Exported for the test suite.
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

export function VocabularyRepair({ onDone, disabled }: { onDone: () => void; disabled: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);

  const parsed = parseRepairLines(text);
  const ready = parsed.edits.length > 0 && parsed.problems.length === 0 && !busy && !disabled;

  async function submit() {
    setBusy(true);
    setResult(null);
    const r = await runAdminAction({ action: 'vocab.repair', edits: parsed.edits });
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setText('');
      onDone();
    }
  }

  return (
    <section aria-label="Repair vocabulary" className="rounded-lg border border-ink-200 p-4 dark:border-ink-800">
      <h2 className="flex items-center gap-2 text-section font-bold text-ink-900 dark:text-ink-50">
        <Wrench className="h-4 w-4" aria-hidden="true" />
        Repair a flagged row
      </h2>
      <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">
        Paste one <code className="font-mono">row-uuid&lt;TAB&gt;correct english</code> per line. Only
        rows you list are touched, and if any line is invalid the whole batch is rejected rather
        than partly applied.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={'029d6f9a-1381-471b-8b6a-27bee0e06bde\tto stop'}
        aria-label="Repair lines"
        className={`mt-3 w-full font-mono text-meta ${theme.input}`}
      />
      {parsed.problems.length > 0 && text.trim().length > 0 && (
        <ul className="mt-1 list-inside list-disc text-meta text-danger-700 dark:text-danger-300">
          {parsed.problems.slice(0, 5).map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {parsed.edits.length > 0 && !looksLikeIds(parsed.edits) && (
        <p className="mt-1 text-meta text-danger-700 dark:text-danger-300">
          The first column must be the row's UUID from the Vocabulary page, not its word — the server
          only accepts UUIDs.
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready}
          className={theme.button.primary}
        >
          {busy ? 'Repairing…' : `Repair ${parsed.edits.length || 0} row(s)`}
        </button>
        {result && (
          <p
            role="status"
            className={`text-meta ${result.ok ? 'text-success-700 dark:text-success-300' : 'text-danger-700 dark:text-danger-300'}`}
          >
            {result.message}
          </p>
        )}
      </div>
    </section>
  );
}
