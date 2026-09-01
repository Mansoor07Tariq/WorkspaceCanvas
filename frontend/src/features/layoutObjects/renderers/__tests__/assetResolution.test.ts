import { describe, it, expect } from "vitest";
import { SINGLE_SPRITE_MAP } from "../isometric/assetMapping";
import { getIsoAssetsByBaseType, spriteUrl } from "../isometric/isoManifest";
import { pickVariantKey } from "../isometric/spriteVariant";

describe("PROBE: single-sprite asset resolution", () => {
  for (const [type, mapping] of Object.entries(SINGLE_SPRITE_MAP)) {
    const baseTypes = "base" in mapping ? [mapping.base] : [mapping.small, mapping.large];
    for (const bt of baseTypes) {
      it(`${type} → "${bt}" resolves assets + a spriteUrl`, () => {
        const assets = getIsoAssetsByBaseType(bt);
        expect(assets.length, `getIsoAssetsByBaseType("${bt}") empty`).toBeGreaterThan(0);
        for (let id = 1; id <= 8; id++) {
          const key = pickVariantKey(id, assets);
          expect(key, `no key for ${bt} id${id}`).toBeTruthy();
          expect(spriteUrl(key!), `spriteUrl("${key}") falsy`).toBeTruthy();
        }
      });
    }
  }
});
