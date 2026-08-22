/**
 * MeroDeutsch — IndexedDB (Dexie) data layer (Phase 1.1 + Phase 2.1)
 *
 * Offline-first source of truth for vocabulary + spaced-repetition state.
 * Exposes the `db` singleton, an SSR-safe `openDb()`, seeding, migration
 * helpers, and a `moduleProgress` table for aggregate (non-SRS) progress.
 *
 * Schema:
 *   vocab          -> VocabCard (static German items; seeded at boot)
 *   userProgress   -> UserProgress (per-user Leitner 4-Box SRS state)
 *   moduleProgress -> aggregate Progress per user/module (e.g. alphabet stats)
 *   sentences      -> SentenceRow  (dynamic curriculum cache; Unit 2 practice)
 *   contentItems   -> ContentItemRow (generic content pool cache; migration 011)
 *
 * version(2) adds moduleProgress; version(4) adds the `sentences` cache table
 * for the dynamic curriculum pipeline; version(5) adds the generic content
 * pool table so offline mode keeps working after static src/data files are
 * removed.
 */
import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  VocabCard,
  UserProgress,
  WrongAnswerItem,
  Progress,
  MigrationResult,
} from '../types';
import { getItem, removeItem, setItem } from '../utils/safeStorage';
import { scopedKey } from '../utils/userStorage';

/**
 * Local Dexie row for the A1 learning-path campaign state (`useA1Path`).
 * One row per user identity (`userId` is the primary key, 'guest' included).
 * Dexie is the PRIMARY store; Supabase `a1_path_state` is the cloud mirror.
 */
export interface A1PathStateRow {
  userId: string;
  unlockedUnitIndex: number;
  completedNodeIds: string[];
  checkpointBestByUnit: Record<number, number>;
  updatedAt: string;
}

/** Cached row for the dynamic `sentences` pipeline (offline fallback). */
export interface SentenceRow {
  id: string;
  phraseDe: string;
  expectedArray: string[];
  distractorsArray: string[];
  grammarFocus: string;
  tags: string[];
}

/** Cached row for a generic content pool (migration 011 write-through cache). */
export interface ContentItemRow {
  id: string;
  contentType: string;
  payload: unknown;
  sortOrder: number;
}

/** Name used both by Dexie and visible in the browser's Application panel. */
const DB_NAME = 'MeroDeutsch';

/** Legacy localStorage base key for the WrongAnswerItem review queue. */
const LEGACY_QUEUE_KEY_BASE = 'meroDeutschWrongAnswers';
/** Per-user flag that marks review-queue migration as complete (idempotency). */
const MIGRATED_FLAG_BASE = 'mero_dexie_migrated_v1';
/** Legacy localStorage base key for alphabet Progress. */
const LEGACY_PROGRESS_KEY_BASE = 'germanAlphabetProgress';
/** Per-user flag that marks progress migration as complete. */
const PROGRESS_FLAG_BASE = 'mero_progress_migrated_v1';

/** Leitner 4-Box review intervals in days (Box 1–4). */
export const LEITNER_INTERVALS = [1, 3, 7, 14];

/**
 * Dexie-backed database for MeroDeutsch.
 *
 * `vocab` indexes:        id, cefrLevel, *tags, lemma, partOfSpeech
 * `userProgress` indexes: cardId, box, dueAt, lapses, lastReviewedAt
 *                          (+ userId, [userId+cardId] for multi-user queries/upserts)
 * `moduleProgress` indexes: id, userId, module, updatedAt
 * `sentences` indexes:    id, grammarFocus, *tags   (dynamic curriculum cache)
 * `contentItems` indexes: id, contentType, sortOrder (generic pool cache)
 */
export class MeroDeutschDB extends Dexie {
  vocab!: Table<VocabCard, string>;
  userProgress!: Table<UserProgress, string>;
  moduleProgress!: Table<ModuleProgressRow, string>;
  /** A1 campaign state per user (Phase: cross-device sync). */
  a1PathState!: Table<A1PathStateRow, string>;
  /** Offline cache for dynamic sentence exercises (Unit 2 practice). */
  sentences!: Table<SentenceRow, string>;
  /** Offline cache for generic content pools (alphabet, numbers, stories…). */
  contentItems!: Table<ContentItemRow, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      vocab: 'id, cefrLevel, *tags, lemma, partOfSpeech',
      userProgress:
        'id, cardId, box, dueAt, lapses, lastReviewedAt, userId, [userId+cardId]',
    });
    this.version(2).stores({
      vocab: 'id, cefrLevel, *tags, lemma, partOfSpeech',
      userProgress:
        'id, cardId, box, dueAt, lapses, lastReviewedAt, userId, [userId+cardId]',
      moduleProgress: 'id, userId, module, updatedAt',
    });
    // version(3) adds the A1 path state table; existing v1/v2 tables unchanged.
    this.version(3).stores({
      vocab: 'id, cefrLevel, *tags, lemma, partOfSpeech',
      userProgress:
        'id, cardId, box, dueAt, lapses, lastReviewedAt, userId, [userId+cardId]',
      moduleProgress: 'id, userId, module, updatedAt',
      a1PathState: 'userId',
    });
    // version(4) adds the `sentences` cache table for the dynamic curriculum
    // pipeline (offline-first fallback for Unit 2 sentence exercises).
    this.version(4).stores({
      sentences: 'id, grammarFocus, *tags',
    });
    // version(5) adds the generic content-pool cache table (write-through from
    // the Supabase get_content_items RPC so offline mode keeps working).
    this.version(5).stores({
      contentItems: 'id, contentType, sortOrder',
    });
  }
}

