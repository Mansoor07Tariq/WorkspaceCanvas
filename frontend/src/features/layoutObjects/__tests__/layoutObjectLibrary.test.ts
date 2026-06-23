import { describe, it, expect } from "vitest";
import {
  LAYOUT_OBJECT_LIBRARY,
  LAYOUT_OBJECT_CATEGORIES,
  VALID_OBJECT_TYPES,
  getLayoutObjectDefinition,
  getDefaultSizeForObjectType,
  getObjectsByCategory,
  getPaletteObjectsByCategory,
} from "../utils/layoutObjectLibrary";
import type { LayoutObjectType } from "../types/layoutObject.types";

const ALL_BACKEND_TYPES: LayoutObjectType[] = [
  "desk",
  "standing_desk",
  "hot_desk",
  "private_desk",
  "chair",
  "office_chair",
  "meeting_chair",
  "lounge_chair",
  "bench",
  "sofa",
  "chair_table_set",
  "stool",
  "table",
  "lunch_table",
  "boardroom_table",
  "coffee_table",
  "room",
  "lobby",
  "kitchen",
  "bathroom",
  "meeting_room",
  "quiet_room",
  "focus_zone",
  "phone_booth",
  "meeting_pod",
  "wall",
  "door",
  "window",
  "column",
  "partition",
  "toilet",
  "sink",
  "kitchen_sink",
  "cabinet",
  "locker",
  "printer",
  "tv",
  "whiteboard",
  "plant",
  "label",
  "shape",
];

describe("LAYOUT_OBJECT_LIBRARY", () => {
  it("contains exactly 42 object definitions", () => {
    expect(LAYOUT_OBJECT_LIBRARY).toHaveLength(42);
  });

  it("all frontend types match backend ObjectType choices", () => {
    const frontendTypes = LAYOUT_OBJECT_LIBRARY.map((d) => d.type);
    for (const backendType of ALL_BACKEND_TYPES) {
      expect(frontendTypes).toContain(backendType);
    }
  });

  it("all library types are in VALID_OBJECT_TYPES set", () => {
    for (const def of LAYOUT_OBJECT_LIBRARY) {
      expect(VALID_OBJECT_TYPES.has(def.type)).toBe(true);
    }
  });

  it("every definition has a valid category", () => {
    for (const def of LAYOUT_OBJECT_LIBRARY) {
      expect(LAYOUT_OBJECT_CATEGORIES).toContain(def.category);
    }
  });

  it("every definition has positive default dimensions", () => {
    for (const def of LAYOUT_OBJECT_LIBRARY) {
      expect(def.defaultSize.width).toBeGreaterThan(0);
      expect(def.defaultSize.height).toBeGreaterThan(0);
    }
  });

  it("every definition has a non-empty label", () => {
    for (const def of LAYOUT_OBJECT_LIBRARY) {
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate types in library", () => {
    const types = LAYOUT_OBJECT_LIBRARY.map((d) => d.type);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });
});

describe("getLayoutObjectDefinition", () => {
  it("returns definition for known type", () => {
    const def = getLayoutObjectDefinition("desk");
    expect(def).toBeDefined();
    expect(def?.label).toBe("Desk");
    expect(def?.category).toBe("Workstations");
  });

  it("returns undefined for unknown type", () => {
    expect(getLayoutObjectDefinition("spaceship" as LayoutObjectType)).toBeUndefined();
  });
});

describe("getDefaultSizeForObjectType", () => {
  it("returns correct default size for desk", () => {
    expect(getDefaultSizeForObjectType("desk")).toEqual({ width: 80, height: 50 });
  });

  it("returns correct default size for wall", () => {
    expect(getDefaultSizeForObjectType("wall")).toEqual({ width: 200, height: 10 });
  });

  it("returns fallback size for unknown type", () => {
    const size = getDefaultSizeForObjectType("spaceship" as LayoutObjectType);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});

describe("getObjectsByCategory", () => {
  it("returns map with all categories", () => {
    const map = getObjectsByCategory();
    for (const category of LAYOUT_OBJECT_CATEGORIES) {
      expect(map.has(category)).toBe(true);
    }
  });

  it("Workstations category contains desk", () => {
    const map = getObjectsByCategory();
    const workstations = map.get("Workstations") ?? [];
    const types = workstations.map((d) => d.type);
    expect(types).toContain("desk");
  });

  it("Facilities category contains toilet", () => {
    const map = getObjectsByCategory();
    const facilities = map.get("Facilities") ?? [];
    const types = facilities.map((d) => d.type);
    expect(types).toContain("toilet");
  });

  it("total objects across all categories equals library size", () => {
    const map = getObjectsByCategory();
    let total = 0;
    for (const defs of map.values()) {
      total += defs.length;
    }
    expect(total).toBe(42);
  });
});

describe("getPaletteObjectsByCategory (curated PR 065)", () => {
  it("returns only the curated palette types in the requested order", () => {
    const map = getPaletteObjectsByCategory();
    expect((map.get("Workstations") ?? []).map((d) => d.type)).toEqual(["desk", "standing_desk"]);
    expect((map.get("Seating") ?? []).map((d) => d.type)).toEqual([
      "sofa",
      "bench",
      "chair_table_set",
      "stool",
    ]);
    expect((map.get("Rooms & Zones") ?? []).map((d) => d.type)).toEqual([
      "lobby",
      "meeting_room",
      "kitchen",
      "meeting_pod",
      "bathroom",
      "room",
    ]);
    expect((map.get("Facilities") ?? []).map((d) => d.type)).toEqual(["printer"]);
    expect((map.get("Decor") ?? []).map((d) => d.type)).toEqual(["plant"]);
  });

  it("every palette type is a valid object type", () => {
    for (const defs of getPaletteObjectsByCategory().values()) {
      for (const def of defs) expect(VALID_OBJECT_TYPES.has(def.type)).toBe(true);
    }
  });
});
