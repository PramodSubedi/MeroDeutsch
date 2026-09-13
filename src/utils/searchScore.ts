/**
 * utils/searchScore.ts
 *
 * Dependency-free fuzzy + ranked text scoring for the Glossary / Vocab
 * surfaces. No fuse.js, no lodash — just normalized token matching with a
 * lightweight Levenshtein for the "did you mean" tolerance on short terms.
 *
 * Philosophy:
 *   - Terms are lower-cased, accent-folded, and split into contiguous tokens
 *     (minus separators). German umlauts are folded so "für" matches "fur".
 *   - A candidate matches if EVERY query token matches at least one source
 *     field (prefix, token, or fuzzy). This keeps results precise.
 *   - Candidates are ranked by a weighted score that prefers exact word /
 *     prefix / early-position matches over fuzzy ones.
 */

/** Normalize a term for matching: lowercase + remove diacritics. */
export function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ß]/g, 'ss');
}

/** Split a normalized query/candidate into tokens, dropping empty ones. */
export function tokenizeQuery(input: string): string[] {
  return normalizeTerm(input)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Levenshtein distance — used for near-miss tolerance on short tokens. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Uint32Array(n + 1);
  const curr = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev.set(curr);
  }
  return prev[n];
}

/** Describe one field to search across. */
export interface SearchField<T> {
  /** Human label (e.g. 'German', 'English') — used to report match location. */
  label: string;
  /** Extracts a searchable string from the candidate. */
  get: (item: T) => string;
  /** Weight for this field vs others (German lemma should outrank English). */
  weight: number;
}

export interface SearchResult<T> {
  item: T;
  /** Higher = better match. 0 means no match. */
  score: number;
  /** Which field anchored the strongest match (for badge/highlight hints). */
  matchedField: string;
  /** The normalized substring that matched (for highlight rendering). */
  matchText: string;
}
const FIELD_MATCH_WEIGHTS = {
  exact: 100,
  prefix: 60,
  word: 40,
  substring: 20,
  fuzzy: 8,
} as const;

interface FieldMatch {
  exact: boolean;
  prefix: boolean;
  word: boolean;
  substring: boolean;
  fuzzy: boolean;
  position: number;
}

function scoreFieldMatch(m: FieldMatch): number {
  if (m.exact) return FIELD_MATCH_WEIGHTS.exact;
  if (m.prefix) return FIELD_MATCH_WEIGHTS.prefix - Math.min(m.position, 10);
  if (m.word) return FIELD_MATCH_WEIGHTS.word - Math.min(m.position, 10);
  if (m.substring) return FIELD_MATCH_WEIGHTS.substring;
  if (m.fuzzy) return FIELD_MATCH_WEIGHTS.fuzzy;
  return 0;
}

function hasAnyMatch(m: FieldMatch): boolean {
  return m.exact || m.prefix || m.word || m.substring || m.fuzzy;
}

/**
 * Collect the strongest field match for ONE query token across all fields.
 * Returns null when no field contains the token (candidate then fails).
 */
function bestFieldMatchForToken<T>(
  item: T,
  qToken: string,
  fields: SearchField<T>[]
): { match: FieldMatch; field: SearchField<T> } | null {
  let best: { match: FieldMatch; field: SearchField<T> } | null = null;

  for (const field of fields) {
    const fieldText = field.get(item);
    const fieldTokens = tokenizeQuery(fieldText);
    if (fieldTokens.length === 0) continue;
    const joined = fieldTokens.join(' ');

    let curPos = 0;
    for (const fToken of fieldTokens) {
      curPos += fToken.length + 1;
      const match: FieldMatch = {
        exact: fToken === qToken,
        prefix: fToken.startsWith(qToken),
        word: fToken.includes(qToken),
        substring: joined.includes(qToken),
        fuzzy: false,
        position: curPos,
      };
      if (
        !match.exact &&
        !match.prefix &&
        !match.word &&
        !match.substring &&
        qToken.length >= 4 &&
        levenshtein(fToken, qToken) <= Math.max(1, Math.floor(qToken.length / 4))
      ) {
        match.fuzzy = true;
      }
      if (!hasAnyMatch(match)) continue;
      const weighted = field.weight * scoreFieldMatch(match);
      const bestWeighted = best
        ? best.field.weight * scoreFieldMatch(best.match)
        : -1;
      if (best === null || weighted > bestWeighted) {
        best = { match, field };
      }
    }
  }

  return best;
}

/**
 * Score a single candidate against the (pre-tokenized) query.
 * Returns null when the candidate does not match every query token.
 *
 * Semantics: a candidate matches when EVERY query token appears in AT LEAST
 * ONE of its fields (a token missing from the German lemma may still hit the
 * English or Nepali column). The strongest field match per token drives the
 * score, so German hits outrank language-helper hits.
 */
function scoreCandidate<T>(
  item: T,
  queryTokens: string[],
  fields: SearchField<T>[]
): SearchResult<T> | null {
  let result: SearchResult<T> | null = null;

  for (const qToken of queryTokens) {
    const best = bestFieldMatchForToken(item, qToken, fields);
    if (!best) return null; // this token matched no field → candidate excluded
    if (result === null) {
      result = { item, score: 0, matchedField: best.field.label, matchText: qToken };
    }
    result.score += best.field.weight * scoreFieldMatch(best.match);
    result.matchedField = best.field.label;
  }

  return result;
}

export interface RankedSearchOptions<T> {
  /** Query string (may be empty). */
  query: string;
  /** Items to search over. */
  items: readonly T[];
  /** Fields to match against, in priority order. */
  fields: SearchField<T>[];
  /** Optional minimum score to include (defaults to 1). */
  minScore?: number;
  /** Optional max results (defaults to all matches). */
  limit?: number;
}

/**
 * Ranked fuzzy search. Returns matches sorted by descending score.
 * Empty/whitespace query returns all items (score 0) up to `limit`.
 */
export function rankedSearch<T>(options: RankedSearchOptions<T>): SearchResult<T>[] {
  const { query, items, fields, minScore = 1, limit } = options;
  const trimmed = query.trim();
  if (!trimmed) {
    const all = items.map((item) => ({ item, score: 0, matchedField: '', matchText: '' }));
    return limit ? all.slice(0, limit) : all;
  }

  const queryTokens = tokenizeQuery(trimmed);
  if (queryTokens.length === 0) return [];

  const results: SearchResult<T>[] = [];
  for (const item of items) {
    const r = scoreCandidate(item, queryTokens, fields);
    if (r && r.score >= minScore) results.push(r);
  }
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return items.indexOf(a.item) - items.indexOf(b.item);
  });
  return limit ? results.slice(0, limit) : results;
}
