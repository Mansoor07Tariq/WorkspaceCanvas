import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedValue,
  setCachedValue,
  isCacheFresh,
  invalidateCache,
  clearRequestCache,
  getOrFetchCached,
} from "../requestCache";

describe("requestCache", () => {
  beforeEach(() => clearRequestCache());

  it("stores and returns a fresh value", () => {
    setCachedValue("offices:5", [{ id: 1 }]);
    expect(getCachedValue("offices:5")).toEqual([{ id: 1 }]);
    expect(isCacheFresh("offices:5")).toBe(true);
  });

  it("returns undefined for a missing key", () => {
    expect(getCachedValue("missing")).toBeUndefined();
    expect(isCacheFresh("missing")).toBe(false);
  });

  it("expires a value after its TTL", async () => {
    setCachedValue("k", 1, 5); // 5ms TTL
    expect(getCachedValue("k")).toBe(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(getCachedValue("k")).toBeUndefined();
    expect(isCacheFresh("k")).toBe(false);
  });

  it("invalidateCache removes the exact key", () => {
    setCachedValue("desks:5:10", []);
    invalidateCache("desks:5:10");
    expect(getCachedValue("desks:5:10")).toBeUndefined();
  });

  it("invalidateCache with a trailing-colon namespace clears all children", () => {
    setCachedValue("offices:default", []);
    setCachedValue("offices:5", []);
    setCachedValue("summary:7", {});
    invalidateCache("offices:");
    expect(getCachedValue("offices:default")).toBeUndefined();
    expect(getCachedValue("offices:5")).toBeUndefined();
    // unrelated namespace untouched
    expect(getCachedValue("summary:7")).toEqual({});
  });

  it("invalidateCache does NOT clear a sibling with a longer numeric id", () => {
    setCachedValue("floors:5", []);
    setCachedValue("floors:50", []);
    invalidateCache("floors:5");
    expect(getCachedValue("floors:5")).toBeUndefined();
    // floors:50 must survive — prefix matching is boundary-aware
    expect(getCachedValue("floors:50")).toEqual([]);
  });

  it("invalidateCache clears hierarchical children", () => {
    setCachedValue("desks:5", []);
    setCachedValue("desks:5:10", []);
    invalidateCache("desks:5");
    expect(getCachedValue("desks:5")).toBeUndefined();
    expect(getCachedValue("desks:5:10")).toBeUndefined();
  });

  it("clearRequestCache wipes everything", () => {
    setCachedValue("a", 1);
    setCachedValue("b", 2);
    clearRequestCache();
    expect(getCachedValue("a")).toBeUndefined();
    expect(getCachedValue("b")).toBeUndefined();
  });

  describe("getOrFetchCached", () => {
    it("fetches and caches on a miss, returns cache on a hit", async () => {
      let calls = 0;
      const fetcher = async () => {
        calls += 1;
        return calls;
      };
      const first = await getOrFetchCached("g", fetcher);
      const second = await getOrFetchCached("g", fetcher);
      expect(first).toBe(1);
      expect(second).toBe(1); // served from cache, fetcher not called again
      expect(calls).toBe(1);
    });

    it("force bypasses the cache", async () => {
      let calls = 0;
      const fetcher = async () => ++calls;
      await getOrFetchCached("g", fetcher);
      const forced = await getOrFetchCached("g", fetcher, { force: true });
      expect(forced).toBe(2);
      expect(calls).toBe(2);
    });

    it("does not cache a rejected fetch", async () => {
      const failing = async () => {
        throw new Error("boom");
      };
      await expect(getOrFetchCached("g", failing)).rejects.toThrow("boom");
      expect(getCachedValue("g")).toBeUndefined();
    });
  });
});
