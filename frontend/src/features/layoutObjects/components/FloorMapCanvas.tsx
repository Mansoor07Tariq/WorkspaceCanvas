import { useMemo, useRef } from "react";
import { Stage } from "react-konva";
import { Box } from "@mui/material";
import type Konva from "konva";
import { en } from "@/i18n/en";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_GRID_SIZE,
  DEFAULT_FLOOR_BOUNDARY,
  FLOOR_BOUNDARY_INSET,
} from "../utils/coordinateHelpers";
import { getSnapWalls, isWallMountedType } from "../utils/wallPlacement";
import {
  getCutoutRects,
  computeFloorCarveRects,
  computeFloorWallSegments,
} from "../utils/floorShape";
import { computeRoomFrames } from "../utils/roomFrames";
import { CanvasZoomControls } from "./CanvasZoomControls";
import { buildWallSegments, WALL_THICKNESS, ROOM_WALL_THICKNESS } from "./canvas/canvasStyle";
import { FloorBackgroundLayer } from "./canvas/FloorBackgroundLayer";
import { BoundaryWallsLayer } from "./canvas/BoundaryWallsLayer";
import { FloorObjectsLayer } from "./canvas/FloorObjectsLayer";
import { RoomFramesLayer } from "./canvas/RoomFramesLayer";
import { BoundaryResizeLayer } from "./canvas/BoundaryResizeLayer";
import { DragGuidesLayer, type DragGuidesHandle } from "./canvas/DragGuidesLayer";
import { WallPlacementLayer } from "./canvas/WallPlacementLayer";
import { NotesTooltip } from "./canvas/NotesTooltip";
import { CanvasEmptyState } from "./canvas/CanvasEmptyState";
import { useCanvasStageControls } from "../hooks/useCanvasStageControls";
import { useCanvasTransformers } from "../hooks/useCanvasTransformers";
import { useDragGuides } from "../hooks/useDragGuides";
import { useWallPlacement } from "../hooks/useWallPlacement";
import { useNotesTooltip } from "../hooks/useNotesTooltip";
import type { FloorMapCanvasProps } from "./FloorMapCanvas.types";

export { CANVAS_WIDTH, CANVAS_HEIGHT };

