import { describe, it, expect } from "vitest";
import { buildGhostPreview } from "../buildGhostPreview";
import type { EnhanceOperation, EnhancePlan, GeomSnapshot } from "../../enhance/types";
import type { LayoutObject } from "../../types/layoutObject.types";

function snap(x: string, y: string, w = "80", h = "50", rot = "0"): GeomSnapshot {
  return { x, y, width: w, height: h, rotation: rot };
}

function op(objectId: number, after: GeomSnapshot): EnhanceOperation {
  return { type: "updateObject", objectId, before: after, after, patch: {}, reasonCodes: [] };
}

function plan(...operations: EnhanceOperation[]): EnhancePlan {
  return {
    operations,
    diagnostics: [],
    summary: {
      changed: operations.length,
      unchanged: 0,
      warnings: 0,
      iterations: 1,
      converged: true,
    },
  };
}

function obj(id: number, x: string, y: string, w = "80", h = "50", rot = "0"): LayoutObject {
  return {
    id,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "",
    x,
    y,
    width: w,
    height: h,
    rotation: rot,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

describe("buildGhostPreview", () => {
  it("returns [] when there is no plan", () => {
    expect(buildGhostPreview(null, new Set([1]), [obj(1, "100", "100")])).toEqual([]);
  });

  it("includes only operations for the selected objects (selection filtering)", () => {
    const objects = [obj(1, "100", "100"), obj(2, "200", "200"), obj(3, "300", "300")];
    const p = plan(op(1, snap("160", "100")), op(2, snap("260", "200")), op(3, snap("360", "300")));
    const ghosts = buildGhostPreview(p, new Set([1, 3]), objects);
    expect(ghosts.map((g) => g.objectId)).toEqual([1, 3]);
  });

  it("flags a move (centre changes) and carries the after geometry", () => {
    const objects = [obj(1, "100", "100", "80", "50")]; // centre (140,125)
    const [g] = buildGhostPreview(
      plan(op(1, snap("140", "100", "80", "50"))),
      new Set([1]),
      objects
    );
    expect(g.moved).toBe(true); // centre → (180,125)
    expect(g.resized).toBe(false);
    expect(g.after).toEqual({ x: 140, y: 100, width: 80, height: 50, rotation: 0 });
  });

  it("flags a pure resize (centre unchanged) as resized, not moved", () => {
    const objects = [obj(1, "100", "100", "80", "50")]; // centre (140,125)
    // Grow to 100×70 but keep the same centre → top-left (90,90).
    const [g] = buildGhostPreview(
      plan(op(1, snap("90", "90", "100", "70"))),
      new Set([1]),
      objects
    );
    expect(g.moved).toBe(false);
    expect(g.resized).toBe(true);
  });

  it("shows a rotation-only change (neither moved nor resized) as a ghost", () => {
    const objects = [obj(1, "100", "100", "80", "50", "0")];
    const ghosts = buildGhostPreview(
      plan(op(1, snap("100", "100", "80", "50", "90"))),
      new Set([1]),
      objects
    );
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]).toMatchObject({ moved: false, resized: false });
    expect(ghosts[0].after.rotation).toBe(90);
  });

  it("excludes operations with no visible change", () => {
    const objects = [obj(1, "100", "100", "80", "50", "0")];
    const ghosts = buildGhostPreview(
      plan(op(1, snap("100", "100", "80", "50", "0"))),
      new Set([1]),
      objects
    );
    expect(ghosts).toEqual([]);
  });

  it("skips operations whose object is missing/stale (no crash)", () => {
    const objects = [obj(1, "100", "100")];
    const ghosts = buildGhostPreview(
      plan(op(1, snap("160", "100")), op(99, snap("500", "500"))),
      new Set([1, 99]),
      objects
    );
    expect(ghosts.map((g) => g.objectId)).toEqual([1]);
  });
});
