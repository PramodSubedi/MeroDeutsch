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
import { userDataService } from './userDataService';
import { openDb } from '../lib/db';
import type { Progress, VocabCard, UserProgress } from '../types';

/** Queued offline mutation — replayed when connectivity/auth returns. */
interface PendingSyncOp {
  kind: 'progress' | 'review' | 'achievement' | 'generic';
  userId: string;
  payload?: unknown;
  at: string;
}

const PENDING_KEY = 'meroDeutschSyncQueue';
const EMPTY_QUEUE: PendingSyncOp[] = [];

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
async function pushReviewQueue(userId: string): Promise<void> {
  const store = openDb();
  if (!store) return;

  const rows: UserProgress[] = await store.userProgress
    .where('userId')
    .equals(userId)
    .toArray();

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

  if (items.length === 0) return;
  await userDataService.saveReviewQueue(userId, items);
}

/** Adapter local moduleProgress → `user_progress.` Uses max/union merge. */
async function pushProgress(userId: string): Promise<void> {
  const store = openDb();
  if (!store) return;

  const moduleRows = await store.moduleProgress.where('userId').equals(userId).toArray();
  if (moduleRows.length === 0) return;

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
}

/**
 * Push all local changes for an authenticated user to Supabase.
 * Called on app load (after login) and when `navigator.onLine` flips true.
 */
export async function executeSync(userId: string): Promise<string[]> {
  const errors: string[] = [];

  if (!isOnline()) return errors;
  if (!userId) return errors;

  // 1. Review queue (SRS state)
  try {
    await pushReviewQueue(userId);
  } catch (e) {
    errors.push(`review:${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. Progress (moduleProgress → user_progress)
  try {
    await pushProgress(userId);
  } catch (e) {
    errors.push(`progress:${e instanceof Error ? e.message : String(e)}`);
  }

  // 3. Replay queued offline mutations (achievements etc. come through hooks
  //    directly — the queue catches anything enqueued during offline time).
  const pending = loadQueue().filter(
    (op) => op.userId === userId || op.kind === 'generic'
  );
  for (const op of pending) {
    try {
      if (op.kind === 'achievement' && typeof op.payload === 'string') {
        await userDataService.unlockAchievement(userId, op.payload);
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

/** Map local vocab cards (V title / context helper). */
export function mapVocabToCard(row: VocabCard): VocabCard {
  return { ...row };
}

export type { PendingSyncOp };