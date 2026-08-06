import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type Konva from "konva";
import { useDragGuides } from "../useDragGuides";
import type { DragGuidesHandle } from "../../components/canvas/DragGuidesLayer";
import type { LayoutObject } from "../../types/layoutObject.types";

function obj(id: number, over: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: "",
    x: "100.00",
    y: "100.00",
    width: "80.00",
    height: "50.00",
    rotation: "0.00",
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

/** A fake Konva node exposing only what the hook touches. */
function fakeNode(cx: number, cy: number) {
  return {
    x: () => cx,
    y: () => cy,
    position: vi.fn(),
    getLayer: () => ({ batchDraw: vi.fn() }),
  } as unknown as Konva.Node;
}

function setup(onObjectDragEnd = vi.fn()) {
  const handle: DragGuidesHandle = { setGuides: vi.fn(), clear: vi.fn() };
  const guidesRef = { current: handle };
  const nodeRefs = { current: new Map<number, Konva.Group>() };
  const A = obj(1); // existing desk at (100,100) 80×50 → right edge 180, top 100
  const B = obj(2);
  const { result } = renderHook(() =>
    useDragGuides({ objects: [A, B], nodeRefs, onObjectDragEnd, guidesRef })
  );
  return { result, handle, onObjectDragEnd, B };
}

describe("useDragGuides — imperative guides (FE-3)", () => {
  it("draws guides through the imperative handle on dragmove (no React state)", () => {
    const { result, handle, B } = setup();
    // Drag B so its top-left lands flush right of A (centre 220,125 → top-left 180,100).
    const node = fakeNode(220, 125);
    act(() => result.current.handleObjectDragMove(B, node));
    // The node was snapped imperatively and the guides pushed straight to the layer.
    expect(node.position).toHaveBeenCalledTimes(1);
    expect(handle.setGuides).toHaveBeenCalledTimes(1);
    const guides = (handle.setGuides as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(Array.isArray(guides)).toBe(true);
    expect(guides.length).toBeGreaterThan(0); // aligned with A → at least one guide
  });

  it("clears the guides on dragend and forwards the drop to onObjectDragEnd", () => {
    const onObjectDragEnd = vi.fn(() => undefined); // reverted / no final position
    const { result, handle, B } = setup(onObjectDragEnd);
    act(() => result.current.handleObjectDragEndChecked(B.id, 180, 100));
    expect(handle.clear).toHaveBeenCalledTimes(1);
    expect(onObjectDragEnd).toHaveBeenCalledWith(B.id, 180, 100);
  });

  it("keeps the two handlers referentially stable across renders (memo-safe)", () => {
    const handle: DragGuidesHandle = { setGuides: vi.fn(), clear: vi.fn() };
    const guidesRef = { current: handle };
    const nodeRefs = { current: new Map<number, Konva.Group>() };
    const { result, rerender } = renderHook(
      ({ objects }) => useDragGuides({ objects, nodeRefs, onObjectDragEnd: vi.fn(), guidesRef }),
      { initialProps: { objects: [obj(1)] } }
    );
    const first = result.current;
    rerender({ objects: [obj(1), obj(2)] }); // objects changed
    expect(result.current.handleObjectDragMove).toBe(first.handleObjectDragMove);
    expect(result.current.handleObjectDragEndChecked).toBe(first.handleObjectDragEndChecked);
  });
});
