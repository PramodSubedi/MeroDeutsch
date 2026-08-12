type LocalizedStorage = Map<string, string>;

const memoryStorage: LocalizedStorage = new Map();

function hasWindowStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isStorageAvailable(): boolean {
  if (!hasWindowStorage()) return false;
  try {
    const testKey = '__mero_deutsch_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getItem(key: string): string | null {
  if (hasWindowStorage()) {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) return value;
    } catch {
      // fallback to memory storage
    }
  }
  return memoryStorage.has(key) ? memoryStorage.get(key) ?? null : null;
}

export function setItem(key: string, value: string): void {
  if (hasWindowStorage()) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore and fallback to memory storage
    }
  }
  memoryStorage.set(key, value);
}

export function removeItem(key: string): void {
  if (hasWindowStorage()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  memoryStorage.delete(key);
}

export function isLocalStorageAvailable(): boolean {
  return isStorageAvailable();
}
