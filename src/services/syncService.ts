/**
 * syncService — offline-first Local→Cloud sync bridge.
 *
 *   Client Action → Local Primary (Dexie / localStorage) → (online & auth?)
 *     → Yes: Background Supabase upsert (PostgreSQL)
 *     → No:  Queue for next connection
 *
 * Conflict resolution is timestamps-win: the row with the newer
 * `lastReviewedAt` / `updatedAt` wins. Offline work done on this device
 * keeps local timestamps, so reconnecting after offline correctly merges
 * the newest local state first.
 *
 * Uses `userDataService` (adapters already wired to Supabase) as the mapper
 * from local entities to Postgres table structures.
 */
import { userDataService, type A1PathState } from './userDataService';
import { openDb } from '../lib/db';
import type { Progress, VocabCard, UserProgress } from '../types';

/** Queued offline mutation — replayed when connectivity/auth returns. */
interface PendingSyncOp {
  kind: 'progress' | 'review' | 'achievement' | 'a1path' | 'generic';
  userId: string;
  payload?: unknown;
  at: string;
}

const PENDING_KEY = 'meroDeutschSyncQueue';
const EMPTY_QUEUE: PendingSyncOp[] = [];

/* ───────────────────────────────────────────────────────────
 * Per-store last-push markers (skip unchanged stores)
 * ─────────────────────────────────────────────────────────── */
/**
 * Per-user markers recording the newest local `updatedAt` that was already
 * pushed to Supabase. On the next sync, a store is skipped entirely when no
 * local row has a newer `updatedAt` — turning the periodic 60s flush into
 * ~zero network calls while nothing changed.
 */
interface SyncMarkers {
  reviewQueueAt: string;
  progressAt: string;
  a1PathAt: string;
}
const MARKERS_KEY = 'meroDeutschSyncMarkersV1';
const EMPTY_MARKERS: SyncMarkers = { reviewQueueAt: '', progressAt: '', a1PathAt: '' };

function loadMarkers(): Record<string, SyncMarkers> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MARKERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SyncMarkers>) : {};
  } catch {
    return {};
  }
}

function saveMarkers(markers: Record<string, SyncMarkers>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
  } catch {
    // best-effort — markers rebuild from the next local change
  }
}

/** True when `timestamp` is newer than the stored last-push marker. */
function isDirty(timestamp: string | null | undefined, lastPushed: string): boolean {
  return timestamp !== null && timestamp !== undefined && timestamp > lastPushed;
}

/* ───────────────────────────────────────────────────────────
 * Queued offline operations (memory + localStorage persistence)
 * ─────────────────────────────────────────────────────────── */

function loadQueue(): PendingSyncOp[] {
  if (typeof localStorage === 'undefined') return EMPTY_QUEUE;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSyncOp[]) : EMPTY_QUEUE;
  } catch {
    return EMPTY_QUEUE;
  }
}

function saveQueue(queue: PendingSyncOp[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
  } catch {
    // ignore quota/security failures — queue is best-effort
  }
}

/** Enqueue an operation for replay when the network returns. */
export function enqueueSync(op: PendingSyncOp): void {
  const queue = loadQueue();
  queue.push(op);
  // Cap queue to avoid unbounded storage growth.
  const trimmed = queue.slice(-100);
  saveQueue(trimmed);
}

export function clearQueue(): void {
  saveQueue(EMPTY_QUEUE);
}

/** True when the browser is online right now. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/* ───────────────────────────────────────────────────────────
 * Online flush — replay queued + current local state
 * ─────────────────────────────────────────────────────────── */

/**
 * Adapter: Dexie `userProgress` rows → `review_queue` Postgres rows.
 * Conflict: newest `updatedAt` wins.
 */
async function pushReviewQueue(userId: string, lastPushed: string): Promise<string | null> {
  const store = openDb();
  if (!store) return null;

  const rows: UserProgress[] = await store.userProgress
    .where('userId')
    .equals(userId)
    .toArray();

  if (rows.length === 0) return null;

  // Dirty check: skip the network call unless a local row changed since the
  // last successful push.
  const maxUpdatedAt = rows.reduce<string>(
    (max, r) => (r.updatedAt && r.updatedAt > max ? r.updatedAt : max),
    ''
  );
  if (!isDirty(maxUpdatedAt, lastPushed)) return null;

  // Map to WrongAnswerItem shape expected by userDataService.saveReviewQueue.
  const items = rows.map((r) => ({
    id: r.id,
    moduleType: r.moduleType,
    itemKey: r.cardId,
    userAnswer: r.userAnswer ?? '',
    correctAnswer: r.correctAnswer ?? '',
    errorCount: r.lapses ?? 0,
    timestamp: r.updatedAt ?? r.lastReviewedAt ?? new Date().toISOString(),
    ease: r.ease,
    intervalDays: r.intervalDays,
    repetitions: r.repetitions,
    dueAt: r.dueAt,
    lastResult: r.lastResult,
    boxLevel: r.box,
  }));

  await userDataService.saveReviewQueue(userId, items);
  return maxUpdatedAt || new Date().toISOString();
}

