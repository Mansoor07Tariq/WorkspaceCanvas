import { describe, it, expect } from "vitest";

import {
  isoManifest,
  getIsoAsset,
  getIsoAssetsByBaseType,
  spriteUrl,
} from "../isometric/isoManifest";

describe("isoManifest (PR 080 B1)", () => {
  it("loads the generated manifest with all 86 assets", () => {
    expect(isoManifest.assets.length).toBe(86);
    expect(isoManifest.widths).toEqual([256, 640]);
  });

  it("resolves an asset by key with its parsed metadata", () => {
    const a = getIsoAsset("desk-chair-1");
    expect(a).toBeDefined();
    expect(a?.baseType).toBe("Desk+Chair");
    expect(a?.variantIndex).toBe(1);
    expect(a?.footprint).toMatchObject({ x: 0, y: 0.5, width: 1, height: 0.5 });
  });

  it("carries the ratified overrides (role + type)", () => {
    expect(getIsoAsset("map-1")?.role).toBe("unused");
    expect(getIsoAsset("system-1")?.role).toBe("standalone-desk");
    expect(getIsoAsset("staircase-1")).toMatchObject({ role: "structural", type: "staircase" });
    // doubled-word source name corrected in the base type
    expect(getIsoAsset("long-table-table-with-one-bench")?.baseType).toBe(
      "Long Table with one Bench"
    );
  });

  it("groups assets by base type (aesthetic variants of one desk)", () => {
    const deskSystem = getIsoAssetsByBaseType("Desk+System");
    // 4 plain + 4 ALL + 4 Less + 4 Plant
    expect(deskSystem.length).toBe(16);
    expect(getIsoAssetsByBaseType("Desk+Chair").length).toBe(2);
    expect(getIsoAssetsByBaseType("nope")).toEqual([]);
  });

  it("resolves a committed WebP URL for a known key, undefined otherwise", () => {
    expect(spriteUrl("desk-chair-1")).toBeTruthy();
    expect(spriteUrl("desk-chair-1", 640)).toBeTruthy();
    expect(spriteUrl("does-not-exist")).toBeUndefined();
  });
});
