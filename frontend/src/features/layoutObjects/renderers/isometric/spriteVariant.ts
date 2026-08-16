import type { IsoAsset } from "./isoManifest";

/** FNV-1a 32-bit hash of a string → deterministic, well-distributed variant index. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministically pick one asset key from a family for an object (PR 080 B4): the pool is
 * sorted by key (stable, order-independent of manifest emission) and indexed by `fnv1a(id) % n`,
 * so the same object id always renders the same aesthetic variant. Returns undefined for an empty
 * pool (caller then falls back to the styled box — never blank).
 *
 * `salt` lets one object place several independent pieces (e.g. a room's shelf + table) that each
 * pick their own stable variant.
 */
export function pickVariantKey(objectId: number, assets: IsoAsset[], salt = 0): string | undefined {
  if (assets.length === 0) return undefined;
  const ordered = [...assets].sort((a, b) => a.key.localeCompare(b.key));
  return ordered[fnv1a(`${objectId}:${salt}`) % ordered.length].key;
}
