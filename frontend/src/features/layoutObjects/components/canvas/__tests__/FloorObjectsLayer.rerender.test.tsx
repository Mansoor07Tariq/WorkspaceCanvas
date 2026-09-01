import { createRef } from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type Konva from "konva";
import { FloorObjectsLayer } from "../FloorObjectsLayer";
import type { LayoutObject } from "../../../types/layoutObject.types";
import type { OccupantIdentity } from "@/features/bookings/utils/bookingAvailability";

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
// Records the order in which nodes paint (React renders children in array order, and the layer
// maps its y-sorted `orderedObjects`), so we can assert the back-to-front draw order (PR 081).
const renderOrder: number[] = [];
function SpyRenderer({ object }: { object: LayoutObject }) {
  renderCounts.set(object.id, (renderCounts.get(object.id) ?? 0) + 1);
  renderOrder.push(object.id);
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

function layerProps(
  objects: LayoutObject[],
  selectedObjectId: number | null = null,
  occupantByLayoutObjectId?: ReadonlyMap<number, OccupantIdentity>,
  hoveredObjectId: number | null = null
) {
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
    hoveredObjectId,
    occupantByLayoutObjectId,
    ...stable,
  };
}

const occ = (over: Partial<OccupantIdentity> = {}): OccupantIdentity => ({
  kind: "colleague",
  name: "Alice",
  avatarUrl: null,
  colorKey: 1,
  ...over,
});

