/**
 * Tiny in-memory async cache with TTL and in-flight de-duplication. Analytics
 * and forecasts are expensive; this serves an unchanged (company + params +
 * dataVersion) request from memory and guarantees only one producer runs per
 * key at a time (no duplicate simultaneous forecast jobs).
 *
 * ponytail: per-process Map — fine for this single-instance dev app. A shared
 * store (Redis) would be needed for multi-instance; documented ceiling.
 */
export interface CacheOptions {
  ttlMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface Entry<T> {
  value?: T;
  expiresAt?: number;
  inflight?: Promise<T>;
}

export interface AsyncCache<T> {
  get(key: string, producer: () => Promise<T>): Promise<T>;
  invalidate(key: string): void;
  clear(): void;
}

export function createAsyncCache<T>(opts: CacheOptions = {}): AsyncCache<T> {
  const ttlMs = opts.ttlMs ?? 5 * 60_000;
  const now = opts.now ?? Date.now;
  const store = new Map<string, Entry<T>>();

  return {
    async get(key, producer) {
      const existing = store.get(key);
      if (existing) {
        if (existing.inflight) return existing.inflight; // dedup concurrent callers
        if (existing.value !== undefined && existing.expiresAt !== undefined && now() < existing.expiresAt) {
          return existing.value;
        }
      }
      const inflight = producer();
      store.set(key, { inflight });
      try {
        const value = await inflight;
        store.set(key, { value, expiresAt: now() + ttlMs });
        return value;
      } catch (err) {
        store.delete(key); // don't cache failures — next call retries
        throw err;
      }
    },
    invalidate(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}
