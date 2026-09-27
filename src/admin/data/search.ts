/**
 * src/admin/data/search.ts
 *
 * The model behind the global Ctrl/⌘K palette.
 *
 * ── WHY SEARCH IS LOCAL, NOT A QUERY ───────────────────────────────────────
 * The palette searches the data the page has ALREADY loaded. Firing a query per
 * keystroke would make the fastest interaction in the tool the slowest, and
 * would need debouncing, cancellation and a rate limit — for a tool whose
 * largest table is 1,062 rows. Everything is already in memory.
 *
 * The trade-off is deliberate and worth stating: results are only as fresh as
 * the current page's data. A user who has not visited the Users page cannot
 * find a user from the palette. That is why every result carries the route to
 * go and refresh it.
 */
import type { AdminUserRow } from './users';
import type { VocabRow } from './vocabulary';
import type { AuditEntry } from './auditLog';

export type SearchGroup = 'navigation' | 'users' | 'vocabulary' | 'audit';

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
}

export interface SearchOptions {
  /** Cap per group, so one huge group cannot bury the navigation shortcuts. */
  perGroup?: number;
}

const NAV: SearchHit[] = [
  { id: 'nav-dashboard', group: 'navigation', title: 'Dashboard', to: '/', score: 100 },
  { id: 'nav-users', group: 'navigation', title: 'Users', to: '/users', score: 100 },
  { id: 'nav-review', group: 'navigation', title: 'Review queue', to: '/review-queue', score: 100 },
  { id: 'nav-curriculum', group: 'navigation', title: 'Curriculum', to: '/curriculum', score: 100 },
  { id: 'nav-vocab', group: 'navigation', title: 'Vocabulary', to: '/vocabulary', score: 100 },
  { id: 'nav-integrity', group: 'navigation', title: 'Content integrity', to: '/integrity', score: 100 },
  { id: 'nav-audit', group: 'navigation', title: 'Audit log', to: '/audit-log', score: 100 },
  { id: 'nav-analytics', group: 'navigation', title: 'Analytics', to: '/analytics', score: 100 },
  { id: 'nav-system', group: 'navigation', title: 'System', to: '/system', score: 100 },
];

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

  hits.sort((x, y) => y.score - x.score);

  // Cap per group so a broad query cannot push the navigation shortcuts off the
  // list entirely — those are the most predictable results a user wants.
  const perGroupCounts = new Map<SearchGroup, number>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const n = perGroupCounts.get(h.group) ?? 0;
    if (n >= perGroup) continue;
    perGroupCounts.set(h.group, n + 1);
    out.push(h);
    if (out.length >= perGroup * 4) break;
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
