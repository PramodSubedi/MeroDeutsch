import { supabase } from '../../lib/supabase';
import type { StoredUnit } from './curriculumStore';

export type ContentGroup = 'content' | 'unit';

export interface ContentItemRow {
  id: string;
  contentType: string;
  /** A short human label, best-effort — payloads have 15 different shapes. */
  label: string;
}

export interface ContentItemsResult {
  rows: ContentItemRow[];
  errors: string[];
}

/**
 * `content_items.payload` has ~15 different shapes and no JSON schema, so there
 * is no single "title" field to read. Rather than pretend, the label states what
 * the row IS — its type and id — which is what an admin searching for it
 * actually knows. Inventing a title field that works for 4 of 15 types would
 * make the other 11 silently unsearchable.
 */
function labelFor(id: string, contentType: string, payload: unknown): string {
  const p = payload as Record<string, unknown> | null;
  if (p && typeof p === 'object') {
    for (const key of ['word', 'lemma', 'phrase', 'title', 'text', 'name', 'prompt', 'question']) {
      const v = p[key];
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
  }
  return `${contentType} · ${id}`;
}

export async function fetchContentItems(limit = 2000): Promise<ContentItemsResult> {
  const errors: string[] = [];
  const { data, error } = await supabase
    .from('content_items')
    .select('id, content_type, payload')
    .limit(limit);

  if (error) return { rows: [], errors: [`content_items: ${error.message}`] };

  const rows: ContentItemRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    contentType: r.content_type as string,
    label: labelFor(r.id as string, r.content_type as string, r.payload),
  }));
  return { rows, errors };
}

/**
 * Read every stored unit's `doc` so the palette can search INSIDE curriculum
 * content, not just the unit id.
 *
 * Returns the raw docs rather than `StoredUnit`s because the searchable text
 * lives in the document, and there is no Content page to deep-link into — hits
 * navigate to /curriculum, which lists the units.
 */
export async function fetchUnitDocs(): Promise<{ docs: { id: string; doc: unknown }[]; errors: string[] }> {
  const { data, error } = await supabase.from('curriculum_units').select('id, doc');
  if (error) return { docs: [], errors: [`curriculum_units: ${error.message}`] };
  return { docs: (data ?? []).map((r) => ({ id: r.id as string, doc: r.doc })), errors: [] };
}

/** Collect the searchable strings inside a unit document. */
export function unitDocText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown, depth = 0): void => {
    if (depth > 6 || v === null || v === undefined) return;
    if (typeof v === 'string') {
      if (v.trim()) parts.push(v.trim());
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1);
    }
  };
  walk(doc);
  return parts.join(' ');
}

export type { StoredUnit };
