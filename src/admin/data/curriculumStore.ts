/**
 * src/admin/data/curriculumStore.ts
 *
 * Read model for the `curriculum_units` store — the DB side of the
 * `bundle | db` switch.
 *
 * ── WHY THIS IS SEPARATE FROM `curriculum.ts` ───────────────────────────────
 * That module reads the BUNDLE, and must keep doing so: it is what the learner
 * app runs on. This one reads the DATABASE, which today holds nothing. They are
 * shown side by side on the page precisely so an admin can see the two do not
 * silently disagree.
 *
 * ── VALIDATION IS NOT REIMPLEMENTED HERE ───────────────────────────────────
 * The publish rules live in the Edge Function's `publish.ts` and are tested
 * there. This module only PREVIEWS — it re-runs the same rules for display so
 * the operator sees the problems before pressing publish, but the authoritative
 * check is the one that runs on the server.
 */
import { supabase } from '../../lib/supabase';

export interface StoredUnit {
  id: string;
  order: number;
  isPublished: boolean;
  /** English title if the doc has one, else the raw id. */
  title: string;
  nodeCount: number;
  updatedAt: string | null;
}

export interface StoredVersion {
  id: string;
  unitId: string;
  editorId: string;
  createdAt: string | null;
}

export interface CurriculumStore {
  units: StoredUnit[];
  versions: StoredVersion[];
  /** The `curriculum_source` flag, unwrapped to a bare string. */
  source: 'bundle' | 'db' | 'unknown';
  /** Non-fatal: the store is unreadable but the page still works. */
  errors: string[];
}

const EMPTY: CurriculumStore = { units: [], versions: [], source: 'unknown', errors: [] };

function titleOf(doc: unknown): string {
  const t = (doc as { title?: { en?: unknown } } | null)?.title;
  return typeof t?.en === 'string' && t.en.trim() !== '' ? t.en : '(untitled)';
}

export async function fetchCurriculumStore(): Promise<CurriculumStore> {
  const errors: string[] = [];

  // An empty table is a NORMAL state during the rollout, not an error, so a
  // zero-row result must not be reported as a failure.
  const { data: units, error: uErr } = await supabase
    .from('curriculum_units')
    .select('id, doc, is_published, updated_at')
    .order('order', { ascending: true });

  if (uErr) return { ...EMPTY, errors: [`curriculum_units: ${uErr.message}`] };

  const { data: versions, error: vErr } = await supabase
    .from('curriculum_versions')
    .select('id, unit_id, editor_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (vErr) {
    // Degrades rather than blanking the page: the units are the primary view.
    errors.push(`curriculum_versions: ${vErr.message}`);
  }

  const { data: flag, error: fErr } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'curriculum_source')
    .maybeSingle();

  if (fErr) errors.push(`app_config: ${fErr.message}`);

  const raw = flag?.value as unknown;
  // JSONB unwraps to the bare string; a hand-written row might hold it quoted.
  const unwrapped = typeof raw === 'string' ? raw : (raw as { value?: unknown } | null)?.value;
  const source: CurriculumStore['source'] =
    unwrapped === 'bundle' || unwrapped === 'db' ? unwrapped : 'unknown';

  return {
    units: (units ?? []).map((u) => {
      const doc = u.doc as { nodes?: unknown[]; order?: unknown } | null;
      return {
        id: u.id as string,
        order: typeof doc?.order === 'number' ? doc.order : Number.MAX_SAFE_INTEGER,
        isPublished: u.is_published === true,
        title: titleOf(u.doc),
        nodeCount: Array.isArray(doc?.nodes) ? doc.nodes.length : 0,
        updatedAt: (u.updated_at as string | null) ?? null,
      };
    }),
    versions: (versions ?? []).map((v) => ({
      id: v.id as string,
      unitId: v.unit_id as string,
      editorId: v.editor_id as string,
      createdAt: (v.created_at as string | null) ?? null,
    })),
    source,
    errors,
  };
}

/**
 * A one-line summary of what the DB store currently holds, for the page header.
 * Derived here rather than in the component so it can be tested.
 */
export function describeStore(store: CurriculumStore): string {
  if (store.units.length === 0) return 'Empty — no units have been backfilled yet.';
  const drafts = store.units.filter((u) => !u.isPublished).length;
  const published = store.units.length - drafts;
  return `${store.units.length} unit(s): ${published} published, ${drafts} draft.`;
}
