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
 * Deterministically pick one asset key from a family, **scoped to the FLOOR** (PR 082).
 *
 * REVERSES the PR 080 rule that hashed the *object's own id*. Per-object hashing gave every desk on a
 * floor a different variant, which reads as chaos rather than variety — real offices buy furniture in
 * bulk and it matches. Scoping to the floor means all objects of one family on one floor share a
 * variant, while different floors still differ.
 *
 * The scope key is `floorId : family : salt`:
 * - **family** is taken from the pool itself (`baseType` of the sorted head), so desks choosing a style
 *   can never force sofas onto the matching index of *their* family — each family resolves independently
 *   and the family can never drift out of sync with the pool it describes;
 * - **salt** is preserved so one object can still place several independent pieces (a room's shelf and
 *   table); floor scoping must not collapse those onto one index.
 *
 * The pool is sorted by key first (stable, independent of manifest emission order). Returns undefined for
 * an empty pool — the caller then falls back to the styled box, never blank. Nothing is stored: the same
 * floor renders identically across reloads and across users.
 */
export function pickVariantKey(floorId: number, assets: IsoAsset[], salt = 0): string | undefined {
  if (assets.length === 0) return undefined;
  const ordered = [...assets].sort((a, b) => a.key.localeCompare(b.key));
  const family = ordered[0].baseType;
  return ordered[fnv1a(`${floorId}:${family}:${salt}`) % ordered.length].key;
}
