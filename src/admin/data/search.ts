/**
 * src/admin/data/search.ts
 *
 * The model behind the global Ctrl/⌘K palette.
 *
 * ── WHY SEARCH IS LOCAL, NOT A QUERY ───────────────────────────────────────
 * The palette searches data the shell has ALREADY loaded. Firing a query per
 * keystroke would make the fastest interaction in the tool the slowest, and
 * would need debouncing, cancellation and a rate limit.
 *
 * The old justification here was "the largest table is 1,062 rows, everything is
 * already in memory". That was never quite true and has stopped being true: the
 * index is BUILT by the shell from `fetchUsers` (six queries) plus four more
 * loaders, and the users table has no bound at all. The honest statement is that
 * this scales to one admin session's read, not to the size of the product — and
 * where a read is capped, the index holds the capped subset, which is why
 * `truncated` is now reported instead of swallowed.
 *
 * The trade-off is deliberate: results are only as fresh as the index, so every
 * hit carries the route to the page that CAN filter for it. Both destinations
 * read the `?q=` parameter — they did not until the deep link was wired, so
 * every one of these links used to land on an unfiltered table.
 *
 * ── AND THE INDEX IS BUILT ONCE, NOT PER NAVIGATION ────────────────────────
 * It used to rebuild on every route change: twelve queries, each time an admin
 * clicked a nav item. See `AdminLayout.tsx`.
 */
import type { AdminUserRow } from './users';
import type { VocabRow } from './vocabulary';
import type { AuditEntry } from './auditLog';
import { unitDocText } from './contentItems';

export type SearchGroup = 'navigation' | 'users' | 'vocabulary' | 'audit' | 'content' | 'unit';

/** The groups a palette hit can be tagged with. Drives the total cap, so keep in sync. */
export const GROUPS = [
  { id: 'navigation', label: 'Go to' },
  { id: 'users', label: 'Users' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'audit', label: 'Audit' },
  { id: 'content', label: 'Content' },
  { id: 'unit', label: 'Units' },
] as const;

/**
 * The palette's five loaders, in the order `refreshIndex` awaits them. Named so
 * a failed load can say WHICH group went missing — the previous
 * `.catch(() => ({ rows: [] }))` made a rejected read indistinguishable from an
 * empty table, so a broken RLS policy produced a palette that quietly stopped
 * finding users with nothing anywhere reporting it.
 */
export const SEARCH_SOURCES = [
  'users',
  'vocabulary',
  'audit',
  'content',
  'unitDocs',
] as const;

/**
 * The route map, owned here.
 *
 * It was duplicated: a nine-entry literal in this file and a ten-entry table in
 * `AdminLayout.tsx`, drifting by one. The ninth entry here was missing `/debug`
 * entirely, so the QA simulator — a real, routed page — could not be found by
 * searching for it. `check:routes` asserted the table against the routes but not
 * the two tables against each other.
 *
 * `AdminLayout` now imports this, so the sidebar and the palette cannot disagree
 * about what pages exist.
 */
