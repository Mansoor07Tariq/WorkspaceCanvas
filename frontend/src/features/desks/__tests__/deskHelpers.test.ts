import { describe, it, expect } from "vitest";
import type { Desk } from "../types/desk.types";
import {
  DESK_CAPABLE_TYPES,
  getDeskForLayoutObject,
  isDeskCapableLayoutObject,
} from "../utils/deskHelpers";

// ─── isDeskCapableLayoutObject ────────────────────────────────────────────────

describe("isDeskCapableLayoutObject", () => {
  it("returns true for 'desk'", () => {
    expect(isDeskCapableLayoutObject("desk")).toBe(true);
  });

  it("returns true for 'standing_desk'", () => {
    expect(isDeskCapableLayoutObject("standing_desk")).toBe(true);
  });

  it("returns true for 'hot_desk'", () => {
    expect(isDeskCapableLayoutObject("hot_desk")).toBe(true);
  });

  it("returns true for 'private_desk'", () => {
    expect(isDeskCapableLayoutObject("private_desk")).toBe(true);
  });

  it("returns false for 'plant'", () => {
    expect(isDeskCapableLayoutObject("plant")).toBe(false);
  });

  it("returns false for 'toilet'", () => {
    expect(isDeskCapableLayoutObject("toilet")).toBe(false);
  });

  it("returns false for 'wall'", () => {
    expect(isDeskCapableLayoutObject("wall")).toBe(false);
  });

  it("returns false for 'sofa'", () => {
    expect(isDeskCapableLayoutObject("sofa")).toBe(false);
  });

  it("returns false for 'table'", () => {
    expect(isDeskCapableLayoutObject("table")).toBe(false);
  });

  it("returns false for 'tv'", () => {
    expect(isDeskCapableLayoutObject("tv")).toBe(false);
  });

  it("returns false for 'door'", () => {
    expect(isDeskCapableLayoutObject("door")).toBe(false);
  });
});

describe("DESK_CAPABLE_TYPES constant", () => {
  it("contains exactly the four desk types", () => {
    expect(DESK_CAPABLE_TYPES.size).toBe(4);
    expect(DESK_CAPABLE_TYPES.has("desk")).toBe(true);
    expect(DESK_CAPABLE_TYPES.has("standing_desk")).toBe(true);
    expect(DESK_CAPABLE_TYPES.has("hot_desk")).toBe(true);
    expect(DESK_CAPABLE_TYPES.has("private_desk")).toBe(true);
  });
});

// ─── getDeskForLayoutObject ───────────────────────────────────────────────────

function makeDesk(overrides: Partial<Desk> = {}): Desk {
  return {
    id: 1,
    organization: 1,
    office: 2,
    floor: 3,
    layout_object: 10,
    layout_object_type: "desk",
    layout_object_label: "Desk A1",
    name: "Desk A1",
    code: "A1",
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("getDeskForLayoutObject", () => {
  it("returns the desk when layout_object matches and desk is active", () => {
    const desk = makeDesk({ layout_object: 10 });
    expect(getDeskForLayoutObject([desk], 10)).toBe(desk);
  });

  it("returns undefined when no desk matches the layout object id", () => {
    const desk = makeDesk({ layout_object: 10 });
    expect(getDeskForLayoutObject([desk], 99)).toBeUndefined();
  });

  it("returns undefined when the matched desk is inactive", () => {
    const desk = makeDesk({ layout_object: 10, is_active: false });
    expect(getDeskForLayoutObject([desk], 10)).toBeUndefined();
  });

  it("returns undefined for an empty desks array", () => {
    expect(getDeskForLayoutObject([], 10)).toBeUndefined();
  });

  it("returns the active desk when both active and inactive desks exist for same object", () => {
    const inactive = makeDesk({ id: 1, layout_object: 10, is_active: false });
    const active = makeDesk({ id: 2, layout_object: 10, is_active: true });
    expect(getDeskForLayoutObject([inactive, active], 10)).toBe(active);
  });

  it("returns correct desk from a list of multiple desks", () => {
    const desk1 = makeDesk({ id: 1, layout_object: 10 });
    const desk2 = makeDesk({ id: 2, layout_object: 20 });
    expect(getDeskForLayoutObject([desk1, desk2], 20)).toBe(desk2);
  });
});
