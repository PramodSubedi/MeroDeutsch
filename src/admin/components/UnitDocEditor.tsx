/**
 * src/admin/components/UnitDocEditor.tsx
 *
 * Authors a unit DRAFT in the control centre.
 *
 * So `db` is only offered when there are published units to serve, and the
 * disabled state says why. A UI-level safety rail on top of the server's
 * validation, not a replacement for it.
 */
/**
 * src/admin/components/UnitDocEditor.tsx
 *
 * Authors a unit DRAFT in the control centre.
 *
 * ── WHY THIS EDITS JSON RATHER THAN FIELDS ─────────────────────────────────
 * A unit is `{ id, order, title: {en, ne, de}, goals, nodes: [...] }` and the
 * node shape is the curriculum's own — a form per node kind would be a second,
 * divergent definition of it, and every new node kind would silently become
 * uneditable. The document is the interface, so the editor edits the document
 * and leans on the server's `checkUnitShape` for the real rules.
 *
 * ── WHY SAVE ≠ PUBLISH ─────────────────────────────────────────────────────
 * The Save button calls `unit.save`, which cannot publish. The operator must
 * still select the unit in the list and press Publish. That two-step separation
 * is the reason a draft edit is safe to hand to someone: the worst a mistake can
 * do is sit in an unpublished row.
 *
 * ── WHY THE STALE-WRITE GUARD ───────────────────────────────────────────────
 * Two admins open m07, both see the same document, both save. The second save
 * silently discards the first — no error, no audit trail of a lost edit, and
 * the first admin has no way of knowing their work is gone.
 *
 * `updated_at` is the revision. The editor records the one it read and refuses
 * to write if the row has moved since. It is a client-side courtesy check, not
 * a lock: it catches the realistic case (two humans in one session) and says so
 * plainly, rather than implying a guarantee the schema cannot provide. A
 * server-side `WHERE updated_at = ...` would be the real fix and needs a column
 * contract this table does not have yet.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { theme } from '../../config/theme';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';
import type { StoredUnit } from '../data/curriculumStore';

export function UnitDocEditor({
  unit,
  onSaved,
  onResult,
}: {
  unit: StoredUnit;
  onSaved: () => void;
  onResult: (r: AdminActionResult) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(unit.doc, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The revision this text was loaded from. Reset whenever the unit changes, so
  // switching units never carries another unit's guard with it.
  const [baseRevision, setBaseRevision] = useState(unit.updatedAt);

  useEffect(() => {
    setText(JSON.stringify(unit.doc, null, 2));
    setParseError(null);
    setBaseRevision(unit.updatedAt);
  }, [unit.id, unit.doc, unit.updatedAt]);

  async function save() {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'That is not valid JSON.');
      return;
    }
    setParseError(null);

    // The guard. Refuse BEFORE calling the server, and say what to do about it.
    if (unit.updatedAt !== baseRevision) {
      setParseError(
        `${unit.id} was changed by someone else after you opened it. Reload the store to see their version before saving, or your edit would discard theirs.`,
      );
      return;
    }

    setBusy(true);
    const r = await runAdminAction({
      action: 'unit.save',
      save: { unitId: unit.id, doc },
      reason: `Draft edit to ${unit.id}`,
    });
    setBusy(false);
    onResult(r);
    if (r.ok) {
      setBaseRevision(new Date().toISOString());
      onSaved();
    }
  }

  return (
    <div className="mt-3 rounded border border-ink-200 p-3 dark:border-ink-800">
      <h3 className="text-section font-bold text-ink-900 dark:text-ink-50">
        Edit <span className="font-mono">{unit.id}</span>
        {unit.isPublished && (
          <span className="ml-2 rounded-full bg-success-100 px-2 py-0.5 text-micro font-extrabold uppercase text-success-800 dark:bg-success-900/60 dark:text-success-200">
            currently published
          </span>
        )}
      </h3>
      <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">
        Saving stores a draft. It does not go live until you publish it above.
      </p>

      <label className="mt-2 block text-meta font-semibold text-ink-700 dark:text-ink-200" htmlFor={`doc-${unit.id}`}>
        Unit document (JSON)
      </label>
      <textarea
        id={`doc-${unit.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={16}
        className="mt-1 w-full rounded border border-ink-200 bg-surface p-2 font-mono text-micro text-ink-900 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50"
      />

      {parseError && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1 rounded border border-danger-200 bg-danger-50 p-2 text-meta text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{parseError}</span>
        </p>
      )}

      <button type="button" onClick={() => void save()} disabled={busy} className={`mt-2 ${theme.button.secondary}`}>
        <Save className="h-4 w-4" aria-hidden="true" />
        {busy ? 'Saving…' : 'Save draft'}
      </button>
    </div>
  );
}
