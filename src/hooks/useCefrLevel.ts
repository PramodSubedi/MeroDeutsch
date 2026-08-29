import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { scopedKey } from '../utils/userStorage';

const CEFR_STORAGE_BASE = 'meroDeutschCefrLevel';
export type CefrLevel = '' | 'A1' | 'A2' | 'B1' | 'B2';
const VALID_LEVELS: readonly CefrLevel[] = ['', 'A1', 'A2', 'B1', 'B2'];

/**
 * Per-user persisted CEFR level. Defaults to '' (treated as A1 by callers).
 * Stored under `meroDeutschCefrLevel:<userId>` (guest -> `meroDeutschCefrLevel:guest`),
 * which NEVER collides with the A1 path, review queue, or XP keys (.clinerules C13/C14).
 */
export function useCefrLevel() {
  const { user } = useAuth();
  const storageKey = scopedKey(CEFR_STORAGE_BASE, user?.userId ?? 'guest');

  const [level, setLevel] = useState<CefrLevel>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw && VALID_LEVELS.includes(raw as CefrLevel) ? (raw as CefrLevel) : '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, level || 'A1');
    } catch {
      /* storage unavailable */
    }
  }, [storageKey, level]);

  const update = useCallback((next: CefrLevel) => setLevel(next), []);
  return { level, setLevel: update };
}