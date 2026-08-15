import { useCallback, useEffect, useState } from 'react';
import { isOnline, executeSync, queueAchievementUnlock } from '../services/syncService';
import { useAuth } from './useAuth';

const SYNC_INTERVAL_MS = 60_000; // once per minute while online

/**
 * useSyncBridge — online-reconnect driven sync.
 *
 * Effect hooks fire when the browser comes back online (navigator.onLine flips
 * true) AND the user is authenticated. It then executes the full Local→Cloud
 * sync pipeline (`executeSync`) once per sync interval. The hook also provides
 * `queueAchievementUnlock` so any achievement unlocked offline can be flushed
 * on the next successful sync.
 */
export function useSyncBridge() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userId ?? null;
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const runSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const errors = await executeSync(userId ?? '');
    setIsSyncing(false);
    setLastSyncAt(Date.now());
    if (errors.length) {
      // Errors are logged to console; UI toast can be added if desired.
      console.warn('Sync errors:', errors);
    }
  }, [isSyncing, userId, executeSync]);

  const onOnline = useCallback(() => {
    if (!isAuthenticated || !userId) return;
    if (isSyncing) return;
    void runSync();
  }, [isAuthenticated, userId, isSyncing, runSync]);

  // Initial check: if already online + authed at mount, sync once.
  useEffect(() => {
    if (isAuthenticated && userId && isOnline()) {
      void runSync();
    }
  }, [isAuthenticated, userId, runSync]);

  // Re-run whenever online status changes (navigator.onLine flip).
  useEffect(() => {
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [onOnline]);

  // Periodic re-sync while online (defensive: catch any changes that might
  // have been missed by the one-shot online event, e.g. tab switching).
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (!isOnline()) return;
    const interval = setInterval(() => {
      void runSync();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, userId, isOnline, runSync]);

  return {
    isSyncing,
    lastSyncAt,
    forceSync: runSync,
    queueAchievementUnlock: (badgeId: string) => {
      if (!userId) return;
      queueAchievementUnlock(userId, badgeId);
    },
  };
}