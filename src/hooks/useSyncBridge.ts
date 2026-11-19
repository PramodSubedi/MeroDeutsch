import { useCallback, useEffect, useRef, useState } from 'react';
import { A1_PATH_CHANGED_EVENT, isOnline, executeSync, queueAchievementUnlock } from '../services/syncService';
import { useAuth } from './useAuth';

const SYNC_INTERVAL_MS = 60_000; // once per minute while online
const PATH_SYNC_DEBOUNCE_MS = 600;

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
  // Ref mirroring isSyncing so the guard doesn't recreate runSync/onOnline
  // (which would tear down the interval/listeners on every sync).
  const isSyncingRef = useRef(false);

  const runSync = useCallback(async () => {
    if (!isAuthenticated || !userId || !isOnline() || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const errors = await executeSync(userId);
      if (errors.length === 0) setLastSyncAt(Date.now());
      if (errors.length) {
        // Errors are logged to console; UI toast can be added if desired.
        console.warn('Sync errors:', errors);
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [userId, isAuthenticated]);

  const onOnline = useCallback(() => {
    if (!isAuthenticated || !userId) return;
    if (isSyncingRef.current) return;
    void runSync();
  }, [isAuthenticated, userId, runSync]);

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

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleSync = () => {
      clearTimeout(timer);
      timer = setTimeout(onOnline, PATH_SYNC_DEBOUNCE_MS);
    };
    window.addEventListener(A1_PATH_CHANGED_EVENT, scheduleSync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(A1_PATH_CHANGED_EVENT, scheduleSync);
    };
  }, [isAuthenticated, userId, onOnline]);

  // Periodic re-sync while online (defensive: catch any changes that might
  // have been missed by the one-shot online event, e.g. tab switching).
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const interval = setInterval(() => {
      void runSync();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, userId, runSync]);

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
