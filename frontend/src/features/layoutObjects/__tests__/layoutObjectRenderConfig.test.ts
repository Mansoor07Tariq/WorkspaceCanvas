import { describe, it, expect } from "vitest";
import {
  getLayoutObjectRenderConfig,
  ALL_LAYOUT_OBJECT_TYPES,
  SELECTED_STROKE,
  SELECTED_STROKE_WIDTH,
} from "../utils/layoutObjectRenderConfig";
import { LAYOUT_OBJECT_LIBRARY } from "../utils/layoutObjectLibrary";
import type { LayoutObjectType } from "../types/layoutObject.types";

const VALID_SHAPES = ["rect", "circle"] as const;
const VALID_CATEGORIES = [
  "Workstations",
  "Seating",
  "Tables",
  "Rooms & Zones",
  "Structure",
  "Facilities",
  "Decor",
] as const;

describe("ALL_LAYOUT_OBJECT_TYPES", () => {
  it("covers all 36 library types", () => {
    const libraryTypes = new Set(LAYOUT_OBJECT_LIBRARY.map((d) => d.type));
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      expect(libraryTypes.has(type)).toBe(true);
    }
  });

  it("has no duplicate types", () => {
    const unique = new Set(ALL_LAYOUT_OBJECT_TYPES);
    expect(unique.size).toBe(ALL_LAYOUT_OBJECT_TYPES.length);
  });
});

describe("getLayoutObjectRenderConfig", () => {
  it("returns a config for every known type", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      const config = getLayoutObjectRenderConfig(type);
      expect(config).toBeDefined();
    }
  });

  it("every config has required fields", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      const config = getLayoutObjectRenderConfig(type);
      expect(typeof config.fill).toBe("string");
      expect(typeof config.stroke).toBe("string");
      expect(typeof config.strokeWidth).toBe("number");
      expect(Array.isArray(config.dashPattern)).toBe(true);
      expect(typeof config.opacity).toBe("number");
      expect(typeof config.cornerRadius).toBe("number");
      expect(VALID_SHAPES).toContain(config.shape);
      expect(typeof config.shortCode).toBe("string");
      expect(config.shortCode.length).toBeGreaterThan(0);
      expect(VALID_CATEGORIES).toContain(config.category);
    }
  });

  it("opacity is between 0 and 1 for every type", () => {
    for (const type of ALL_LAYOUT_OBJECT_TYPES) {
      const { opacity } = getLayoutObjectRenderConfig(type);
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });

  it("desk is Workstations category with rect shape", () => {
    const config = getLayoutObjectRenderConfig("desk");
    expect(config.category).toBe("Workstations");
    expect(config.shape).toBe("rect");
  });

  it("chair is Seating category with circle shape", () => {
    const config = getLayoutObjectRenderConfig("chair");
    expect(config.category).toBe("Seating");
    expect(config.shape).toBe("circle");
  });

  it("plant is Decor category with circle shape", () => {
    const config = getLayoutObjectRenderConfig("plant");
    expect(config.category).toBe("Decor");
    expect(config.shape).toBe("circle");
  });

  it("wall is Structure category", () => {
    const config = getLayoutObjectRenderConfig("wall");
    expect(config.category).toBe("Structure");
  });

  it("meeting_room is Rooms & Zones category with dashed pattern", () => {
    const config = getLayoutObjectRenderConfig("meeting_room");
    expect(config.category).toBe("Rooms & Zones");
    expect(config.dashPattern.length).toBeGreaterThan(0);
  });

  it("toilet is Facilities category", () => {
    const config = getLayoutObjectRenderConfig("toilet");
    expect(config.category).toBe("Facilities");
  });

  it("returns fallback for unknown type", () => {
    const config = getLayoutObjectRenderConfig("spaceship" as LayoutObjectType);
    expect(config).toBeDefined();
    expect(config.shape).toBe("rect");
    expect(config.shortCode).toBe("???");
  });

  it("SELECTED_STROKE and SELECTED_STROKE_WIDTH are exported", () => {
    expect(typeof SELECTED_STROKE).toBe("string");
    expect(SELECTED_STROKE.startsWith("#")).toBe(true);
    expect(typeof SELECTED_STROKE_WIDTH).toBe("number");
    expect(SELECTED_STROKE_WIDTH).toBeGreaterThan(0);
  });
});
