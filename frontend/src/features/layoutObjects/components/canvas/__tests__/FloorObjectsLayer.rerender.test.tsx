import { createRef } from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type Konva from "konva";
import { FloorObjectsLayer } from "../FloorObjectsLayer";
import type { LayoutObject } from "../../../types/layoutObject.types";

// Render react-konva as plain elements so the tree mounts in jsdom.
vi.mock("react-konva", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Layer: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Group: ({ children }: any) => <div>{children}</div>,
  Transformer: () => null,
  Rect: () => null,
  Line: () => null,
  Circle: () => null,
  Text: () => null,
}));

// Count each object node's renders: the per-type renderer is the leaf of a node, so
// it renders exactly when (and only when) that node renders. React.memo skipping a
// node means its renderer does not run.
const renderCounts = new Map<number, number>();
function SpyRenderer({ object }: { object: LayoutObject }) {
  renderCounts.set(object.id, (renderCounts.get(object.id) ?? 0) + 1);
  return null;
}
vi.mock("@/features/layoutObjects/renderers", () => ({
  getLayoutObjectRenderer: () => SpyRenderer,
}));

function obj(id: number, over: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: `D${id}`,
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

// Stable instances (defined once) — mirrors the real app, where handlers, the node
// ref map, the transformer ref and the id sets keep a constant identity across
// renders and only the `objects`/`selectedObjectId` inputs change.
const stable = {
  onSelectObject: vi.fn(),
  onAvailabilityObjectSelect: vi.fn(),
  setHoveredObjectId: vi.fn(),
  wallDragBoundFor: vi.fn(() => undefined),
  handleObjectDragMove: vi.fn(),
  handleObjectDragEndChecked: vi.fn(),
  onObjectTransformEnd: vi.fn(),
  savingObjectIds: new Set<number>(),
  bookableObjectIds: new Set<number>(),
  nodeRefs: { current: new Map<number, Konva.Group>() },
  transformerRef: createRef<Konva.Transformer>(),
};

function layerProps(objects: LayoutObject[], selectedObjectId: number | null = null) {
  return {
    objects,
    carveShape: false,
    snapWalls: [],
    selectedObjectId,
    isBookingMode: false,
    canManageLayout: true,
    enhanced: false,
    notesTooltipEnabled: false,
    selectedIsWallMounted: false,
    scale: 1,
    ...stable,
  };
}

describe("FloorObjectsLayer — memoised nodes (FE-3)", () => {
  beforeEach(() => renderCounts.clear());

  it("re-renders ONLY the changed object's node when one object updates", () => {
    const a = obj(1);
    const b = obj(2, { x: "300.00" });
    const c = obj(3, { x: "500.00" });
    const { rerender } = render(<FloorObjectsLayer {...layerProps([a, b, c])} />);
    expect(renderCounts.get(1)).toBe(1);
    expect(renderCounts.get(2)).toBe(1);
    expect(renderCounts.get(3)).toBe(1);

    // Simulate an optimistic move of A: a NEW object for id 1, same refs for B and C
    // (exactly how the layout state updates immutably after a drag persist).
    const aMoved = obj(1, { x: "160.00" });
    rerender(<FloorObjectsLayer {...layerProps([aMoved, b, c])} />);

    expect(renderCounts.get(1)).toBe(2); // A re-rendered
    expect(renderCounts.get(2)).toBe(1); // B skipped
    expect(renderCounts.get(3)).toBe(1); // C skipped
  });

  it("re-renders only the node whose selection flag changed", () => {
    const a = obj(1);
    const b = obj(2, { x: "300.00" });
    const { rerender } = render(<FloorObjectsLayer {...layerProps([a, b], null)} />);
    renderCounts.clear();

    rerender(<FloorObjectsLayer {...layerProps([a, b], 1)} />);
    expect(renderCounts.get(1)).toBe(1); // A now selected → re-rendered
    expect(renderCounts.get(2)).toBeUndefined(); // B unchanged → skipped
  });
});
