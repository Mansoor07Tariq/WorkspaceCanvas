import manifestJson from "@/assets/iso/manifest.json";

/**
 * Typed access to the generated isometric-asset manifest + the committed WebP URLs
 * (PR 080 B1). The pipeline (`scripts/build-iso-assets.mjs`) writes `manifest.json` and the
 * optimized WebP into `src/assets/iso/`; here we load both so renderers can resolve a
 * sprite URL from an asset key. Vite turns each `?url` import into a hashed asset URL at
 * build time.
 */

export interface IsoFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IsoOutput {
  width: number;
  file: string;
  bytes: number;
}

export interface IsoAsset {
  key: string;
  sourceName: string;
  baseType: string;
  variantIndex: number | null;
  descriptor: string | null;
  /** LayoutObject-type mapping (from overrides; null until Phase B maps it). */
  type: string | null;
  /** ratified role: unused | standalone-desk | structural | null. */
  role: string | null;
  trimmed: { width: number | null; height: number | null };
  aspectRatio: number | null;
  footprint: IsoFootprint;
  outputs: IsoOutput[];
}

export interface IsoManifest {
  widths: number[];
  count: number;
  assets: IsoAsset[];
}

// The JSON is inferred as a huge literal; cast once to the hand-written shape so the literal
// type never propagates through the app.
export const isoManifest = manifestJson as unknown as IsoManifest;

// Committed WebP URLs, keyed by basename (path-agnostic). Relative glob (aliases aren't
// reliable inside import.meta.glob patterns).
const spriteUrls = import.meta.glob("../../../../assets/iso/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const urlByFile = new Map<string, string>();
for (const [path, url] of Object.entries(spriteUrls)) {
  const file = path.split("/").pop();
  if (file) urlByFile.set(file, url);
}

const byKey = new Map<string, IsoAsset>(isoManifest.assets.map((a) => [a.key, a]));
const byBaseType = new Map<string, IsoAsset[]>();
for (const a of isoManifest.assets) {
  const list = byBaseType.get(a.baseType);
  if (list) list.push(a);
  else byBaseType.set(a.baseType, [a]);
}

export function getIsoAsset(key: string): IsoAsset | undefined {
  return byKey.get(key);
}

/** All assets of a base type, ordered by variant index. */
export function getIsoAssetsByBaseType(baseType: string): IsoAsset[] {
  return byBaseType.get(baseType) ?? [];
}

/**
 * Resolve the committed WebP URL for an asset key at (or the nearest ≥) `targetWidth`; falls
 * back to the largest output. Returns undefined when the key or its file is unknown (the
 * renderer then falls back to the styled box).
 */
export function spriteUrl(key: string, targetWidth = 256): string | undefined {
  const asset = byKey.get(key);
  if (!asset || asset.outputs.length === 0) return undefined;
  const sorted = [...asset.outputs].sort((a, b) => a.width - b.width);
  const pick = sorted.find((o) => o.width >= targetWidth) ?? sorted[sorted.length - 1];
  return urlByFile.get(pick.file);
}
