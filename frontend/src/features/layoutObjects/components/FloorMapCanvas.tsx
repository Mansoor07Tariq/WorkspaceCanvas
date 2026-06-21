import { useRef, useEffect, useMemo, useState } from "react";
import { Stage, Layer, Rect, Line, Transformer } from "react-konva";
import { Box, Typography } from "@mui/material";
import type Konva from "konva";
import { en } from "@/i18n/en";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_GRID_SIZE,
  MIN_OBJECT_SIZE,
  DEFAULT_FLOOR_BOUNDARY,
  BOUNDARY_WALL_THICKNESS,
  FLOOR_BOUNDARY_INSET,
  MIN_FLOOR_BOUNDARY,
  clampBoundarySize,
  type FloorBoundary,
} from "../utils/coordinateHelpers";
import { wheelZoomFactor } from "../utils/canvasViewport";
import {
  getSnapWalls,
  snapToWall,
  getMountDimensions,
  isWallMountedType,
  alignOpeningToWall,
  nearestWall,
  projectAlong,
  pointOnWall,
  openingsOnWall,
  isAlongFree,
  clampAlongWithinGap,
  type WallPlacement,
} from "../utils/wallPlacement";
import { computeNeighborSnap, type SnapGuide } from "../utils/objectSnapping";
import {
  getCutoutRects,
  computeFloorCarveRects,
  computeFloorWallSegments,
} from "../utils/floorShape";
import { getLayoutObjectRenderConfig } from "../utils/layoutObjectRenderConfig";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { LayoutObjectCanvasNode } from "./LayoutObjectCanvasNode";
import { CanvasZoomControls } from "./CanvasZoomControls";
import type { LayoutObject, LayoutObjectType } from "../types/layoutObject.types";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";

export { CANVAS_WIDTH, CANVAS_HEIGHT };

const GRID_COLOR = "#E5E7EB";
const CANVAS_BG = "#F3F4F6"; // grey margin outside the room (gray-100)
const ROOM_FILL = "#FFFFFF"; // white interior of the office

// Walls are drawn to match the "wall" object from the library (Structure
// palette): a solid grey band with a darker outline, not a thin line. The four
// segments frame the white interior and extend OUTWARD from the boundary, so the
// containment region (DEFAULT_FLOOR_BOUNDARY) stays the inner wall face.
const WALL_FILL = "#D1D5DB"; // gray-300 — same as the wall object fill
const WALL_STROKE = "#4B5563"; // gray-600 — same as the wall object stroke
const WALL_STROKE_WIDTH = 2;
const WALL_THICKNESS = BOUNDARY_WALL_THICKNESS;

const GUIDE_COLOR = "#EC4899"; // pink-500 alignment guides
const BOUNDARY_HANDLE_COLOR = "#2563EB"; // blue-600 room-resize handles
const ROOM_WALL_COLOR = "#6B7280"; // gray-500 — thin walls drawn around rooms in enhance
const ROOM_WALL_THICKNESS = 5;

// Objects rotate in 10° increments — snap the transformer's rotation handle to
// every multiple of 10 (tolerance 5 covers the whole range, so it always snaps).
const ROTATION_SNAPS = Array.from({ length: 36 }, (_, i) => i * 10);

// Four wall segments framing the interior, each extending outward by
// WALL_THICKNESS. Top/bottom span the full width (incl. corners) so the corners
// read as solid wall. Computed from the (editable) boundary so they track resize.
function buildWallSegments(b: FloorBoundary) {
  return [
    // top
    {
      x: b.x - WALL_THICKNESS,
      y: b.y - WALL_THICKNESS,
      width: b.width + WALL_THICKNESS * 2,
      height: WALL_THICKNESS,
    },
    // bottom
    {
      x: b.x - WALL_THICKNESS,
      y: b.y + b.height,
      width: b.width + WALL_THICKNESS * 2,
      height: WALL_THICKNESS,
    },
    // left
    { x: b.x - WALL_THICKNESS, y: b.y, width: WALL_THICKNESS, height: b.height },
    // right
    { x: b.x + b.width, y: b.y, width: WALL_THICKNESS, height: b.height },
  ];
}

