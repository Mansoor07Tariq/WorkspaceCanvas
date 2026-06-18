import { useEffect, useState } from "react";

export type KonvaImageStatus = "loading" | "loaded" | "error";

export interface KonvaImageState {
  image: HTMLImageElement | undefined;
  status: KonvaImageStatus;
}

/**
 * Module-level cache of decoded images keyed by src. A floor can contain many
 * desks pointing at the same asset; caching means the bitmap is loaded once and
 * every subsequent node resolves synchronously (no per-node flicker), mirroring
 * the request-cache approach used elsewhere in the app.
 */
const imageCache = new Map<string, HTMLImageElement>();

/** Test-only: drop cached images so loading state can be re-exercised. */
export function clearKonvaImageCache(): void {
  imageCache.clear();
}

/**
 * Load an image element from a URL for use as a Konva image source. Returns the
 * current load status so callers can fall back to a placeholder while loading or
 * on error. A cached image resolves immediately as "loaded".
 *
 * Status is derived during render (cache hit / no src) and only mutated via
 * state inside the async load callbacks — so changing `src` never shows a stale
 * image, and the hook holds no synchronous setState in its effect.
 */
export function useKonvaImage(src: string | undefined): KonvaImageState {
  const [resolved, setResolved] = useState<{ src: string; image: HTMLImageElement } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to load for a missing src or a cached hit (both derived below).
    if (!src || imageCache.has(src)) return;

    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      imageCache.set(src, img);
      setResolved({ src, image: img });
    };
    img.onerror = () => {
      if (!cancelled) setFailedSrc(src);
    };
    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  if (!src) return { image: undefined, status: "error" };
  const cached = imageCache.get(src);
  if (cached) return { image: cached, status: "loaded" };
  if (resolved && resolved.src === src) return { image: resolved.image, status: "loaded" };
  if (failedSrc === src) return { image: undefined, status: "error" };
  return { image: undefined, status: "loading" };
}
