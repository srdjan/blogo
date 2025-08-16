import type { Result } from "../lib/result.ts";

export interface Cache<T> {
  readonly get: (key: string) => Result<T | null, CacheError>;
  readonly set: (key: string, value: T, ttlMs?: number) => Result<void, CacheError>;
  readonly delete: (key: string) => Result<void, CacheError>;
  readonly clear: () => Result<void, CacheError>;
}

export type CacheError = "CACHE_MISS" | "CACHE_ERROR" | "EXPIRED";

export type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAt: number;
};

export const createInMemoryCache = <T>(): Cache<T> => {
  const store = new Map<string, CacheEntry<T>>();

  const isExpired = (entry: CacheEntry<T>): boolean => {
    return Date.now() > entry.expiresAt;
  };

  return {
    get: (key: string) => {
      try {
        const entry = store.get(key);
        if (!entry) {
          return { ok: true, value: null };
        }
        
        if (isExpired(entry)) {
          store.delete(key);
          return { ok: true, value: null };
        }
        
        return { ok: true, value: entry.value };
      } catch {
        return { ok: false, error: "CACHE_ERROR" };
      }
    },

    set: (key: string, value: T, ttlMs = Infinity) => {
      try {
        const expiresAt = ttlMs === Infinity ? Infinity : Date.now() + ttlMs;
        store.set(key, { value, expiresAt });
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: "CACHE_ERROR" };
      }
    },

    delete: (key: string) => {
      try {
        store.delete(key);
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: "CACHE_ERROR" };
      }
    },

    clear: () => {
      try {
        store.clear();
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: "CACHE_ERROR" };
      }
    },
  };
};