const c = en.app.layoutObjects;

interface Props {
  objects: LayoutObject[];
  selectedObjectId: number | null;
  onSelectObject: (id: number | null) => void;
  canManageLayout?: boolean;
  onObjectDragEnd?: (
    objectId: number,
    newX: number,
    newY: number
  ) => { x: number; y: number } | undefined | void;
  onObjectTransformEnd?: (
    objectId: number,
    newX: number,
    newY: number,
    newWidth: number,
    newHeight: number,
    newRotation: number
  ) => void;
  savingObjectIds?: ReadonlySet<number>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  showGrid?: boolean;
  gridSize?: number;
  /** IDs of layout objects that have an active linked Desk resource. */
  bookableObjectIds?: ReadonlySet<number>;
  /** When true, objects render with isometric assets instead of simple boxes. */
  enhanced?: boolean;

  // ── Editable floor boundary ────────────────────────────────────────────────
  /** The room rectangle. Defaults to the fixed boundary when not provided. */
  boundary?: FloorBoundary;
  /**
   * Called when the user resizes the room via the drag handles (managers only,
   * editor mode). Receives the new inner width/height and the shift to apply to
   * furniture so the room can re-anchor to the fixed inset (non-zero only when a
   * top/left/corner handle moved the origin). Clamping/persistence is the caller's.
   */
  onBoundaryResize?: (width: number, height: number, shiftX: number, shiftY: number) => void;

  // ── Booking mode ─────────────────────────────────────────────────────────
  /** When "booking", editing is disabled and availability overlays are shown. */
  mode?: "editor" | "booking";
  /** Map from layoutObject.id → DeskAvailabilityStatus for canvas colouring. */
  availabilityByLayoutObjectId?: ReadonlyMap<number, DeskAvailabilityStatus>;
  /** The layout object id of the currently selected desk in booking mode. */
  selectedAvailabilityLayoutObjectId?: number | null;
  /** Called when the user clicks a desk object in booking mode. */
  onAvailabilityObjectSelect?: (layoutObjectId: number) => void;

  // ── Wall placement (door/window) ─────────────────────────────────────────
  /**
   * The object type currently selected for creation. When it is a wall-mounted
   * type (door/window) and the user can manage the layout, the canvas enters
   * hover-to-place mode over the walls.
   */
  pendingPlacementType?: LayoutObjectType | "" | null;
  /** Called when the user clicks a wall to place a door/window. */
  onPlaceObject?: (
    type: LayoutObjectType,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number
  ) => void;
}

