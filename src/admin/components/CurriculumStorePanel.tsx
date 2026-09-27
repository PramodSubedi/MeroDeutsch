/**
 * src/admin/components/CurriculumStorePanel.tsx
 *
 * The DB side of the `bundle | db` switch, shown next to the bundle.
 *
 * ── WHY `db` IS NOT A ONE-CLICK TOGGLE ──────────────────────────────────────
 * Switching to `db` with no verified backfill would serve an empty course to
 * every learner. The resolver falls back to the bundle in that case, so the app
 * keeps working — but an admin would be toggling a flag they cannot see the
 * effect of.
 *
 * So `db` is only offered when there are published units to serve, and the
 * disabled state says why. A UI-level safety rail on top of the server's
 * validation, not a replacement for it.
 */
import { useCallback, useEffect, useState } from 'react';
import { Database, History, Rocket, Undo2 } from 'lucide-react';
import { theme } from '../../config/theme';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';
import { describeStore, fetchCurriculumStore, type CurriculumStore, type StoredUnit } from '../data/curriculumStore';
import { UnitDocEditor } from './UnitDocEditor';

export function CurriculumStorePanel() {
  const [store, setStore] = useState<CurriculumStore | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStore(await fetchCurriculumStore());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    setBusy(true);
    setResult(null);
    const r = await runAdminAction({ action: 'unit.publish', publish: { unitIds: selected } });
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setSelected([]);
      void load();
    }
  }

  /**
   * Restore a unit from a saved snapshot.
   *
   * The `confirm` is not decoration. A rollback replaces a document an operator
   * may have just spent an hour writing, and the UI lists versions newest-first,
   * so the row directly under the cursor is the one a misclick lands on. The
   * dialog names the unit and the timestamp rather than saying "are you sure?".
   */
  async function rollback(unitId: string, versionId: string, when: string | null) {
    const stamp = when ? new Date(when).toLocaleString() : 'an unrecorded date';
    if (!window.confirm(`Replace ${unitId} with the version saved ${stamp}? The current draft will be archived first, so this can be undone.`)) {
      return;
    }
    setBusy(true);
    setResult(null);
    const r = await runAdminAction({
      action: 'unit.rollback',
      rollback: { unitId, versionId },
      reason: `Rollback of ${unitId} to a saved version`,
    });
    setBusy(false);
    setResult(r);
    if (r.ok) void load();
  }

  async function setSource(value: 'bundle' | 'db') {
    setBusy(true);
    setResult(null);
    const r = await runAdminAction({
      action: 'config.set',
      config: { key: 'curriculum_source', value },
      reason: `curriculum_source set to ${value}`,
    });
    setBusy(false);
    setResult(r);
    if (r.ok) void load();
  }

  if (!store) {
    return (
      <p className="py-6 text-center text-body text-ink-500 dark:text-ink-400">Loading the store…</p>
    );
  }

  const publishedCount = store.units.filter((u) => u.isPublished).length;
  const canSwitchToDb = publishedCount > 0;
  // Resolved from the list rather than stored, so a reload that changes which
  // units exist cannot leave the editor pointing at a row that has gone.
  const editingUnit: StoredUnit | null = store.units.find((u) => u.id === editing) ?? null;

  return (
    <section aria-label="Database curriculum" className="rounded-lg border border-ink-200 p-4 dark:border-ink-800">
      <h2 className="flex items-center gap-2 text-section font-bold text-ink-900 dark:text-ink-50">
        <Database className="h-4 w-4" aria-hidden="true" />
        Database store
      </h2>
      <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">
        {describeStore(store)} The app is serving:{' '}
        <strong className="font-mono">
          {store.source === 'unknown' ? 'bundle (flag unreadable)' : store.source}
        </strong>
      </p>

      {store.errors.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-meta text-danger-700 dark:text-danger-300">
          {store.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      {store.units.length > 0 && (
        <>
          <ul className="mt-3 space-y-1">
            {store.units.map((u) => (
              <li key={u.id} className="flex items-center gap-2 text-meta">
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={(e) =>
                    setSelected((s) => (e.target.checked ? [...s, u.id] : s.filter((x) => x !== u.id)))
                  }
                  aria-label={`Select ${u.id}`}
                />
                <span className="w-10 font-mono text-ink-900 dark:text-ink-50">{u.id}</span>
                <span className="min-w-0 flex-1 truncate text-ink-700 dark:text-ink-200">{u.title}</span>
                <span className="text-ink-500 dark:text-ink-400">{u.nodeCount} nodes</span>
                <button
                  type="button"
                  onClick={() => setEditing(editing === u.id ? null : u.id)}
                  aria-expanded={editing === u.id}
                  aria-label={`${editing === u.id ? 'Close editor for' : 'Edit'} ${u.id}`}
                  className="rounded p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-50"
                >
                  <History className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-extrabold uppercase ${
                    u.isPublished
                      ? 'bg-success-100 text-success-800 dark:bg-success-900/60 dark:text-success-200'
                      : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
                  }`}
                >
                  {u.isPublished ? 'Published' : 'Draft'}
                </span>
              </li>
            ))}
          </ul>
          {editingUnit && (
            <UnitDocEditor unit={editingUnit} onSaved={() => void load()} onResult={setResult} />
          )}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || selected.length === 0}
            className={`mt-3 ${theme.button.secondary}`}
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Publishing…' : `Publish ${selected.length} selected`}
          </button>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-200 pt-3 dark:border-ink-800">
        <button type="button" onClick={() => void setSource('bundle')} disabled={busy} className={theme.button.secondary}>
          Serve the bundle
        </button>
        <button
          type="button"
          onClick={() => void setSource('db')}
          disabled={busy || !canSwitchToDb}
          title={canSwitchToDb ? undefined : 'No published units to serve yet'}
          className={theme.button.secondary}
        >
          Serve the database
        </button>
        {!canSwitchToDb && (
          <span className="text-meta text-ink-500 dark:text-ink-400">
            Publish at least one unit before serving the database.
          </span>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={`mt-2 rounded border p-2 text-meta ${
            result.ok
              ? 'border-success-200 bg-success-50 text-success-800 dark:border-success-900 dark:bg-success-950/30 dark:text-success-200'
              : 'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200'
          }`}
        >
          {result.message}
        </p>
      )}

      {store.versions.length > 0 && (
        <details className="mt-3 text-meta">
          <summary className="cursor-pointer text-ink-500 hover:text-ink-800 dark:text-ink-400">
            {store.versions.length} version snapshot(s) — rollback history
          </summary>
          <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
            Each snapshot holds the unit as it was before a later edit or publish. Restoring one archives the
            current draft first, so a rollback can itself be rolled back.
          </p>
          <ul className="mt-1 space-y-0.5">
            {store.versions.map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-micro text-ink-600 dark:text-ink-300">
                <span className="font-mono">
                  {v.unitId} · {v.createdAt ? new Date(v.createdAt).toLocaleString() : '—'} · {v.editorId.slice(0, 8)}
                </span>
                <button
                  type="button"
                  onClick={() => void rollback(v.unitId, v.id, v.createdAt)}
                  disabled={busy}
                  aria-label={`Restore ${v.unitId} to the version from ${v.createdAt ?? 'an unknown date'}`}
                  className="ml-auto inline-flex items-center gap-1 rounded border border-ink-300 px-2 py-0.5 text-micro font-semibold hover:bg-ink-100 disabled:opacity-50 dark:border-ink-700 dark:hover:bg-ink-800"
                >
                  <Undo2 className="h-3 w-3" aria-hidden="true" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