/** Aggregates `Progress` per user/module in Dexie (mirrors localStorage shape). */
export interface ModuleProgressRow {
  id: string; // `${userId}:${module}` (e.g. "guest:alphabet")
  userId: string;
  module: string;
  practiced: string[];
  quizCorrect: number;
  quizTotal: number;
  spellCompleted: number;
  updatedAt: string;
}

/**
 * Lazily-created singleton. Guarded for SSR: Dexie instantiates the DB
 * object synchronously but only *opens* IndexedDB on the first query, which
 * never happens during a server render. The guard keeps module import
 * side-effect-free under React Server Components / Next.js.
 */
let dbInstance: MeroDeutschDB | null = null;
const hasWindow = typeof window !== 'undefined';

function createDb(): MeroDeutschDB {
  return new MeroDeutschDB();
}

/** Default import path singleton (`import { db } from '@/lib/db'`). */
export const db: MeroDeutschDB | null = hasWindow ? (dbInstance ??= createDb()) : null;

/**
 * SSR-safe accessor. Returns `null` on the server; the live singleton on the
 * client. Use inside React effects / hooks rather than at module top-level.
 */
export const openDb = (): MeroDeutschDB | null => {
  if (!hasWindow) return null;
  return dbInstance ??= createDb();
};

/** Options for {@link migrateLocalStorageToDexie}. */
export interface MigrationOptions {
  /**
   * When true, the legacy localStorage review-queue key is removed after a
   * verified copy. Defaults to false; set true once useReviewQueue is fully
   * Dexie-backed to prevent data duplication.
   */
  cleanup?: boolean;
}

/** One-time, idempotent migration of the legacy localStorage review queue -> Dexie. */
export async function migrateLocalStorageToDexie(
  userId: string,
  options?: MigrationOptions,
): Promise<MigrationResult> {
  const store = openDb();
  if (!store) {
    return {
      migrated: 0,
      skipped: 0,
      alreadyMigrated: false,
      message: 'SSR environment: IndexedDB unavailable',
    };
  }

  const cleanup = options?.cleanup ?? false;

  // 1. Idempotency guard.
  const flagKey = scopedKey(MIGRATED_FLAG_BASE, userId);
  if (getItem(flagKey) === 'true') {
    return {
      migrated: 0,
      skipped: 0,
      alreadyMigrated: true,
      message: 'Migration already completed for this user',
    };
  }

  // 2. Read legacy queue.
  const legacyKey = scopedKey(LEGACY_QUEUE_KEY_BASE, userId);
  const raw = getItem(legacyKey);
  let source: WrongAnswerItem[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) source = parsed as WrongAnswerItem[];
    } catch {
      source = [];
    }
  }

  if (source.length === 0) {
    // Nothing to migrate — still mark the flag so we don't re-check every boot.
    setItem(flagKey, 'true');
    return {
      migrated: 0,
      skipped: 0,
      alreadyMigrated: false,
      message: 'No legacy localStorage review data to migrate',
    };
  }

  // 3. Map valid records (errorCount -> lapses, boxLevel -> box, etc.).
  const now = new Date().toISOString();
  const toPut: UserProgress[] = [];
  let skipped = 0;
  for (const item of source) {
    if (!item.itemKey) {
      skipped += 1;
      continue;
    }
    toPut.push({
      // Preserve the original id so Dashboard's markCorrect(item.id) /
      // markResolved(item.id) still resolve the row (internally consistent:
      // the live queue maps WrongAnswerItem.id <-> userProgress.id).
      id: item.id && item.id.length > 0 ? item.id : `${userId}:${item.itemKey}`,
      userId,
      cardId: item.itemKey,
      moduleType: item.moduleType ?? 'unknown',
      box: item.boxLevel ?? 1,
      dueAt: item.dueAt ?? now,
      intervalDays: item.intervalDays ?? 1,
      lapses: item.errorCount ?? 0,
      lastReviewedAt: item.timestamp ?? now,
      ease: item.ease,
      repetitions: item.repetitions,
      lastResult: item.lastResult,
      userAnswer: item.userAnswer,
      correctAnswer: item.correctAnswer,
      updatedAt: now,
    });
  }

  // 4. Write (upsert — deterministic ids, idempotent re-runs).
  if (toPut.length > 0) {
    await store.userProgress.bulkPut(toPut);
  }

  // 5. Verify before destroying legacy data.
  const dbCount = await store.userProgress
    .where('userId')
    .equals(userId)
    .count();

  if (dbCount < toPut.length) {
    return {
      migrated: 0,
      skipped,
      alreadyMigrated: false,
      message: `Verification failed (db=${dbCount}, expected=${toPut.length}); legacy key preserved for retry`,
    };
  }

  // Verified — clean up only when the caller opts in (after hooks use Dexie).
  setItem(flagKey, 'true');
  if (cleanup) {
    removeItem(legacyKey);
  }

  return {
    migrated: toPut.length,
    skipped,
    alreadyMigrated: false,
    message: cleanup
      ? undefined
      : 'Legacy key preserved (useReviewQueue still active); pass { cleanup: true } after hooks swap to Dexie.',
  };
}