/**
 * Adapter: Dexie `a1PathState` row → `a1_path_state` Postgres row.
 * Local Dexie is primary; this pushes the latest local campaign state up.
 */
async function pushA1PathState(userId: string, lastPushed: string): Promise<string | null> {
  const store = openDb();
  if (!store) return null;

  const row = await store.a1PathState.get(userId);
  if (!row) return null;
  if (!isDirty(row.updatedAt, lastPushed)) return null;

  const state: A1PathState = {
    unlockedUnitIndex: row.unlockedUnitIndex,
    completedNodeIds: row.completedNodeIds ?? [],
    checkpointBestByUnit: row.checkpointBestByUnit ?? {},
  };
  await userDataService.saveA1PathState(userId, state);
  return row.updatedAt ?? new Date().toISOString();
}

/** Adapter local moduleProgress → `user_progress.` Uses max/union merge. */
async function pushProgress(userId: string, lastPushed: string): Promise<string | null> {
  const store = openDb();
  if (!store) return null;

  const moduleRows = await store.moduleProgress.where('userId').equals(userId).toArray();
  if (moduleRows.length === 0) return null;

  const maxUpdatedAt = moduleRows.reduce<string>(
    (max, r) => (r.updatedAt && r.updatedAt > max ? r.updatedAt : max),
    ''
  );
  if (!isDirty(maxUpdatedAt, lastPushed)) return null;

  const merged: Progress = moduleRows.reduce<Progress>(
    (acc, row) => ({
      practiced: Array.from(new Set([...acc.practiced, ...(row.practiced ?? [])])),
      quizCorrect: Math.max(acc.quizCorrect, row.quizCorrect ?? 0),
      quizTotal: Math.max(acc.quizTotal, row.quizTotal ?? 0),
      spellCompleted: Math.max(acc.spellCompleted, row.spellCompleted ?? 0),
    }),
    { practiced: [], quizCorrect: 0, quizTotal: 0, spellCompleted: 0 }
  );

  await userDataService.saveProgress(userId, merged);
  return maxUpdatedAt || new Date().toISOString();
}

/**
 * Push all local changes for an authenticated user to Supabase.
 * Called on app load (after login) and when `navigator.onLine` flips true.
 */
export async function executeSync(userId: string): Promise<string[]> {
  const errors: string[] = [];

  if (!isOnline()) return errors;
  if (!userId) return errors;

  const markers = loadMarkers();
  const mark: SyncMarkers = { ...EMPTY_MARKERS, ...(markers[userId] ?? {}) };

  // 1. Review queue (SRS state) — skipped unless a row changed since last push.
  try {
    const pushedAt = await pushReviewQueue(userId, mark.reviewQueueAt);
    if (pushedAt) mark.reviewQueueAt = pushedAt;
  } catch (e) {
    errors.push(`review:${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. Progress (moduleProgress → user_progress)
  try {
    const pushedAt = await pushProgress(userId, mark.progressAt);
    if (pushedAt) mark.progressAt = pushedAt;
  } catch (e) {
    errors.push(`progress:${e instanceof Error ? e.message : String(e)}`);
  }

  // 3. A1 campaign path state (a1PathState → a1_path_state)
  try {
    const pushedAt = await pushA1PathState(userId, mark.a1PathAt);
    if (pushedAt) mark.a1PathAt = pushedAt;
  } catch (e) {
    errors.push(`a1path:${e instanceof Error ? e.message : String(e)}`);
  }

  markers[userId] = mark;
  saveMarkers(markers);

  // 4. Replay queued offline mutations (achievements / explicit a1path pushes
  //    enqueued during offline time; progress/review flush live above).
  const pending = loadQueue().filter(
    (op) => op.userId === userId || op.kind === 'generic'
  );
  for (const op of pending) {
    try {
      if (op.kind === 'achievement' && typeof op.payload === 'string') {
        await userDataService.unlockAchievement(userId, op.payload);
      } else if (op.kind === 'a1path') {
        await pushA1PathState(userId, mark.a1PathAt);
      }
    } catch (e) {
      errors.push(`${op.kind}:${e instanceof Error ? e.message : String(e)}`);
    }
  }
  clearQueue();

  return errors;
}

/**
 * Convenience: enqueue an achievement unlock for the next successful sync.
 * Called by `useAchievements.unlockBadge` when offline.
 */
export function queueAchievementUnlock(userId: string, badgeId: string): void {
  enqueueSync({
    kind: 'achievement',
    userId,
    payload: badgeId,
    at: new Date().toISOString(),
  });
}

/**
 * Convenience: enqueue an A1 path push for the next successful sync.
 * Called by `useA1Path` when a Supabase write fails while offline.
 */
export function queueA1PathPush(userId: string): void {
  enqueueSync({
    kind: 'a1path',
    userId,
    at: new Date().toISOString(),
  });
}

/** Map local vocab cards (V title / context helper). */
export function mapVocabToCard(row: VocabCard): VocabCard {
  return { ...row };
}

export type { PendingSyncOp };