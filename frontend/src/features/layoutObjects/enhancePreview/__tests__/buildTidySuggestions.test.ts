import { describe, it, expect } from "vitest";
import { buildTidySuggestions } from "../buildTidySuggestions";
import type { LayoutObjectLike } from "../types";
import type { EnhanceOperation, EnhancePlan, GeomSnapshot, ReasonCode } from "../../enhance";

const G: GeomSnapshot = { x: "0.00", y: "0.00", width: "1.00", height: "1.00", rotation: "0.00" };

function op(objectId: number, reasonCodes: ReasonCode[] | string[]): EnhanceOperation {
  return {
    type: "updateObject",
    objectId,
    before: G,
    after: G,
    patch: { x: "1.00" },
    reasonCodes: reasonCodes as ReasonCode[],
  };
}

function plan(ops: EnhanceOperation[]): EnhancePlan {
  return {
    operations: ops,
    diagnostics: [],
    summary: {
      changed: ops.length,
      unchanged: 0,
      warnings: 0,
      iterations: 1,
      converged: true,
    },
  };
}

function obj(over: Partial<LayoutObjectLike> = {}): LayoutObjectLike {
  return {
    id: 1,
    label: "",
    object_type: "desk",
    object_type_display: "Desk",
    ...over,
  };
}

describe("buildTidySuggestions", () => {
  it("builds a friendly boundary suggestion (warning)", () => {
    const s = buildTidySuggestions(plan([op(1, ["clamped-inside"])]), [obj({ id: 1 })]);
    expect(s).toHaveLength(1);
    expect(s[0].title).toMatch(/outside the office boundary/i);
    expect(s[0].description).toMatch(/back inside the usable floor area/i);
    expect(s[0].severity).toBe("warning");
    expect(s[0].objectIds).toEqual([1]);
  });

  it("builds a friendly cutout suggestion (warning)", () => {
    const s = buildTidySuggestions(plan([op(1, ["moved-out-of-cutout"])]), [obj({ id: 1 })]);
    expect(s[0].title).toMatch(/overlaps a cutout area/i);
    expect(s[0].description).toMatch(/usable floor space/i);
    expect(s[0].severity).toBe("warning");
  });

  it("builds a wall-snap suggestion using the object name", () => {
    const s = buildTidySuggestions(plan([op(1, ["snapped-to-wall"])]), [
      obj({ id: 1, object_type_display: "Door" }),
    ]);
    expect(s[0].title).toMatch(/Door is close to a wall/i);
    expect(s[0].description).toMatch(/align it neatly/i);
  });

  it("builds a wall-extended suggestion", () => {
    const s = buildTidySuggestions(plan([op(1, ["wall-extended"])]), [
      obj({ id: 1, object_type: "wall", object_type_display: "Wall" }),
    ]);
    expect(s[0].title).toMatch(/wall segment can connect/i);
  });

  it("groups multiple arrange operations into one suggestion", () => {
    const s = buildTidySuggestions(
      plan([op(1, ["arranged"]), op(2, ["arranged"]), op(3, ["arranged"])]),
      [obj({ id: 1 }), obj({ id: 2 }), obj({ id: 3 })]
    );
    expect(s).toHaveLength(1);
    expect(s[0].title).toBe("Desks are unevenly spaced");
    expect(s[0].objectIds).toEqual([1, 2, 3]);
  });

  it("names a homogeneous group by its pluralized library type", () => {
    const s = buildTidySuggestions(plan([op(1, ["repositioned"]), op(2, ["repositioned"])]), [
      obj({ id: 1, object_type: "standing_desk", object_type_display: "Standing Desk" }),
      obj({ id: 2, object_type: "standing_desk", object_type_display: "Standing Desk" }),
    ]);
    expect(s[0].title).toBe("Standing desks look slightly misaligned");
  });

  it("falls back to 'Objects' for a mixed-type group", () => {
    const s = buildTidySuggestions(plan([op(1, ["repositioned"]), op(2, ["repositioned"])]), [
      obj({ id: 1, object_type: "desk", object_type_display: "Desk" }),
      obj({ id: 2, object_type: "standing_desk", object_type_display: "Standing Desk" }),
    ]);
    expect(s[0].title).toBe("Objects look slightly misaligned");
  });

  it("groups multiple resize operations into one suggestion", () => {
    const s = buildTidySuggestions(plan([op(1, ["resized"]), op(2, ["equalized"])]), [
      obj({ id: 1 }),
      obj({ id: 2 }),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].title).toMatch(/different sizes/i);
  });

  it("uses the object label when present", () => {
    const s = buildTidySuggestions(plan([op(7, ["repositioned"])]), [
      obj({ id: 7, label: "Desk 24" }),
    ]);
    expect(s[0].title).toMatch(/Desk 24 looks slightly misaligned/i);
  });

  it("falls back to the friendly type display when no label", () => {
    const s = buildTidySuggestions(plan([op(7, ["repositioned"])]), [
      obj({ id: 7, label: "", object_type_display: "Standing Desk" }),
    ]);
    expect(s[0].title).toMatch(/Standing Desk looks slightly misaligned/i);
  });

  it("falls back to 'Object' when no label or display", () => {
    const s = buildTidySuggestions(plan([op(7, ["repositioned"])]), [
      obj({ id: 7, label: "", object_type_display: "" }),
    ]);
    expect(s[0].title).toMatch(/^Object looks slightly misaligned/i);
  });

  it("handles an unknown reason code gracefully (generic align copy)", () => {
    const s = buildTidySuggestions(plan([op(1, ["totally-unknown-code"])]), [obj({ id: 1 })]);
    expect(s).toHaveLength(1);
    expect(s[0].title).toMatch(/looks slightly misaligned/i);
  });

  it("orders warnings (boundary/cutout) before info suggestions", () => {
    const s = buildTidySuggestions(
      plan([op(1, ["arranged"]), op(2, ["clamped-inside"]), op(3, ["moved-out-of-cutout"])]),
      [obj({ id: 1 }), obj({ id: 2 }), obj({ id: 3 })]
    );
    expect(s.map((x) => x.severity)).toEqual(["warning", "warning", "info"]);
  });

  it("does not mutate the plan or objects", () => {
    const p = plan([op(1, ["resized", "repositioned"])]);
    const objs = [obj({ id: 1 })];
    const pSnap = JSON.stringify(p);
    const oSnap = JSON.stringify(objs);
    buildTidySuggestions(p, objs);
    expect(JSON.stringify(p)).toBe(pSnap);
    expect(JSON.stringify(objs)).toBe(oSnap);
  });

  it("returns an empty list for an empty plan", () => {
    expect(buildTidySuggestions(plan([]), [])).toEqual([]);
  });
});
