/**
 * utils/questionGenerator.ts
 *
 * Shared, data-agnostic question-generation primitives for all quiz surfaces.
 *
 * The module does NOT fetch data — callers pass in arrays they already have
 * (typically from `curriculumService`). This keeps the logic pure, testable,
 * and independent of whether content comes from Supabase, local JSON, or any
 * future source.
 *
 * Provides:
 *   - pickRandom       — pick one item, optionally excluding others (e.g. the last card)
 *   - pickNUnique      — pick N distinct items, deduplicated by a key function
 *   - buildMcq         — build a full multiple-choice option set (correct + decoys, shuffled)
 *   - buildQuestionDeck — shuffled deck of N unique items (for timed rotation games)
 */

import { shuffleArray } from './shuffleArray';

export interface PickNUniqueOptions<T> {
  /** The pool to draw from. */
  items: T[];
  /** Number of items to pick. */
  count: number;
  /** Optional function returning a unique key for dedupe. Falls back to reference identity. */
  getKey?: (item: T) => string;
  /** Optional exclusion predicate — items matching this are never picked. */
  exclude?: (item: T) => boolean;
  /** Optional positive seed for deterministic picks (e.g. daily challenge). */
  seed?: number;
}

export interface BuildMcqOptions<T> {
  /** The answer item that must be included. */
  correctItem: T;
  /** The full pool of items used for decoys (and to locate the correct item). */
  allItems: T[];
  /** Function returning a unique key (id, noun, de, etc.). Defaults to reference identity. */
  getKey?: (item: T) => string;
  /** Total options desired (correct + decoys). Defaults to 4. */
  count?: number;
  /** Optional seed for deterministic decoy selection. */
  seed?: number;
  /** If true (default), the correct item is excluded from the decoy pool. */
  excludeCorrect?: boolean;
}

/** Deterministic pseudo-random number generator (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Inner seeded shuffle. Returns a new array without mutating the input.
 * Uses `Math.random()` when no seed is provided.
 */
function seededShuffle<T>(items: T[], seed?: number): T[] {
  if (seed === undefined) return shuffleArray(items);
  const rand = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const defaultKey = <T,>(item: T): string => {
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if (typeof obj.id === 'string') return obj.id;
    if (typeof obj.noun === 'string') return obj.noun;
    if (typeof obj.de === 'string') return obj.de;
    if (typeof obj.word === 'string') return obj.word;
    if (typeof obj.letter === 'string') return obj.letter;
  }
  return String(item);
};

/**
 * Pick one random item, optionally excluding specific items.
 * Returns `null` when the pool is empty or all items are excluded.
 */
export function pickRandom<T>(
  items: readonly T[],
  exclude?: (item: T) => boolean
): T | null {
  if (items.length === 0) return null;
  const pool = exclude ? items.filter((item) => !exclude(item)) : [...items];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Pick N unique items from the pool, deduplicated by `getKey`.
 * Falls back to returning however many are available if `count` exceeds the pool.
 * When `seed` is provided, the selection is deterministic.
 */
export function pickNUnique<T>(options: PickNUniqueOptions<T>): T[] {
  const { items, count, getKey = defaultKey, exclude, seed } = options;
  const seen = new Set<string>();
  const pool = items.filter((item) => {
    if (exclude && exclude(item)) return false;
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (seed !== undefined) {
    return seededShuffle(pool, seed).slice(0, Math.min(count, pool.length));
  }
  return shuffleArray(pool).slice(0, Math.min(count, pool.length));
}

/**
 * Build a full multiple-choice option set: the correct item plus decoys,
 * guaranteed unique by key, then shuffled (seeded if provided).
 * The correct key is always present; decoys never equal it.
 */
export function buildMcq<T>(options: BuildMcqOptions<T>): T[] {
  const {
    correctItem,
    allItems,
    getKey = defaultKey,
    count = 4,
    seed,
    excludeCorrect = true,
  } = options;

  const correctKey = getKey(correctItem);
  const decoyPool = allItems.filter((item) => {
    if (excludeCorrect && getKey(item) === correctKey) return false;
    return true;
  });

  const decoys = pickNUnique({
    items: decoyPool,
    count: Math.max(0, count - 1),
    getKey,
    seed,
  });

  return seededShuffle([correctItem, ...decoys], seed);
}

/**
 * Build a shuffled deck of N unique items — used by timed rotation games
 * (Rapid Fire, Rapid Blitz) wanting a fixed-size, non-repeating sequence.
 */
export function buildQuestionDeck<T>(
  items: T[],
  count: number,
  getKey?: (item: T) => string
): T[] {
  return pickNUnique({ items, count, getKey });
}

/**
 * Draw one item from a pool without replacement, tracking used keys so the
 * same item is not repeated until the whole pool has been shown.
 *
 * When the pool is exhausted (all keys used), the used-set is reset and the
 * pool reshuffled, so a new round begins. This prevents the "same question
 * repeats" feeling within a session.
 *
 * Returns `null` when the pool is empty.
 */
export function drawWithoutReplacement<T>(
  pool: readonly T[],
  usedKeys: Set<string>,
  getKey: (item: T) => string = defaultKey
): T | null {
  if (pool.length === 0) return null;

  // Candidate items not yet shown this round.
  const remaining = pool.filter((item) => !usedKeys.has(getKey(item)));

  // Round complete — reset and reshuffle a fresh round.
  const round = remaining.length > 0 ? remaining : pool;
  if (remaining.length === 0) {
    usedKeys.clear();
  }

  const item = round[Math.floor(Math.random() * round.length)];
  usedKeys.add(getKey(item));
  return item;
}
