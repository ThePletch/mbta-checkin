const CACHE_VERSION = "v2";
const STORAGE_PREFIX = `mbta-checkin:cache:${CACHE_VERSION}:`;
const TTL_MS = 24 * 60 * 60 * 1000;

type CacheRecord = {
  expiresAt: number;
  value: string;
};

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function fullKey(entryKey: string): string {
  return STORAGE_PREFIX + entryKey;
}

function getUnexpiredRecord<K>(key: string): K | null {
  const now = Date.now();
  const stored = localStorage.getItem(fullKey(key));
  if (stored == null) {
    return null;
  }
  const storedRecord = JSON.parse(stored) as CacheRecord;
  if (storedRecord.expiresAt <= now) {
    localStorage.removeItem(fullKey(key));
    return null;
  }
  return JSON.parse(storedRecord.value) as K;
}

function withNoopCache<Result>(
  _key: string,
  fn: () => Promise<Result>,
): Promise<Result> {
  return fn();
};

function withLocalStorageCache<Result>(
  key: string,
  fn: () => Promise<Result>,
): Promise<Result> {
  return Promise.resolve(getUnexpiredRecord<Result>(key) ?? async function() {
    const result = await fn();
    try {
      localStorage.setItem(fullKey(key), JSON.stringify({
        expiresAt: Date.now() + TTL_MS,
        value: JSON.stringify(result),
      }));
    } catch {
      // local storage is probably full, silently skip the cache write
      console.error("Failed to write cache record to local storage");
    }

    return result;
  }());
}

export default storageAvailable() ? withLocalStorageCache : withNoopCache;
