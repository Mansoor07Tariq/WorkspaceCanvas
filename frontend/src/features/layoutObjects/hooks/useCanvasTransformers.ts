import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { clampBoundarySize, type FloorBoundary } from "../utils/coordinateHelpers";

interface Params {
  canManageLayout: boolean;
  isBookingMode: boolean;
  boundary: FloorBoundary;
  selectedObjectId: number | null;
  selectedIsWallMounted: boolean;
  onSelectObject: (id: number | null) => void;
  onBoundaryResize?: (width: number, height: number, shiftX: number, shiftY: number) => void;
  nodeRefs: React.MutableRefObject<Map<number, Konva.Group>>;
}

/**
 * Transformer wiring for the object transformer AND the room-resize (boundary)
 * transformer, extracted from FloorMapCanvas (PR 067). Owns the refs, the
 * attach/detach effects, room-resize selection/cursor, and the resize-commit that
 * reports the new size + origin shift. Behaviour unchanged. The FE-6 min-size
 * gates live in `utils/transformerBounds.makeMinSizeBoundBox`.
 */
export function useCanvasTransformers({
  canManageLayout,
  isBookingMode,
  boundary: B,
  selectedObjectId,
  selectedIsWallMounted,
  onSelectObject,
  onBoundaryResize,
  nodeRefs,
}: Params) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const roomResizeRef = useRef<Konva.Rect>(null);
  const boundaryTransformerRef = useRef<Konva.Transformer>(null);
  const [boundarySelected, setBoundarySelected] = useState(false);

  const canSelectBoundary = canManageLayout && !isBookingMode && !!onBoundaryResize;
  const canResizeBoundary = canSelectBoundary && boundarySelected;

  // Selecting an object deselects the room (only one thing is "active" at a time).
  // This is a load-bearing sync effect (it permanently clears the flag on select,
  // so it cannot be derived); moved verbatim from FloorMapCanvas, where the rule
  // did not fire. PR 067 preserves the behaviour, hence the targeted suppression.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedObjectId !== null) setBoundarySelected(false);
  }, [selectedObjectId]);

  // Attach/detach Transformer whenever selection or edit capability changes.
  // Booking mode never attaches the transformer (it is not rendered at all).
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedObjectId !== null ? nodeRefs.current.get(selectedObjectId) : null;
    const attach = !!node && canManageLayout && !isBookingMode;
    tr.nodes(attach ? [node] : []);
    tr.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Clicking empty stage clears both object and room selection.
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

  return {
    transformerRef,
    roomResizeRef,
    boundaryTransformerRef,
    boundarySelected,
    setBoundarySelected,
    canSelectBoundary,
    canResizeBoundary,
    handleBoundaryTransformEnd,
    handleStageClick,
    handleBoundaryClick,
    setWallCursor,
  };
}
