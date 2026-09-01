import { describe, it, expect } from "vitest";
import type { IsoAsset } from "../isometric/isoManifest";
import { fnv1a, pickVariantKey } from "../isometric/spriteVariant";

// Only `key` and `baseType` are read by pickVariantKey.
const asset = (key: string, baseType: string) => ({ key, baseType }) as IsoAsset;
const FAM_A = [asset("a3", "Desk+System"), asset("a1", "Desk+System"), asset("a2", "Desk+System")];
const FAM_B = [asset("b1", "Big Sofa"), asset("b2", "Big Sofa"), asset("b3", "Big Sofa")];
const sortedKeys = (p: IsoAsset[]) =>
  [...p].sort((a, b) => a.key.localeCompare(b.key)).map((a) => a.key);
const indexOfPick = (floor: number, pool: IsoAsset[], salt = 0) =>
  sortedKeys(pool).indexOf(pickVariantKey(floor, pool, salt)!);

describe("fnv1a", () => {
  it("is deterministic and distinct", () => {
    expect(fnv1a("a")).toBe(fnv1a("a"));
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
  });
});

describe("pickVariantKey — FLOOR-scoped variants (PR 082)", () => {
  it("every object of one family on one floor gets the SAME variant", () => {
    // The object id is no longer an input at all (enforced by the signature), so four desks on
    // floor 5 cannot disagree — they all resolve through the same (floor, family) key.
    const picks = new Set([1, 2, 3, 4].map(() => pickVariantKey(5, FAM_A)));
    expect(picks.size).toBe(1);
  });

  it("different floors do NOT all collapse to one variant (checked across many ids)", () => {
    // A single pair of adjacent floors can collide by chance, so assert variety over a spread.
    const keys = new Set(Array.from({ length: 30 }, (_, i) => pickVariantKey(i + 1, FAM_A)));
    expect(keys.size).toBeGreaterThan(1);
    expect(keys.size).toBe(FAM_A.length); // in fact all three variants are reachable
  });

  it("different FAMILIES on the same floor resolve independently", () => {
    // Desks choosing a style must not force sofas onto the matching index of their own family.
    const differs = Array.from({ length: 30 }, (_, i) => i + 1).some(
      (floor) => indexOfPick(floor, FAM_A) !== indexOfPick(floor, FAM_B)
    );
    expect(differs).toBe(true);
  });

  it("salt still separates several pieces placed by one object", () => {
    // Deterministic per salt...
    expect(pickVariantKey(7, FAM_A, 1)).toBe(pickVariantKey(7, FAM_A, 1));
    // ...and salts are not locked to each other (a room's shelf + table stay independent).
    const differs = Array.from({ length: 30 }, (_, i) => i + 1).some(
      (floor) => indexOfPick(floor, FAM_A, 1) !== indexOfPick(floor, FAM_A, 2)
    );
    expect(differs).toBe(true);
  });

  it("is stable across reloads (pure function of floor + family + salt)", () => {
    expect(pickVariantKey(12, FAM_A)).toBe(pickVariantKey(12, FAM_A));
  });

  it("is order-independent (sorts the pool by key first)", () => {
    expect(pickVariantKey(7, [asset("a1", "F"), asset("a2", "F"), asset("a3", "F")])).toBe(
      pickVariantKey(7, [asset("a3", "F"), asset("a2", "F"), asset("a1", "F")])
    );
  });

  it("always returns a key from the pool", () => {
    for (let floor = 0; floor < 20; floor += 1) {
      expect(sortedKeys(FAM_A)).toContain(pickVariantKey(floor, FAM_A));
    }
  });

  it("returns undefined for an empty pool (→ styled-box fallback)", () => {
    expect(pickVariantKey(1, [])).toBeUndefined();
  });
});