export function FloorMapCanvas({
  objects,
  selectedObjectId,
  onSelectObject,
  canManageLayout = false,
  onObjectDragEnd,
  onObjectTransformEnd,
  savingObjectIds,
  onKeyDown,
  showGrid = true,
  gridSize = DEFAULT_GRID_SIZE,
  bookableObjectIds,
  enhanced = false,
  boundary = DEFAULT_FLOOR_BOUNDARY,
  onBoundaryResize,
  mode = "editor",
  availabilityByLayoutObjectId,
  selectedAvailabilityLayoutObjectId,
  onAvailabilityObjectSelect,
  pendingPlacementType,
  onPlaceObject,
}: Props) {
  const isBookingMode = mode === "booking";
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<number, Konva.Group>>(new Map());

  // ── Editable boundary geometry (derived from the boundary prop) ───────────
  const B = boundary;
  // Cutouts carve the office shape in the "real office" views — the enhanced
  // editor view and the booking map — by removing the cut area from the white
  // floor and rerouting the walls around it. In the plain editor the boundary
  // stays rectangular and cutouts show as editable X boxes.
  const carveShape = enhanced || isBookingMode;
  const cutoutRects = useMemo(() => getCutoutRects(objects), [objects]);
  const carvedCutouts = useMemo(
    () => (carveShape ? computeFloorCarveRects(B, cutoutRects) : []),
    [carveShape, B, cutoutRects]
  );
  const wallSegments = useMemo(
    () =>
      carvedCutouts.length > 0
        ? computeFloorWallSegments(B, cutoutRects, WALL_THICKNESS)
        : buildWallSegments(B),
    [B, carvedCutouts, cutoutRects]
  );
  // Snap walls for aligning doors/windows to their host wall on render (so every
  // opening is flush and the same thickness as its wall). Carve-aware in the
  // enhanced/booking views so openings on cutout walls line up too.
  const snapWalls = useMemo(
    () => getSnapWalls(objects, B, carveShape ? cutoutRects : []),
    [objects, B, carveShape, cutoutRects]
  );
  // Thin walls drawn around rooms/zones in the enhanced/booking view (visual only
  // — gone on revert). Each room edge is a wall segment; edges on a boundary wall
  // are skipped, and colinear edges from adjacent rooms are MERGED so two rooms
  // beside each other share a single wall (no doubling at the shared border).
  const roomFrames = useMemo(() => {
    if (!carveShape) return [];
    const t = ROOM_WALL_THICKNESS;
    const tol = WALL_THICKNESS / 2 + 4; // "on the boundary wall" tolerance
    const bL = B.x;
    const bR = B.x + B.width;
    const bT = B.y;
    const bB = B.y + B.height;
    // Raw edges as centre-line segments: v = vertical (line is x), h = horizontal.
    const raw: Array<{ o: "v" | "h"; line: number; lo: number; hi: number }> = [];

    for (const obj of objects) {
      if (getLayoutObjectRenderConfig(obj.object_type).category !== "Rooms & Zones") continue;
      const w = parseFloat(obj.width);
      const h = parseFloat(obj.height);
      const x = parseFloat(obj.x);
      const y = parseFloat(obj.y);
      const rot = parseFloat(obj.rotation) || 0;
      if (![w, h, x, y].every(Number.isFinite)) continue;
      // Rotated rooms are rare — skip the per-edge cleanup (would need OBB math).
      if (rot !== 0) continue;

      if (Math.abs(y - bT) > tol) raw.push({ o: "h", line: y, lo: x, hi: x + w });
      if (Math.abs(y + h - bB) > tol) raw.push({ o: "h", line: y + h, lo: x, hi: x + w });
      if (Math.abs(x - bL) > tol) raw.push({ o: "v", line: x, lo: y, hi: y + h });
      if (Math.abs(x + w - bR) > tol) raw.push({ o: "v", line: x + w, lo: y, hi: y + h });
    }

    // Merge segments on the same line (rounded) with overlapping/touching spans —
    // this collapses the two walls at a shared border between adjacent rooms.
    const groups = new Map<string, Array<{ lo: number; hi: number }>>();
    for (const s of raw) {
      const key = `${s.o}:${Math.round(s.line)}`;
      const arr = groups.get(key) ?? [];
      arr.push({ lo: s.lo, hi: s.hi });
      groups.set(key, arr);
    }
    const segs: Array<{ key: string; x: number; y: number; width: number; height: number }> = [];
    let i = 0;
    for (const [key, arr] of groups) {
      const [o, lineStr] = key.split(":");
      const line = Number(lineStr);
      arr.sort((a, b) => a.lo - b.lo);
      let cur = { ...arr[0] };
      const flush = () => {
        if (o === "v") {
          segs.push({
            key: `r${i++}`,
            x: line - t / 2,
            y: cur.lo,
            width: t,
            height: cur.hi - cur.lo,
          });
        } else {
          segs.push({
            key: `r${i++}`,
            x: cur.lo,
            y: line - t / 2,
            width: cur.hi - cur.lo,
            height: t,
          });
        }
      };
      for (let k = 1; k < arr.length; k++) {
        if (arr[k].lo <= cur.hi + 0.5) cur.hi = Math.max(cur.hi, arr[k].hi);
        else {
          flush();
          cur = { ...arr[k] };
        }
      }
      flush();
    }
    return segs;
  }, [carveShape, objects, B]);
  // Stage grows with the room so the walls always stay inside the board: the
  // inset margin is preserved on every side. Default boundary → 1000 × 640.
  const stageWidth = B.width + FLOOR_BOUNDARY_INSET * 2;
  const stageHeight = B.height + FLOOR_BOUNDARY_INSET * 2;

  // Room-resize handles appear when the user selects the room by clicking a wall
  // (mirrors object selection). Attached to an invisible Rect matching the room;
  // the Transformer draws the handles.
  const roomResizeRef = useRef<Konva.Rect>(null);
  const boundaryTransformerRef = useRef<Konva.Transformer>(null);
  const [boundarySelected, setBoundarySelected] = useState(false);
  const canSelectBoundary = canManageLayout && !isBookingMode && !!onBoundaryResize;
  const canResizeBoundary = canSelectBoundary && boundarySelected;

  // Selecting an object deselects the room (only one thing is "active" at a time).
  useEffect(() => {
    if (selectedObjectId !== null) setBoundarySelected(false);
  }, [selectedObjectId]);

  // ── Door/window wall-placement mode ───────────────────────────────────────
  const placementType =
    pendingPlacementType && isWallMountedType(pendingPlacementType) ? pendingPlacementType : null;
  const isPlacing = !!placementType && canManageLayout && !isBookingMode;
  const [ghost, setGhost] = useState<WallPlacement | null>(null);

  // Live alignment guides shown while dragging a normal object (PR 061).
  const [dragGuides, setDragGuides] = useState<SnapGuide[]>([]);

  // Snap the dragged node to nearby objects live and surface the guide lines.
  function handleObjectDragMove(obj: LayoutObject, node: Konva.Node) {
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    // Node position is the object's centre (group origin); convert to top-left.
    const { x, y, guides } = computeNeighborSnap(
      node.x() - w / 2,
      node.y() - h / 2,
      w,
      h,
      objects,
      obj.id
    );
    node.position({ x: x + w / 2, y: y + h / 2 });
    setDragGuides(guides);
  }

  // Drag-end for normal objects: clear guides, persist via the hook, then settle
  // the Konva node on the hook's final position. The imperative reposition is
  // required because react-konva does not reliably reconcile a node back to a
  // controlled position after a drag — this is what makes push-aside and the
  // revert-on-multi-overlap actually move the node on screen.
  function handleObjectDragEndChecked(id: number, x: number, y: number) {
    setDragGuides([]);
    const final = onObjectDragEnd?.(id, x, y);
    if (!final) return;
    const obj = objects.find((o) => o.id === id);
    const node = nodeRefs.current.get(id);
    if (obj && node) {
      const w = parseFloat(obj.width);
      const h = parseFloat(obj.height);
      node.position({ x: final.x + w / 2, y: final.y + h / 2 });
      node.getLayer()?.batchDraw();
    }
  }

  const mount = placementType ? getMountDimensions(placementType) : null;
  const placementConfig = placementType ? getLayoutObjectRenderConfig(placementType) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function computeGhost(e: any): WallPlacement | null {
    if (!isPlacing || !mount) return null;
    const stage = e.target.getStage();
    // Pointer in world coords (inverse of the viewport transform) — keeps
    // placement correct under any pan/zoom.
    const pointer = stage?.getRelativePointerPosition?.();
    if (!pointer) return null;
    const walls = getSnapWalls(objects, B, carveShape ? cutoutRects : []);
    const placement = snapToWall(pointer.x, pointer.y, walls, mount.length);
    if (!placement) return null;
    // Disallow placing on top of an existing door/window on the same wall.
    const host = nearestWall(walls, placement.centerX, placement.centerY);
    if (host) {
      const along = projectAlong(host, placement.centerX, placement.centerY);
      if (!isAlongFree(along, mount.length / 2, openingsOnWall(host, objects, -1))) return null;
    }
    return placement;
  }

  // Build a Konva dragBoundFunc for a placed door/window so it only slides along
  // its host wall (and never over another opening). Returns undefined when the
  // object is not on a wall. Captures the object's pre-drag state; obj.x/y do not
  // change until dragend, so the closure stays valid for the whole drag.
  function wallDragBoundFor(obj: LayoutObject) {
    const walls = getSnapWalls(objects, B, carveShape ? cutoutRects : []);
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    const cx = parseFloat(obj.x) + w / 2;
    const cy = parseFloat(obj.y) + h / 2;
    const host = nearestWall(walls, cx, cy);
    if (!host) return undefined;
    const halfLen = w / 2;
    const wallHalfLen = host.length / 2;
    const anchor = projectAlong(host, cx, cy);
    const intervals = openingsOnWall(host, objects, obj.id);
    // Regular function: Konva calls it with `this` bound to the dragged node.
    return function (this: Konva.Node, pos: { x: number; y: number }) {
      const stage = this?.getStage?.();
      const scale = stage ? stage.scaleX() : 1;
      const ox = stage ? stage.x() : 0;
      const oy = stage ? stage.y() : 0;
      const wx = (pos.x - ox) / scale;
      const wy = (pos.y - oy) / scale;
      const along = clampAlongWithinGap(
        projectAlong(host, wx, wy),
        halfLen,
        wallHalfLen,
        intervals,
        anchor
      );
      const p = pointOnWall(host, along);
      return { x: p.x * scale + ox, y: p.y * scale + oy };
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handlePlacementMove(e: any) {
    const next = computeGhost(e);
    setGhost(next);
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = next ? "copy" : "not-allowed";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handlePlacementLeave(e: any) {
    setGhost(null);
    const stage = e.target?.getStage?.();
    if (stage) stage.container().style.cursor = "default";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handlePlacementClick(e: any) {
    if (!placementType || !mount || !onPlaceObject) return;
    const placement = computeGhost(e) ?? ghost;
    if (!placement) return;
    // The opening matches the host wall's thickness so it sits flush over it.
    onPlaceObject(
      placementType,
      placement.centerX - mount.length / 2,
      placement.centerY - placement.thickness / 2,
      mount.length,
      placement.thickness,
      placement.angleDeg
    );
  }

  // Local pan/zoom camera (PR 061) — never persisted; object world coordinates
  // are untouched. Applied to the Stage so background, boundary, grid, objects,
  // and transformer all pan/zoom together.
  const { viewport, setViewport, zoomIn, zoomOut, reset, zoomAt } = useCanvasViewport();

  // Doors/windows are part of their wall: they may resize their LENGTH along the
  // wall (only the left/right handles, no rotation), but not their thickness or
  // angle — the wall drives those.
  const selectedObject =
    selectedObjectId !== null ? (objects.find((o) => o.id === selectedObjectId) ?? null) : null;
  const selectedIsWallMounted = !!selectedObject && isWallMountedType(selectedObject.object_type);

  // Attach/detach Transformer whenever selection or edit capability changes.
  // Booking mode never attaches the transformer (it is not rendered at all).
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedObjectId !== null ? nodeRefs.current.get(selectedObjectId) : null;
    const attach = !!node && canManageLayout && !isBookingMode;
    tr.nodes(attach ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedObjectId, canManageLayout, isBookingMode, selectedIsWallMounted]);

  // Attach the room-resize Transformer to the invisible room target when active.
  useEffect(() => {
    const tr = boundaryTransformerRef.current;
    if (!tr) return;
    const node = canResizeBoundary ? roomResizeRef.current : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [canResizeBoundary, B.width, B.height]);

  // Commit a room resize. The Transformer may move the top-left (when the user
  // drags a top/left/corner handle), so we read the full moved box, keep the edge
  // that stayed put as the anchor, and report both the new size and how far the
  // origin moved. The parent re-anchors the room to the fixed inset and shifts the
  // furniture by that delta, so the room visually grows from the dragged edge.
  function handleBoundaryTransformEnd() {
    const node = roomResizeRef.current;
    if (!node || !onBoundaryResize) return;
    const rawX = node.x();
    const rawY = node.y();
    const rawW = B.width * node.scaleX();
    const rawH = B.height * node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    node.position({ x: B.x, y: B.y });

    const { width, height } = clampBoundarySize(rawW, rawH);
    // Which edge stayed fixed? (corner drags move two edges; the opposite corner
    // is the anchor.) Re-anchor to the fixed edge so clamping keeps it in place.
    const rightStayed = Math.abs(rawX + rawW - (B.x + B.width)) < 1;
    const bottomStayed = Math.abs(rawY + rawH - (B.y + B.height)) < 1;
    const newX = rightStayed ? B.x + B.width - width : B.x;
    const newY = bottomStayed ? B.y + B.height - height : B.y;
    // Shift applied to furniture so the room can re-anchor at the inset.
    onBoundaryResize(width, height, B.x - newX, B.y - newY);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStageClick(e: any) {
    if (e.target === e.target.getStage()) {
      onSelectObject(null);
      setBoundarySelected(false);
    }
  }

  // Clicking a boundary wall selects the room (shows the resize handles), the same
  // way clicking an object selects it. Clears any object selection.
  function handleBoundaryClick() {
    if (!canSelectBoundary) return;
    onSelectObject(null);
    setBoundarySelected(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setWallCursor(e: any, cursor: string) {
    if (!canSelectBoundary) return;
    const stage = e.target?.getStage?.();
    if (stage) stage.container().style.cursor = cursor;
  }

  // Wheel / trackpad zoom, anchored to the cursor (PR 061).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleWheel(e: any) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    zoomAt(wheelZoomFactor(e.evt.deltaY), pointer.x, pointer.y);
  }

  // Empty-canvas pan. The Stage is draggable; dragging an object or a transformer
  // anchor drags THAT node instead (Konva drags the top-most draggable target),
  // and those dragend events bubble here — so we sync the viewport only when the
  // Stage itself was the dragged node.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStageDragEnd(e: any) {
    const stage = e.target.getStage();
    if (e.target !== stage) return;
    setViewport({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
  }

  // Memoize grid lines so they only rebuild when showGrid or gridSize changes
  const gridLines = useMemo(() => {
    // Enhanced view is a clean presentation — no grid.
    if (!showGrid || enhanced) return [];
    const lines = [];
    for (let x = gridSize; x < stageWidth; x += gridSize) {
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, 0, x, stageHeight]}
          stroke={GRID_COLOR}
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    for (let y = gridSize; y < stageHeight; y += gridSize) {
      lines.push(
        <Line
          key={`h${y}`}
          points={[0, y, stageWidth, y]}
          stroke={GRID_COLOR}
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    return lines;
  }, [showGrid, enhanced, gridSize, stageWidth, stageHeight]);

  return (
    <Box
      role="region"
      aria-label={isBookingMode ? "Floor booking map" : c.canvasAriaLabel}
      tabIndex={0}
      onKeyDown={isBookingMode ? undefined : onKeyDown}
      sx={{
        position: "relative",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        lineHeight: 0,
        bgcolor: CANVAS_BG,
        outline: "none",
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      {/* Inner scroll container so the absolutely-positioned zoom controls stay
          anchored to the visible canvas frame, not the scrolled stage. */}
      <Box sx={{ overflow: "auto", borderRadius: 1 }}>
        <Stage
          width={stageWidth}
          height={stageHeight}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          x={viewport.x}
          y={viewport.y}
          draggable
          onClick={handleStageClick}
          onTap={handleStageClick}
          onWheel={handleWheel}
          onDragEnd={handleStageDragEnd}
          data-testid="floor-map-stage"
        >
          <Layer listening={false}>
            {/* Grey margin outside the room */}
            <Rect width={stageWidth} height={stageHeight} fill={CANVAS_BG} />
            {/* White interior of the office */}
            <Rect x={B.x} y={B.y} width={B.width} height={B.height} fill={ROOM_FILL} />
            {/* Enhanced view: carve cutouts out of the floor by painting them back
                to the outside colour, so the office reads as a non-rectangular shape. */}
            {carvedCutouts.map((r, i) => (
              <Rect
                key={`cutout-${i}`}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={CANVAS_BG}
              />
            ))}
            {gridLines}
          </Layer>
          {/* Office walls — solid grey segments framing the interior, styled to
              match the "wall" layout object. In their own listening layer so a
              click selects the room (showing the resize handles). */}
          <Layer listening={canSelectBoundary}>
            {wallSegments.map((w, i) => (
              <Rect
                key={`wall-${i}`}
                x={w.x}
                y={w.y}
                width={w.width}
                height={w.height}
                fill={WALL_FILL}
                stroke={WALL_STROKE}
                strokeWidth={WALL_STROKE_WIDTH}
                shadowColor="#000000"
                shadowOpacity={0.12}
                shadowBlur={6}
                onClick={handleBoundaryClick}
                onTap={handleBoundaryClick}
                onMouseEnter={(e) => setWallCursor(e, "pointer")}
                onMouseLeave={(e) => setWallCursor(e, "default")}
                data-testid="boundary-wall"
              />
            ))}
          </Layer>
          <Layer>
            {objects.map((obj) => {
              // Where the floor is carved (enhanced / booking), a cutout is shown
              // by the carved shape + rerouted walls, so its X box is not drawn.
              if (carveShape && obj.object_type === "cutout") return null;
              // Render doors/windows flush on their wall at the wall's thickness,
              // so existing openings match the (now thicker) walls too.
              const displayObj = alignOpeningToWall(obj, snapWalls);
              const availabilityStatus = availabilityByLayoutObjectId?.get(obj.id);
              const isAvailabilitySelected = selectedAvailabilityLayoutObjectId === obj.id;
              return (
                <LayoutObjectCanvasNode
                  key={obj.id}
                  ref={(node) => {
                    if (node) nodeRefs.current.set(obj.id, node);
                    else nodeRefs.current.delete(obj.id);
                  }}
                  obj={displayObj}
                  isSelected={!isBookingMode && obj.id === selectedObjectId}
                  onSelect={() => onSelectObject(obj.id)}
                  draggable={canManageLayout && !isBookingMode}
                  dragBoundFunc={
                    canManageLayout && !isBookingMode && isWallMountedType(obj.object_type)
                      ? wallDragBoundFor(displayObj)
                      : undefined
                  }
                  onDragMove={
                    canManageLayout && !isBookingMode && !isWallMountedType(obj.object_type)
                      ? (e) => handleObjectDragMove(obj, e.target)
                      : undefined
                  }
                  onDragEnd={isBookingMode ? undefined : handleObjectDragEndChecked}
                  onTransformEnd={isBookingMode ? undefined : onObjectTransformEnd}
                  isSaving={savingObjectIds?.has(obj.id)}
                  hasDesk={bookableObjectIds?.has(obj.id)}
                  isBookingMode={isBookingMode}
                  enhanced={enhanced}
                  availabilityStatus={availabilityStatus}
                  isAvailabilitySelected={isAvailabilitySelected}
                  onAvailabilitySelect={
                    isBookingMode && availabilityStatus !== undefined && onAvailabilityObjectSelect
                      ? () => onAvailabilityObjectSelect(obj.id)
                      : undefined
                  }
                />
              );
            })}
            {/* Transformer visible only for owners/admins in editor mode */}
            {canManageLayout && !isBookingMode && (
              <Transformer
                ref={transformerRef}
                rotateEnabled={!selectedIsWallMounted}
                rotationSnaps={ROTATION_SNAPS}
                rotationSnapTolerance={5}
                enabledAnchors={selectedIsWallMounted ? ["middle-left", "middle-right"] : undefined}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < MIN_OBJECT_SIZE || newBox.height < MIN_OBJECT_SIZE) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            )}
          </Layer>

          {/* Thin walls around rooms/zones — enhanced/booking view only, so they
              frame each room as an enclosed space. Gone on revert. */}
          {roomFrames.length > 0 && (
            <Layer listening={false}>
              {roomFrames.map((s) => (
                <Rect
                  key={`room-wall-${s.key}`}
                  x={s.x}
                  y={s.y}
                  width={s.width}
                  height={s.height}
                  fill={ROOM_WALL_COLOR}
                  data-testid="room-wall"
                />
              ))}
            </Layer>
          )}

          {/* Room-resize handles: an invisible Rect tracks the room and the
              Transformer draws drag handles on its right/bottom/corner. Top-left
              is pinned (no left/top anchors) so the room grows down/right from
              the fixed inset. Shown only when nothing else is selected. */}
          {canResizeBoundary && (
            <Layer>
              <Rect
                ref={roomResizeRef}
                x={B.x}
                y={B.y}
                width={B.width}
                height={B.height}
                listening={false}
                data-testid="boundary-resize-target"
              />
              <Transformer
                ref={boundaryTransformerRef}
                rotateEnabled={false}
                keepRatio={false}
                anchorStroke={BOUNDARY_HANDLE_COLOR}
                anchorFill="#FFFFFF"
                borderStroke={BOUNDARY_HANDLE_COLOR}
                borderDash={[6, 4]}
                onTransformEnd={handleBoundaryTransformEnd}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < MIN_FLOOR_BOUNDARY || newBox.height < MIN_FLOOR_BOUNDARY
                    ? oldBox
                    : newBox
                }
              />
            </Layer>
          )}

          {/* Live alignment guides while dragging a normal object (PR 061). */}
          {dragGuides.length > 0 && (
            <Layer listening={false}>
              {dragGuides.map((g, i) => (
                <Line
                  key={`guide-${i}`}
                  points={
                    g.axis === "x"
                      ? [g.position, g.from, g.position, g.to]
                      : [g.from, g.position, g.to, g.position]
                  }
                  stroke={GUIDE_COLOR}
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              ))}
            </Layer>
          )}

          {/* Door/window wall-placement overlay (PR 061): a transparent capture
              rect on top intercepts hover/click so placement is not stolen by
              object selection, plus a ghost preview snapped to the nearest wall.
              Only mounted while actively placing a wall-mounted type. */}
          {isPlacing && mount && placementConfig && (
            <Layer>
              <Rect
                x={-1e5}
                y={-1e5}
                width={2e5}
                height={2e5}
                fill="transparent"
                onMouseMove={handlePlacementMove}
                onMouseDown={handlePlacementMove}
                onMouseLeave={handlePlacementLeave}
                onClick={handlePlacementClick}
                onTap={handlePlacementClick}
                data-testid="wall-placement-capture"
              />
              {ghost && (
                <Rect
                  x={ghost.centerX}
                  y={ghost.centerY}
                  offsetX={mount.length / 2}
                  offsetY={ghost.thickness / 2}
                  width={mount.length}
                  height={ghost.thickness}
                  rotation={ghost.angleDeg}
                  fill={placementConfig.fill}
                  stroke={placementConfig.stroke}
                  strokeWidth={2}
                  dash={[4, 3]}
                  opacity={0.6}
                  listening={false}
                />
              )}
            </Layer>
          )}
        </Stage>
      </Box>

      <CanvasZoomControls
        scale={viewport.scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={reset}
      />

      {objects.length === 0 && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            pointerEvents: "none",
          }}
        >
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
            {canManageLayout ? c.canvasEmptyTitle : c.emptyStateMemberTitle}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {canManageLayout ? c.canvasEmptySubtitle : c.emptyStateMemberSubtitle}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