/** One-time, idempotent migration of legacy alphabet Progress -> Dexie moduleProgress. */
export async function migrateProgressToDexie(
  userId: string,
): Promise<{ migrated: number; alreadyMigrated: boolean; message?: string }> {
  const store = openDb();
  if (!store) return { migrated: 0, alreadyMigrated: false, message: 'SSR: IndexedDB unavailable' };

  const flagKey = scopedKey(PROGRESS_FLAG_BASE, userId);
  if (getItem(flagKey) === 'true') {
    return { migrated: 0, alreadyMigrated: true };
  }

  const legacyKey = scopedKey(LEGACY_PROGRESS_KEY_BASE, userId);
  const raw = getItem(legacyKey);
  if (!raw) {
    setItem(flagKey, 'true');
    return { migrated: 0, alreadyMigrated: false, message: 'No legacy progress to migrate' };
  }

  let progress: Progress | null = null;
  try {
    progress = JSON.parse(raw) as Progress;
  } catch {
    progress = null;
  }
  if (!progress || !Array.isArray(progress.practiced)) {
    setItem(flagKey, 'true');
    return { migrated: 0, alreadyMigrated: false, message: 'Legacy progress malformed' };
  }

  const rowId = `${userId}:alphabet`;
  const existing = await store.moduleProgress.get(rowId);
  const next: ModuleProgressRow = {
    id: rowId,
    userId,
    module: 'alphabet',
    practiced: progress.practiced,
    quizCorrect: progress.quizCorrect ?? 0,
    quizTotal: progress.quizTotal ?? 0,
    spellCompleted: progress.spellCompleted ?? 0,
    updatedAt: new Date().toISOString(),
  };

  if (!existing) {
    await store.moduleProgress.add(next);
  } else {
    // Union practiced ids, take max scores (mirrors the localStorage -> Supabase
    // merge semantics in the original useProgress hook).
    await store.moduleProgress.update(rowId, {
      practiced: Array.from(new Set([...(existing.practiced ?? []), ...progress.practiced])),
      quizCorrect: Math.max(existing.quizCorrect ?? 0, progress.quizCorrect ?? 0),
      quizTotal: Math.max(existing.quizTotal ?? 0, progress.quizTotal ?? 0),
      spellCompleted: Math.max(existing.spellCompleted ?? 0, progress.spellCompleted ?? 0),
      updatedAt: new Date().toISOString(),
    });
  }

  setItem(flagKey, 'true');
  return { migrated: 1, alreadyMigrated: false };
}

/** Convenience: seed the `vocab` table from a JSON array (idempotent via bulkPut). */
export async function seedVocab(cards: VocabCard[]): Promise<number> {
  const store = openDb();
  if (!store || cards.length === 0) return 0;
  await store.vocab.bulkPut(cards);
  return cards.length;
}

/** Convenience: cache dynamic sentence exercises offline (idempotent via bulkPut). */
export async function seedSentences(cards: SentenceRow[]): Promise<number> {
  const store = openDb();
  if (!store || cards.length === 0) return 0;
  await store.sentences.bulkPut(cards);
  return cards.length;
}

/** Convenience: cache a generic content pool offline (idempotent via bulkPut). */
export async function seedContentItems(
  contentType: string,
  rows: { id: string; payload: unknown; sort?: number }[]
): Promise<number> {
  const store = openDb();
  if (!store || rows.length === 0) return 0;
  const items: ContentItemRow[] = rows.map((r, i) => ({
    id: r.id,
    contentType,
    payload: r.payload,
    sortOrder: r.sort ?? i,
  }));
  await store.contentItems.bulkPut(items);
  return items.length;
}

/** Query cached content pool by type (ordered by sort). Returns [] when empty. */
export async function getCachedContent<T>(contentType: string): Promise<T[]> {
  const store = openDb();
  if (!store) return [];
  const rows = await store.contentItems
    .where('contentType')
    .equals(contentType)
    .sortBy('sortOrder');
  return rows.map((r) => r.payload as T);
}

export type { ModuleProgressRow as ProgressRow };
export type { SentenceRow as SentenceCacheRow };