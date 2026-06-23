import { describe, it, expect } from "vitest";
import { computeEnhancePlan } from "../computeEnhancePlan";
import { DEFAULT_FLOOR_BOUNDARY } from "../../utils/coordinateHelpers";
import type { LayoutObject } from "../../types/layoutObject.types";

const B = DEFAULT_FLOOR_BOUNDARY; // { 48, 48, 904, 544 }

function obj(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 1,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "",
    x: "100.00",
    y: "200.00",
    width: "80.00",
    height: "50.00",
    rotation: "0.00",
    is_bookable: false,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("computeEnhancePlan — contract", () => {
  it("returns an empty plan for an already-tidy / isolated layout", () => {
    const plan = computeEnhancePlan({ boundary: B, objects: [obj({ x: "300.00", y: "300.00" })] });
    expect(plan.operations).toHaveLength(0);
    expect(plan.summary.changed).toBe(0);
    expect(plan.summary.unchanged).toBe(1);
    expect(plan.summary.converged).toBe(true);
  });

  it("does not mutate its inputs", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "182.00", y: "200.00", width: "120.00", height: "90.00" });
    const objects = [a, b];
    const snapshot = JSON.stringify(objects);
    computeEnhancePlan({ boundary: B, objects });
    expect(JSON.stringify(objects)).toBe(snapshot);
  });

  it("emits operations with before / after / patch / reasonCodes", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "182.00", y: "200.00", width: "120.00", height: "90.00" });
    const plan = computeEnhancePlan({ boundary: B, objects: [a, b] });
    expect(plan.operations.length).toBeGreaterThan(0);
    const op = plan.operations.find((o) => o.objectId === 2)!;
    expect(op.type).toBe("updateObject");
    expect(op.before.width).toBe("120.00");
    expect(op.after.width).toBe("100.00"); // averaged (80+120)/2
    expect(Object.keys(op.patch).length).toBeGreaterThan(0);
    expect(op.reasonCodes).toContain("resized");
  });

  it("labels a same-size desk that only moved as 'arranged' (not a bare reposition)", () => {
    // Two 80×50 desks, slightly offset → they align into one row (move, no resize).
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "188.00", y: "203.00", width: "80.00", height: "50.00" });
    const plan = computeEnhancePlan({ boundary: B, objects: [a, b] });
    const op = plan.operations.find((o) => o.objectId === 2)!;
    expect(op.reasonCodes).toContain("arranged");
    expect(op.reasonCodes).not.toContain("resized");
    expect(op.reasonCodes).not.toContain("repositioned");
  });

  it("is deterministic — identical inputs produce identical operations", () => {
    const make = () => [
      obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" }),
      obj({ id: 2, x: "182.00", y: "200.00", width: "120.00", height: "90.00" }),
    ];
    const p1 = computeEnhancePlan({ boundary: B, objects: make() });
    const p2 = computeEnhancePlan({ boundary: B, objects: make() });
    expect(p1.operations).toEqual(p2.operations);
    expect(p1.summary).toEqual(p2.summary);
  });

  it("tags wall end-extension with the wall-extended reason code", () => {
    const wall = obj({
      id: 1,
      object_type: "wall",
      x: "700.00",
      y: "300.00",
      width: "246.00", // right end 946 → 6px from right wall (952)
      height: "10.00",
    });
    const plan = computeEnhancePlan({ boundary: B, objects: [wall] });
    const op = plan.operations.find((o) => o.objectId === 1)!;
    expect(op.reasonCodes).toEqual(["wall-extended"]);
  });

  it("summary counts changed vs unchanged correctly", () => {
    const a = obj({ id: 1, x: "100.00", y: "200.00", width: "80.00", height: "50.00" });
    const b = obj({ id: 2, x: "182.00", y: "200.00", width: "120.00", height: "90.00" });
    const lone = obj({ id: 3, x: "400.00", y: "400.00" }); // far away → untouched
    const plan = computeEnhancePlan({ boundary: B, objects: [a, b, lone] });
    expect(plan.summary.changed).toBe(plan.operations.length);
    expect(plan.summary.changed + plan.summary.unchanged).toBe(3);
  });
});
