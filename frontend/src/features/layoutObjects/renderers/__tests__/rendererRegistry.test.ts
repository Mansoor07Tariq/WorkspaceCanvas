import { describe, it, expect } from "vitest";
import { getLayoutObjectRenderer, DefaultLayoutObjectRenderer } from "../index";
import { IsometricAssetRenderer } from "../isometric/IsometricAssetRenderer";
import { ALL_LAYOUT_OBJECT_TYPES } from "../../utils/layoutObjectRenderConfig";
import type { LayoutObjectType } from "../../types/layoutObject.types";

// Types that have a pre-built isometric asset (used only in enhanced mode).
const ISOMETRIC_TYPES: LayoutObjectType[] = ["desk", "meeting_room"];

describe("layout object renderer registry", () => {
  it("resolves a renderer for every known object type without throwing", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      expect(typeof getLayoutObjectRenderer(type)).toBe("function");
      expect(typeof getLayoutObjectRenderer(type, true)).toBe("function");
    }
  });

  it("defaults every type to the simple shape renderer (not enhanced)", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      expect(getLayoutObjectRenderer(type)).toBe(DefaultLayoutObjectRenderer);
      expect(getLayoutObjectRenderer(type, false)).toBe(DefaultLayoutObjectRenderer);
    }
  });

  it("uses the isometric asset renderer for asset-backed types when enhanced", () => {
    for (const type of ISOMETRIC_TYPES) {
      expect(getLayoutObjectRenderer(type, true)).toBe(IsometricAssetRenderer);
    }
  });

  it("keeps non-asset types on the default renderer even when enhanced", () => {
    const others = ALL_LAYOUT_OBJECT_TYPES.filter((t) => !ISOMETRIC_TYPES.includes(t));
    for (const type of others) {
      expect(getLayoutObjectRenderer(type, true)).toBe(DefaultLayoutObjectRenderer);
    }
  });

  it("falls back to the default renderer for an unknown/unregistered type", () => {
    const unknown = "not_a_real_type" as LayoutObjectType;
    expect(getLayoutObjectRenderer(unknown)).toBe(DefaultLayoutObjectRenderer);
    expect(getLayoutObjectRenderer(unknown, true)).toBe(DefaultLayoutObjectRenderer);
  });
});
