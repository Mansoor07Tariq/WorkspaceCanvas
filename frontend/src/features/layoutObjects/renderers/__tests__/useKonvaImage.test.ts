import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useKonvaImage, clearKonvaImageCache } from "../isometric/useKonvaImage";

/**
 * Controllable stand-in for the browser HTMLImageElement. Records every instance
 * so a test can fire `onload`/`onerror` deterministically — no real network or
 * decoding, which jsdom cannot do anyway.
 */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  naturalWidth = 100;
  naturalHeight = 100;
  static instances: FakeImage[] = [];
  constructor() {
    FakeImage.instances.push(this);
  }
}

const OriginalImage = window.Image;

beforeEach(() => {
  FakeImage.instances = [];
  clearKonvaImageCache();
  window.Image = FakeImage as unknown as typeof Image;
});

afterEach(() => {
  window.Image = OriginalImage;
});

describe("useKonvaImage", () => {
  it("starts in loading and resolves to loaded on successful image load", () => {
    const { result } = renderHook(() => useKonvaImage("/desk.svg"));
    expect(result.current.status).toBe("loading");
    expect(result.current.image).toBeUndefined();

    act(() => {
      FakeImage.instances[0].onload?.();
    });

    expect(result.current.status).toBe("loaded");
    expect(result.current.image).toBe(FakeImage.instances[0]);
  });

  it("resolves to error when the image fails to load", () => {
    const { result } = renderHook(() => useKonvaImage("/missing.svg"));
    act(() => {
      FakeImage.instances[0].onerror?.();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.image).toBeUndefined();
  });

  it("returns error status (no image) for an undefined src without constructing an Image", () => {
    const { result } = renderHook(() => useKonvaImage(undefined));
    expect(result.current.status).toBe("error");
    expect(FakeImage.instances).toHaveLength(0);
  });

  it("serves a cached image synchronously and does not construct a second Image", () => {
    const first = renderHook(() => useKonvaImage("/desk.svg"));
    act(() => {
      FakeImage.instances[0].onload?.();
    });
    expect(first.result.current.status).toBe("loaded");
    first.unmount();

    const constructedBefore = FakeImage.instances.length;
    const second = renderHook(() => useKonvaImage("/desk.svg"));
    // Cache hit → loaded on first render, no new Image element built.
    expect(second.result.current.status).toBe("loaded");
    expect(second.result.current.image).toBe(FakeImage.instances[0]);
    expect(FakeImage.instances.length).toBe(constructedBefore);
  });

  it("does not populate the cache or update state when unmounted before load", () => {
    const { unmount } = renderHook(() => useKonvaImage("/slow.svg"));
    const img = FakeImage.instances[0];
    unmount();

    // Firing onload after unmount must be a no-op (handler detached + cancelled).
    act(() => {
      img.onload?.();
    });

    // A fresh hook for the same src must NOT see a cached image (cache stayed empty).
    const { result } = renderHook(() => useKonvaImage("/slow.svg"));
    expect(result.current.status).toBe("loading");
  });

  it("drops the stale image when src changes and shows loading for the new src", () => {
    const { result, rerender } = renderHook(({ src }) => useKonvaImage(src), {
      initialProps: { src: "/a.svg" },
    });
    act(() => {
      FakeImage.instances[0].onload?.();
    });
    expect(result.current.status).toBe("loaded");

    rerender({ src: "/b.svg" });
    // New src not yet loaded → loading, and the old image is not leaked through.
    expect(result.current.status).toBe("loading");
    expect(result.current.image).toBeUndefined();
  });
});
