/**
 * TD-021: a tiny in-memory TTL cache for GET responses, so navigating between
 * routes (e.g. toggling floors or returning to Offices) does not always trigger
 * a full refetch and loading flicker.
 *
 * Design notes:
 * - In-memory only. Nothing is persisted to localStorage — no stale or sensitive
 *   data survives a reload, and there is no cross-tab leakage.
 * - Per-key TTL (default 30s). Expired entries are pruned lazily on read.
 * - Cache keys MUST include the org/office/floor/date ids they depend on so a
 *   selected-organization switch (PR 055 Slice C) can never serve another org's
 *   data. See the hooks for the exact key shapes.
 * - Only successful responses are cached. Rejections / aborts are never stored,
 *   and 401-refresh retries are handled below the api layer, so a stale token
 *   response is never cached.
 * - Mutations invalidate affected keys (see invalidateCache); explicit refresh()
 *   in each hook bypasses the cache.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000;

const store = new Map<string, CacheEntry>();

/**
 * Monotonic-ish clock. `Date.now` is used directly (this module is not part of
 * any workflow-script sandbox); tests control freshness via short TTLs.
 */
function now(): number {
  return Date.now();
}

/** Returns the cached value for `key` only if it exists and is still fresh. */
export function getCachedValue<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/** True when `key` has a fresh (non-expired) cached value. */
export function isCacheFresh(key: string): boolean {
  return getCachedValue(key) !== undefined;
}

/** Store `value` under `key` with a TTL (default 30s). */
export function setCachedValue<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: now() + ttlMs });
}

/**
 * Invalidate cache entries.
 *
 * - Exact key match is always invalidated.
 * - Hierarchical match: `target` invalidates any key prefixed by `target + ":"`,
 *   so `invalidateCache("floors:5")` clears `floors:5` and `floors:5:*` but NOT
 *   the unrelated `floors:50`.
 * - When `target` already ends with ":" it is treated as a namespace prefix, so
 *   `invalidateCache("offices:")` clears every `offices:<orgId>` entry.
 */
export function invalidateCache(target: string): void {
  const prefix = target.endsWith(":") ? target : `${target}:`;
  for (const key of [...store.keys()]) {
    if (key === target || key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/** Clear the entire cache. Call this in test teardown to isolate tests. */
export function clearRequestCache(): void {
  store.clear();
}

/**
 * Convenience getter: return the fresh cached value or run `fetcher`, caching
 * its result. `force: true` always bypasses the cache (used by refresh()).
 */
export async function getOrFetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttlMs?: number; force?: boolean } = {}
): Promise<T> {
  if (!opts.force) {
    const cached = getCachedValue<T>(key);
    if (cached !== undefined) return cached;
  }
  const value = await fetcher();
  setCachedValue(key, value, opts.ttlMs);
  return value;
}
