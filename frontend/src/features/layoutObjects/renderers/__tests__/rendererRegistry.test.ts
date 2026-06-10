import { describe, it, expect } from "vitest";
import { getLayoutObjectRenderer, DefaultLayoutObjectRenderer } from "../index";
import { ALL_LAYOUT_OBJECT_TYPES } from "../../utils/layoutObjectRenderConfig";
import type { LayoutObjectType } from "../../types/layoutObject.types";

describe("layout object renderer registry", () => {
  it("resolves a renderer for every known object type without throwing", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      const renderer = getLayoutObjectRenderer(type);
      expect(typeof renderer).toBe("function");
    }
  });

  it("falls back to the default renderer for every type (no overrides registered yet)", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      expect(getLayoutObjectRenderer(type)).toBe(DefaultLayoutObjectRenderer);
    }
  });

  it("falls back to the default renderer for an unknown/unregistered type", () => {
    const unknown = "not_a_real_type" as LayoutObjectType;
    expect(getLayoutObjectRenderer(unknown)).toBe(DefaultLayoutObjectRenderer);
  });
});
