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

type LoadResult = { image: HTMLImageElement } | { error: true };
type Subscriber = (result: LoadResult) => void;

/**
 * In-flight loads keyed by src (FE-11). When several nodes mount pointing at the
 * same uncached asset they share ONE underlying `Image` load instead of starting
 * N concurrent decodes; each subscriber is notified synchronously on load/error.
 * The entry is removed on settle, and aborted (handlers detached) when its last
 * subscriber leaves before it completes — so an early unmount never populates the
 * cache, matching the pre-dedupe behaviour.
 */
interface Loader {
  img: HTMLImageElement;
  subscribers: Set<Subscriber>;
}
const inFlight = new Map<string, Loader>();

/** Test-only: drop cached images (and any in-flight loaders) so loading state can be re-exercised. */
export function clearKonvaImageCache(): void {
  imageCache.clear();
  inFlight.clear();
}

/** Subscribe to the (possibly shared) load of `src`. Returns an unsubscribe fn. */
function subscribeToLoad(src: string, cb: Subscriber): () => void {
  let loader = inFlight.get(src);
  if (!loader) {
    const img = new window.Image();
    const entry: Loader = { img, subscribers: new Set() };
    inFlight.set(src, entry);
    img.onload = () => {
      imageCache.set(src, img);
      const subs = entry.subscribers;
      inFlight.delete(src);
      subs.forEach((s) => s({ image: img }));
    };
    img.onerror = () => {
      const subs = entry.subscribers;
      inFlight.delete(src);
      subs.forEach((s) => s({ error: true }));
    };
    img.src = src;
    loader = entry;
  }
  loader.subscribers.add(cb);

  return () => {
    loader.subscribers.delete(cb);
    // Last subscriber gone before load settled → abort so an early unmount does
    // not populate the cache (preserves the prior single-hook behaviour).
    if (loader.subscribers.size === 0 && inFlight.get(src) === loader) {
      loader.img.onload = null;
      loader.img.onerror = null;
      inFlight.delete(src);
    }
  };
}

/**
 * Load an image element from a URL for use as a Konva image source. Returns the
 * current load status so callers can fall back to a placeholder while loading or
 * on error. A cached image resolves immediately as "loaded".
 *
 * Status is derived during render (cache hit / no src) and only mutated via
 * state inside the async load callbacks — so changing `src` never shows a stale
 * image, and the hook holds no synchronous setState in its effect. Concurrent
 * mounts of the same uncached src share one underlying load (FE-11).
 */
export function useKonvaImage(src: string | undefined): KonvaImageState {
  const [resolved, setResolved] = useState<{ src: string; image: HTMLImageElement } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to load for a missing src or a cached hit (both derived below).
    if (!src || imageCache.has(src)) return;

    let cancelled = false;
    const unsubscribe = subscribeToLoad(src, (result) => {
      if (cancelled) return;
      if ("image" in result) setResolved({ src, image: result.image });
      else setFailedSrc(src);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [src]);

  if (!src) return { image: undefined, status: "error" };
  const cached = imageCache.get(src);
  if (cached) return { image: cached, status: "loaded" };
  if (resolved && resolved.src === src) return { image: resolved.image, status: "loaded" };
  if (failedSrc === src) return { image: undefined, status: "error" };
  return { image: undefined, status: "loading" };
}