const c = en.app.layoutObjects;

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
}: FloorMapCanvasProps) {
  const isBookingMode = mode === "booking";
  const nodeRefs = useRef<Map<number, Konva.Group>>(new Map());

  // ── Derived floor geometry (from the boundary prop) ───────────────────────
  const B = boundary;
  // Cutouts carve the office shape in the "real office" views — the enhanced
  // editor view and the booking map. In the plain editor the boundary stays
  // rectangular and cutouts show as editable X boxes.
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
  const roomFrames = useMemo(
    () => (carveShape ? computeRoomFrames(objects, B, WALL_THICKNESS, ROOM_WALL_THICKNESS) : []),
    [carveShape, objects, B]
  );
  // Stage grows with the room so the walls always stay inside the board: the
  // inset margin is preserved on every side. Default boundary → 1000 × 640.
  const stageWidth = B.width + FLOOR_BOUNDARY_INSET * 2;
  const stageHeight = B.height + FLOOR_BOUNDARY_INSET * 2;

  const notesTooltipEnabled = enhanced || isBookingMode;

  // Doors/windows are part of their wall: they may resize their LENGTH along the
  // wall (only the left/right handles, no rotation), but not their thickness or
  // angle — the wall drives those.
  const selectedObject =
    selectedObjectId !== null ? (objects.find((o) => o.id === selectedObjectId) ?? null) : null;
  const selectedIsWallMounted = !!selectedObject && isWallMountedType(selectedObject.object_type);

  // Local pan/zoom camera (PR 061) — never persisted; object world coordinates
  // are untouched. Applied to the Stage so background, boundary, grid, objects,
  // and transformer all pan/zoom together.
  const { viewport, zoomIn, zoomOut, reset, handleWheel, handleStageDragEnd } =
    useCanvasStageControls();

  // Transformer wiring (object + boundary) and room-resize selection/commit.
  const {
    transformerRef,
    roomResizeRef,
    boundaryTransformerRef,
    canSelectBoundary,
    canResizeBoundary,
    handleBoundaryTransformEnd,
    handleStageClick,
    handleBoundaryClick,
    setWallCursor,
  } = useCanvasTransformers({
    canManageLayout,
    isBookingMode,
    boundary: B,
    selectedObjectId,
    selectedIsWallMounted,
    onSelectObject,
    onBoundaryResize,
    nodeRefs,
  });

  // Live alignment guides while dragging a normal object — drawn imperatively
  // (PR 068), so a drag never triggers a per-frame React re-render.
  const guidesRef = useRef<DragGuidesHandle>(null);
  const { handleObjectDragMove, handleObjectDragEndChecked } = useDragGuides({
    objects,
    nodeRefs,
    onObjectDragEnd,
    guidesRef,
  });

  // Door/window hover-to-place mode.
  const {
    isPlacing,
    mount,
    placementConfig,
    ghost,
    wallDragBoundFor,
    handlePlacementMove,
    handlePlacementLeave,
    handlePlacementClick,
  } = useWallPlacement({
    pendingPlacementType,
    canManageLayout,
    isBookingMode,
    objects,
    snapWalls,
    onPlaceObject,
  });

  // Notes tooltip on hover (enhanced/booking views).
  const { setHoveredObjectId, notesTooltip } = useNotesTooltip({
    enabled: notesTooltipEnabled,
    objects,
    viewport,
  });

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
        bgcolor: "#F3F4F6",
        outline: "none",
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      {/* Inner scroll container so the absolutely-positioned zoom controls stay
          anchored to the visible canvas frame, not the scrolled stage. Position
          relative so the HTML notes tooltip scrolls/zooms with the stage. */}
      <Box sx={{ position: "relative", overflow: "auto", borderRadius: 1 }}>
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
          <FloorBackgroundLayer
            stageWidth={stageWidth}
            stageHeight={stageHeight}
            boundary={B}
            carvedCutouts={carvedCutouts}
            showGrid={showGrid}
            enhanced={enhanced}
            gridSize={gridSize}
          />
          <BoundaryWallsLayer
            wallSegments={wallSegments}
            canSelectBoundary={canSelectBoundary}
            onBoundaryClick={handleBoundaryClick}
            setWallCursor={setWallCursor}
          />
          <FloorObjectsLayer
            objects={objects}
            carveShape={carveShape}
            snapWalls={snapWalls}
            selectedObjectId={selectedObjectId}
            isBookingMode={isBookingMode}
            canManageLayout={canManageLayout}
            enhanced={enhanced}
            savingObjectIds={savingObjectIds}
            bookableObjectIds={bookableObjectIds}
            availabilityByLayoutObjectId={availabilityByLayoutObjectId}
            selectedAvailabilityLayoutObjectId={selectedAvailabilityLayoutObjectId}
            notesTooltipEnabled={notesTooltipEnabled}
            selectedIsWallMounted={selectedIsWallMounted}
            scale={viewport.scale}
            nodeRefs={nodeRefs}
            transformerRef={transformerRef}
            onSelectObject={onSelectObject}
            onAvailabilityObjectSelect={onAvailabilityObjectSelect}
            setHoveredObjectId={setHoveredObjectId}
            wallDragBoundFor={wallDragBoundFor}
            handleObjectDragMove={handleObjectDragMove}
            handleObjectDragEndChecked={handleObjectDragEndChecked}
            onObjectTransformEnd={onObjectTransformEnd}
          />
          {roomFrames.length > 0 && <RoomFramesLayer roomFrames={roomFrames} />}
          {canResizeBoundary && (
            <BoundaryResizeLayer
              boundary={B}
              scale={viewport.scale}
              roomResizeRef={roomResizeRef}
              boundaryTransformerRef={boundaryTransformerRef}
              onTransformEnd={handleBoundaryTransformEnd}
            />
          )}
          <DragGuidesLayer ref={guidesRef} />
          {isPlacing && mount && placementConfig && (
            <WallPlacementLayer
              mount={mount}
              placementConfig={placementConfig}
              ghost={ghost}
              onMove={handlePlacementMove}
              onLeave={handlePlacementLeave}
              onClick={handlePlacementClick}
            />
          )}
        </Stage>
        {notesTooltip && <NotesTooltip tooltip={notesTooltip} />}
      </Box>

      <CanvasZoomControls
        scale={viewport.scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={reset}
      />

      {objects.length === 0 && <CanvasEmptyState canManageLayout={canManageLayout} />}
    </Box>
  );
}