export const NAV_ITEMS: readonly { to: string; label: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Users' },
  { to: '/curriculum', label: 'Curriculum' },
  { to: '/vocabulary', label: 'Vocabulary' },
  { to: '/chatbot', label: 'Chatbot' },
  { to: '/integrity', label: 'Integrity' },
  { to: '/audit-log', label: 'Audit log' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/system', label: 'System' },
  { to: '/debug', label: 'QA simulator' },
];

export interface SearchHit {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  /** Where to navigate. Present on every hit. */
  to: string;
  /** Higher sorts first. */
  score: number;
}

export interface SearchIndexInput {
  users?: AdminUserRow[];
  vocabulary?: VocabRow[];
  audit?: AuditEntry[];
  /** `content_items` rows — the curriculum practice pools. */
  content?: { id: string; contentType: string; label: string }[];
  /** `curriculum_units` documents, so unit CONTENT is searchable, not just ids. */
  unitDocs?: { id: string; doc: unknown }[];
}

export interface SearchOptions {
  /** Cap per group, so one huge group cannot bury the navigation shortcuts. */
  perGroup?: number;
}

/**
 * The palette's own copy of the route table, derived — not retyped.
 *
 * It used to be a nine-entry literal against `AdminLayout`'s ten, drifting by
 * one, with `/debug` missing entirely. So the QA simulator — a real, routed
 * page — could not be found by searching for it. The table now lives in
 * `NAV_ITEMS` and `AdminLayout` imports that, so the sidebar and the palette
 * cannot disagree about which pages exist.
 */
const NAV: SearchHit[] = NAV_ITEMS.map((item) => ({
  id: `nav-${item.to === '/' ? 'dashboard' : item.to.slice(1)}`,
  group: 'navigation' as SearchGroup,
  title: item.label,
  to: item.to,
  score: 100,
}));

/**
 * Score a match. Prefix beats substring, and a title match beats a subtitle
 * match, so typing "use" surfaces "Users" above a user called "Sunny".
 */
export function scoreMatch(needle: string, ...fields: (string | null | undefined)[]): number {
  if (!needle) return 0;
  let best = 0;
  fields.forEach((field, i) => {
    if (!field) return;
    const hay = field.toLowerCase();
    const at = hay.indexOf(needle);
    if (at === -1) return;
    // Earlier is better; a title hit (i === 0) outranks any subtitle hit.
    const positional = at === 0 ? 40 : at === 1 ? 30 : 20;
    const fieldWeight = i === 0 ? 20 : 8;
    best = Math.max(best, positional + fieldWeight);
  });
  return best;
}

/** Build hits for one query across everything currently loaded. */
export function searchAll(input: SearchIndexInput, query: string, options: SearchOptions = {}): SearchHit[] {
  const perGroup = options.perGroup ?? 6;
  const q = query.trim().toLowerCase();

  // An empty query shows the navigation shortcuts only. Listing 1,000 vocabulary
  // rows to someone who has not typed anything is noise, not help.
  if (!q) return NAV.slice(0, perGroup);

  const hits: SearchHit[] = [];

  for (const n of NAV) {
    const s = scoreMatch(q, n.title);
    if (s > 0) hits.push({ ...n, score: s + 50 });
  }

  for (const u of input.users ?? []) {
    const s = scoreMatch(q, u.username, u.fullName, u.id);
    if (s > 0) {
      hits.push({
        id: `user-${u.id}`,
        group: 'users',
        title: u.fullName || u.username || u.id,
        subtitle: `${u.role ?? 'user'} · ${u.plan ?? 'free'}`,
        to: `/users?q=${encodeURIComponent(u.id)}`,
        score: s,
      });
    }
  }

  for (const v of input.vocabulary ?? []) {
    const s = scoreMatch(q, v.word, v.translationEn, v.translationNp);
    if (s > 0) {
      hits.push({
        id: `vocab-${v.id}`,
        group: 'vocabulary',
        title: v.word,
        subtitle: v.translationEn ?? '',
        to: `/vocabulary?q=${encodeURIComponent(v.word)}`,
        score: s - 5,
      });
    }
  }

  for (const a of input.audit ?? []) {
    const s = scoreMatch(q, a.action, a.targetId, a.adminName);
    if (s > 0) {
      hits.push({
        id: `audit-${a.id}`,
        group: 'audit',
        title: a.action,
        subtitle: a.targetId ?? '',
        to: '/audit-log',
        score: s - 10,
      });
    }
  }

  // `content_items` — the curriculum practice pools. Scored BELOW both vocabulary
  // and unit: a pool row is the least specific thing that can match.
  for (const c of input.content ?? []) {
    const s = scoreMatch(q, c.label, c.contentType, c.id);
    if (s > 0) {
      hits.push({
        id: `content-${c.contentType}-${c.id}`,
        group: 'content',
        title: c.label,
        subtitle: c.contentType,
        to: '/curriculum',
        score: s - 30,
      });
    }
  }

  // `curriculum_units` — searching the DOCUMENT, not just the id, so "Restaurant"
  // finds unit m10 without the admin having to know it is m10.
  for (const u of input.unitDocs ?? []) {
    const text = unitDocText(u.doc);
    const s = scoreMatch(q, u.id, text);
    if (s > 0) {
      hits.push({
        id: `unit-${u.id}`,
        group: 'unit',
        title: `Unit ${u.id}`,
        subtitle: text.length > 90 ? `${text.slice(0, 90)}…` : text,
        to: '/curriculum',
        // Above content, below vocabulary. A unit match names a chapter of the
        // course, which is a more useful answer than one pool row.
        score: s - 10,
      });
    }
  }

  hits.sort((x, y) => y.score - x.score);

  return interleaveByGroup(hits, perGroup);
}

/**
 * Take up to `perGroup` from EVERY group, then interleave them.
 *
 * ── WHY NOT JUST CAP THE SORTED LIST ────────────────────────────────────────
 * A per-group cap alone is not enough, because a single global cap over a
 * score-sorted list always favours whichever groups score highest. That was
 * measurably broken: `content` scores `s - 30` and `unit` scores `s - 10`, so
 * they always sort last, and with a total cap of `perGroup * 4` against six
 * groups they NEVER appeared on a broad query — the two groups an admin is
 * least likely to navigate to by memory, and therefore most in need of search.
 *
 * Raising the total cap did not fix it, it just moved the starvation: `users`
 * and `navigation` were then crowded out instead. Any fixed multiplier against
 * a score-ordered list has this property.
 *
 * The order is built rather than filtered. Each group is guaranteed its slice
 * up front, and the groups are interleaved in order of their BEST hit — so the
 * strongest match still leads, but nothing is ever absent. Budget left over by a
 * group with fewer than `perGroup` hits goes back to the pool by score, so a
 * small group does not waste the cap.
 */
export function interleaveByGroup(hits: readonly SearchHit[], perGroup: number): SearchHit[] {
  const byGroup = new Map<SearchGroup, SearchHit[]>();
  for (const h of hits) {
    const list = byGroup.get(h.group);
    if (list) list.push(h);
    else byGroup.set(h.group, [h]);
  }

  // Rank the groups by their strongest hit, so the interleaving preserves the
  // operator's sense of "best match first" as far as it can.
  const ordered = [...byGroup.values()].sort(
    (a, b) => (b[0]?.score ?? 0) - (a[0]?.score ?? 0),
  );

  // Each group's guaranteed slice, trimmed to `perGroup`.
  const slices = ordered.map((list) => list.slice(0, perGroup));
  const total = GROUPS.length * perGroup;

  const out: SearchHit[] = [];
  // `taken` also serves as the per-group count, so the spare-budget pass below
  // cannot quietly hand a group MORE than `perGroup` — which is the whole point
  // of the cap. Budget is shared, not per-group, but the limit is per-group.
  const taken = new Set<SearchHit>();

  for (let round = 0; round < perGroup; round += 1) {
    for (const slice of slices) {
      const hit = slice[round];
      if (hit) {
        out.push(hit);
        taken.add(hit);
      }
      if (out.length >= total) return out;
    }
  }

  // Spare capacity, because a group that matched only twice did not consume its
  // full slice. Drawn by score, still respecting every group's cap.
  if (out.length < total) {
    const used = new Map<SearchGroup, number>();
    for (const hit of out) used.set(hit.group, (used.get(hit.group) ?? 0) + 1);
    for (const hit of hits) {
      if (taken.has(hit)) continue;
      if ((used.get(hit.group) ?? 0) >= perGroup) continue;
      out.push(hit);
      taken.add(hit);
      used.set(hit.group, (used.get(hit.group) ?? 0) + 1);
      if (out.length >= total) break;
    }
  }

  return out;
}
/** The ⌘K / Ctrl+K chord, and Escape to dismiss. */
export function isOpenHotkey(e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  return (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
}

export function isDismissKey(key: string): boolean {
  return key === 'Escape';
}
