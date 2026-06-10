import { useRef, useEffect, useMemo } from "react";
import { Stage, Layer, Rect, Line, Transformer } from "react-konva";
import { Box, Typography } from "@mui/material";
import type Konva from "konva";
import { en } from "@/i18n/en";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_GRID_SIZE,
  MIN_OBJECT_SIZE,
} from "../utils/coordinateHelpers";
import { LayoutObjectCanvasNode } from "./LayoutObjectCanvasNode";
import type { LayoutObject } from "../types/layoutObject.types";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";

export { CANVAS_WIDTH, CANVAS_HEIGHT };

const GRID_COLOR = "#E5E7EB";
const CANVAS_BG = "#FAFAFA";
const BOUNDARY_COLOR = "#D1D5DB";

const c = en.app.layoutObjects;

interface Props {
  objects: LayoutObject[];
  selectedObjectId: number | null;
  onSelectObject: (id: number | null) => void;
  canManageLayout?: boolean;
  onObjectDragEnd?: (objectId: number, newX: number, newY: number) => void;
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

  // ── Booking mode ─────────────────────────────────────────────────────────
  /** When "booking", editing is disabled and availability overlays are shown. */
  mode?: "editor" | "booking";
  /** Map from layoutObject.id → DeskAvailabilityStatus for canvas colouring. */
  availabilityByLayoutObjectId?: ReadonlyMap<number, DeskAvailabilityStatus>;
  /** The layout object id of the currently selected desk in booking mode. */
  selectedAvailabilityLayoutObjectId?: number | null;
  /** Called when the user clicks a desk object in booking mode. */
  onAvailabilityObjectSelect?: (layoutObjectId: number) => void;
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
  mode = "editor",
  availabilityByLayoutObjectId,
  selectedAvailabilityLayoutObjectId,
  onAvailabilityObjectSelect,
}: Props) {
  const isBookingMode = mode === "booking";
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<number, Konva.Group>>(new Map());

  // Attach/detach Transformer whenever selection or edit capability changes.
  // Booking mode never attaches the transformer (it is not rendered at all).
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedObjectId !== null ? nodeRefs.current.get(selectedObjectId) : null;
    tr.nodes(node && canManageLayout && !isBookingMode ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedObjectId, canManageLayout, isBookingMode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStageClick(e: any) {
    if (e.target === e.target.getStage()) {
      onSelectObject(null);
    }
  }

  // Memoize grid lines so they only rebuild when showGrid or gridSize changes
  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const lines = [];
    for (let x = gridSize; x < CANVAS_WIDTH; x += gridSize) {
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, 0, x, CANVAS_HEIGHT]}
          stroke={GRID_COLOR}
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    for (let y = gridSize; y < CANVAS_HEIGHT; y += gridSize) {
      lines.push(
        <Line
          key={`h${y}`}
          points={[0, y, CANVAS_WIDTH, y]}
          stroke={GRID_COLOR}
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    return lines;
  }, [showGrid, gridSize]);

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
        overflow: "auto",
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
      <Stage
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleStageClick}
        onTap={handleStageClick}
        data-testid="floor-map-stage"
      >
        <Layer listening={false}>
          <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={CANVAS_BG} />
          {gridLines}
          <Rect
            x={2}
            y={2}
            width={CANVAS_WIDTH - 4}
            height={CANVAS_HEIGHT - 4}
            fill="transparent"
            stroke={BOUNDARY_COLOR}
            strokeWidth={1}
            dash={[4, 4]}
          />
        </Layer>
        <Layer>
          {objects.map((obj) => {
            const availabilityStatus = availabilityByLayoutObjectId?.get(obj.id);
            const isAvailabilitySelected = selectedAvailabilityLayoutObjectId === obj.id;
            return (
              <LayoutObjectCanvasNode
                key={obj.id}
                ref={(node) => {
                  if (node) nodeRefs.current.set(obj.id, node);
                  else nodeRefs.current.delete(obj.id);
                }}
                obj={obj}
                isSelected={!isBookingMode && obj.id === selectedObjectId}
                onSelect={() => onSelectObject(obj.id)}
                draggable={canManageLayout && !isBookingMode}
                onDragEnd={isBookingMode ? undefined : onObjectDragEnd}
                onTransformEnd={isBookingMode ? undefined : onObjectTransformEnd}
                isSaving={savingObjectIds?.has(obj.id)}
                hasDesk={bookableObjectIds?.has(obj.id)}
                isBookingMode={isBookingMode}
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
              rotateEnabled={true}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < MIN_OBJECT_SIZE || newBox.height < MIN_OBJECT_SIZE) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>

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