describe("FloorObjectsLayer — memoised nodes (FE-3)", () => {
  beforeEach(() => {
    renderCounts.clear();
    renderOrder.length = 0;
  });

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

  it("re-renders ONLY the desk whose occupant changed, not every booked desk (PR 080 B3)", () => {
    const a = obj(1);
    const b = obj(2, { x: "300.00" });
    const c = obj(3, { x: "500.00" });
    // Desks 1 & 2 booked; desk 3 free (no occupant).
    const before = new Map<number, OccupantIdentity>([
      [1, occ({ name: "Alice", colorKey: 1 })],
      [2, occ({ name: "Bob", colorKey: 2 })],
    ]);
    const { rerender } = render(<FloorObjectsLayer {...layerProps([a, b, c], null, before)} />);
    renderCounts.clear();

    // A NEW map (as buildOccupantByLayoutObjectId returns each rebuild), where only desk 1's
    // occupant actually changed; desks 2 & 3 have identical scalar values (new refs).
    const after = new Map<number, OccupantIdentity>([
      [1, occ({ name: "Alice", colorKey: 9 })], // colour changed → different scalar
      [2, occ({ name: "Bob", colorKey: 2 })], // identical scalars → must skip
    ]);
    rerender(<FloorObjectsLayer {...layerProps([a, b, c], null, after)} />);

    expect(renderCounts.get(1)).toBe(1); // occupant changed → re-rendered
    expect(renderCounts.get(2)).toBeUndefined(); // same scalars despite new map → skipped
    expect(renderCounts.get(3)).toBeUndefined(); // free desk, untouched → skipped
  });

  it("MIXED floor (desk + room + sofa + plant): one booking change re-renders only that node (PR 080 B4)", () => {
    // A realistic mix at varied y so the B4 y-sort actually reorders them.
    const deskA = obj(1, { object_type: "desk", y: "400.00" });
    const roomB = obj(2, { object_type: "meeting_room", y: "80.00", width: "220", height: "180" });
    const sofaC = obj(3, { object_type: "sofa", y: "250.00" });
    const plantD = obj(4, { object_type: "plant", y: "250.00", x: "600.00" });
    const before = new Map<number, OccupantIdentity>([[1, occ({ name: "Alice", colorKey: 1 })]]);
    const { rerender } = render(
      <FloorObjectsLayer {...layerProps([deskA, roomB, sofaC, plantD], null, before)} />
    );
    // Every node rendered once regardless of type / sort order.
    expect(renderCounts.get(1)).toBe(1);
    expect(renderCounts.get(2)).toBe(1);
    expect(renderCounts.get(3)).toBe(1);
    expect(renderCounts.get(4)).toBe(1);
    renderCounts.clear();

    // Someone books the desk (occupant appears) — a NEW occupant map, same object refs.
    const after = new Map<number, OccupantIdentity>([[1, occ({ name: "Alice", colorKey: 5 })]]);
    rerender(<FloorObjectsLayer {...layerProps([deskA, roomB, sofaC, plantD], null, after)} />);

    expect(renderCounts.get(1)).toBe(1); // the desk re-rendered
    expect(renderCounts.get(2)).toBeUndefined(); // room skipped
    expect(renderCounts.get(3)).toBeUndefined(); // sofa skipped
    expect(renderCounts.get(4)).toBeUndefined(); // plant skipped
  });

  it("desks in rows paint BACK-TO-FRONT by bottom edge, so a front desk's overflow covers the one behind (PR 081)", () => {
    // Two rows of desks at typical spacing; array order is deliberately scrambled.
    const backRow = [obj(10, { y: "100.00" }), obj(11, { x: "300.00", y: "100.00" })];
    const frontRow = [obj(20, { y: "300.00" }), obj(21, { x: "300.00", y: "300.00" })];
    render(
      <FloorObjectsLayer {...layerProps([frontRow[1], backRow[0], frontRow[0], backRow[1]])} />
    );
    // Each node paints once, and every back-row id (bottom edge 150) paints before every front-row
    // id (bottom edge 350) — so upward-overflowing front sprites draw on top of the row behind.
    const lastBack = Math.max(renderOrder.indexOf(10), renderOrder.indexOf(11));
    const firstFront = Math.min(renderOrder.indexOf(20), renderOrder.indexOf(21));
    expect(lastBack).toBeLessThan(firstFront);
    for (const id of [10, 11, 20, 21]) expect(renderCounts.get(id)).toBe(1);
  });

  // ─── PR 083 Part A: hover drives the border, and must stay cheap ───────────────

  it("moving the pointer between objects re-renders ONLY the two nodes whose hover changed", () => {
    // Hover fires continuously as the pointer crosses a floor, so this is the guarantee that
    // matters: `isHovered` is a flat compared scalar, NOT the hovered id, so a hover change is
    // O(2) re-renders regardless of floor size — never O(n).
    const objs = [
      obj(1, { object_type: "desk", y: "400.00" }),
      obj(2, { object_type: "meeting_room", y: "80.00", width: "220", height: "180" }),
      obj(3, { object_type: "sofa", y: "250.00" }),
      obj(4, { object_type: "plant", y: "250.00", x: "600.00" }),
      obj(5, { object_type: "desk", x: "700.00", y: "400.00" }),
    ];
    const { rerender } = render(<FloorObjectsLayer {...layerProps(objs, null, undefined, null)} />);
    for (const id of [1, 2, 3, 4, 5]) expect(renderCounts.get(id)).toBe(1);

    // Pointer ENTERS object 3 (nothing was hovered before) → only node 3 re-renders.
    renderCounts.clear();
    rerender(<FloorObjectsLayer {...layerProps(objs, null, undefined, 3)} />);
    expect(renderCounts.get(3)).toBe(1);
    for (const id of [1, 2, 4, 5]) expect(renderCounts.get(id)).toBeUndefined();

    // Pointer MOVES 3 → 5: exactly the node being left and the node being entered.
    renderCounts.clear();
    rerender(<FloorObjectsLayer {...layerProps(objs, null, undefined, 5)} />);
    expect(renderCounts.get(3)).toBe(1); // left
    expect(renderCounts.get(5)).toBe(1); // entered
    for (const id of [1, 2, 4]) expect(renderCounts.get(id)).toBeUndefined();

    // Pointer LEAVES the floor → only the node being left.
    renderCounts.clear();
    rerender(<FloorObjectsLayer {...layerProps(objs, null, undefined, null)} />);
    expect(renderCounts.get(5)).toBe(1);
    for (const id of [1, 2, 3, 4]) expect(renderCounts.get(id)).toBeUndefined();
  });

  it("re-hovering the SAME object re-renders nothing", () => {
    const objs = [obj(1), obj(2, { x: "300.00" })];
    const { rerender } = render(<FloorObjectsLayer {...layerProps(objs, null, undefined, 1)} />);
    renderCounts.clear();
    rerender(<FloorObjectsLayer {...layerProps(objs, null, undefined, 1)} />);
    expect(renderCounts.get(1)).toBeUndefined();
    expect(renderCounts.get(2)).toBeUndefined();
  });
});
