import { describe, it, expect } from "vitest";
import type { IsoAsset } from "../isometric/isoManifest";
import { fnv1a, pickVariantKey } from "../isometric/spriteVariant";

const asset = (key: string): IsoAsset => ({ key }) as IsoAsset; // only `key` is read by pickVariantKey

describe("fnv1a", () => {
  it("is deterministic and distinct", () => {
    expect(fnv1a("a")).toBe(fnv1a("a"));
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
  });
});

describe("pickVariantKey", () => {
  const pool = [asset("c"), asset("a"), asset("b")];

  it("is deterministic per object id (same id → same key)", () => {
    expect(pickVariantKey(7, pool)).toBe(pickVariantKey(7, pool));
  });

  it("is order-independent (sorts the pool by key first)", () => {
    expect(pickVariantKey(7, [asset("a"), asset("b"), asset("c")])).toBe(
      pickVariantKey(7, [asset("c"), asset("b"), asset("a")])
    );
  });

  it("always returns a key from the pool", () => {
    for (let id = 0; id < 20; id += 1) {
      expect(["a", "b", "c"]).toContain(pickVariantKey(id, pool));
    }
  });

  it("salt yields an independent (still deterministic) pick", () => {
    expect(pickVariantKey(7, pool, 1)).toBe(pickVariantKey(7, pool, 1));
    // Different salts usually differ; at minimum they don't crash and stay in-pool.
    expect(["a", "b", "c"]).toContain(pickVariantKey(7, pool, 2));
  });

  it("returns undefined for an empty pool (→ styled-box fallback)", () => {
    expect(pickVariantKey(1, [])).toBeUndefined();
  });
});
