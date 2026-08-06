import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { LayoutObject } from "../../types/layoutObject.types";
import type { EnhancePlan } from "../../enhance";

// Deterministic engine: two objects, both proposed to move.
const MOCK_PLAN: EnhancePlan = {
  operations: [
    {
      type: "updateObject",
      objectId: 1,
      before: { x: "100", y: "100", width: "80", height: "50", rotation: "0" },
      after: { x: "160", y: "100", width: "80", height: "50", rotation: "0" },
      patch: {},
      reasonCodes: [],
    },
    {
      type: "updateObject",
      objectId: 2,
      before: { x: "200", y: "200", width: "80", height: "50", rotation: "0" },
      after: { x: "260", y: "200", width: "80", height: "50", rotation: "0" },
      patch: {},
      reasonCodes: [],
    },
  ],
  diagnostics: [],
  summary: { changed: 2, unchanged: 0, warnings: 0, iterations: 1, converged: true },
};

const MOCK_SUGGESTIONS = [
  { id: "s1", title: "Move A", description: "", objectIds: [1], reasonCodes: [], severity: "info" },
  { id: "s2", title: "Move B", description: "", objectIds: [2], reasonCodes: [], severity: "info" },
];

vi.mock("@/features/layoutObjects/enhance", () => ({ computeEnhancePlan: () => MOCK_PLAN }));
vi.mock("@/features/layoutObjects/enhancePreview", () => ({
  buildTidySuggestions: () => MOCK_SUGGESTIONS,
}));
vi.mock("@/features/layoutObjects/enhanceApply", () => ({
  applyEnhancePlan: vi.fn(async () => ({
    updated_objects: [],
    applied_count: 2,
    failed_count: 0,
    enhance_run_id: 7,
    status: "success",
  })),
  undoEnhanceRun: vi.fn(),
  retryEnhanceRun: vi.fn(),
  newPlanId: () => "plan-1",
}));

import { useEnhanceTidy } from "../useEnhanceTidy";
import { buildGhostPreview } from "../../enhancePreview/buildGhostPreview";

function obj(id: number, x: string, y: string): LayoutObject {
  return {
    id,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "",
    x,
    y,
    width: "80",
    height: "50",
    rotation: "0",
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

describe("Tidy ghost preview flow (hook × buildGhostPreview × page gating)", () => {
  const objects = [obj(1, "100", "100"), obj(2, "200", "200")];
  const setup = () =>
    renderHook(() =>
      useEnhanceTidy({
        officeId: 1,
        floorId: 1,
        buildInput: () => ({ boundary: { x: 0, y: 0, width: 1000, height: 600 }, objects }),
        onObjectsUpdated: vi.fn(),
      })
    );

  // Mirrors FloorLayoutPage: ghosts exist only while previewing.
  const gate = (t: ReturnType<typeof setup>["result"]["current"]) =>
    t.phase === "preview" ? buildGhostPreview(t.plan, t.selectedObjectIds, objects) : [];

  it("shows ghosts on preview, updates on toggle, clears on cancel and on apply", async () => {
    const { result } = setup();

    // idle → no ghosts
    expect(gate(result.current)).toEqual([]);

    // open preview → a ghost per proposed move
    act(() => result.current.openPreview());
    expect(result.current.phase).toBe("preview");
    expect(gate(result.current).map((g) => g.objectId)).toEqual([1, 2]);

    // untick one suggestion → its ghost vanishes immediately
    act(() => result.current.toggleSuggestion("s1"));
    expect(gate(result.current).map((g) => g.objectId)).toEqual([2]);

    // re-tick → back
    act(() => result.current.toggleSuggestion("s1"));
    expect(gate(result.current).map((g) => g.objectId)).toEqual([1, 2]);

    // cancel → ghosts cleared
    act(() => result.current.cancel());
    expect(gate(result.current)).toEqual([]);

    // re-open then apply → phase leaves preview, ghosts cleared
    act(() => result.current.openPreview());
    expect(gate(result.current)).toHaveLength(2);
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.phase).toBe("result");
    expect(gate(result.current)).toEqual([]);
  });
});
