/**
 * src/data/contentPools.ts
 *
 * Runtime cold-start snapshot of every curriculum content pool, generated from
 * `scripts/genContentPools.ts`. `useDexieInit` seeds these into the Dexie
 * `contentItems` table when it is empty, so the app has real content on a
 * first-ever OFFLINE cold start (previously every pool returned [] until the
 * first online fetch populated the cache). Once online, the content pools are
 * refreshed from the Supabase `content_items` table as before.
 */
import contentPoolsJson from './content-pools.json';

export interface ColdStartContentItem {
  id: string;
  payload: unknown;
  sort: number;
}

export interface ColdStartContentPool {
  contentType: string;
  items: ColdStartContentItem[];
}

const raw: ColdStartContentPool[] = contentPoolsJson as ColdStartContentPool[];

/** All bundled curriculum content pools, keyed by their `content_type`. */
export function getColdStartPools(): ColdStartContentPool[] {
  return raw;
}