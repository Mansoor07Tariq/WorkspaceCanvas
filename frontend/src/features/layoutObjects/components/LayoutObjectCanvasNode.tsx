import { forwardRef, useCallback } from "react";
import { Group, Circle, Line, Text } from "react-konva";
import type Konva from "konva";
import { getLayoutObjectRenderConfig } from "../utils/layoutObjectRenderConfig";
import { getLayoutObjectNodeStyle } from "../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderer } from "../renderers";
import { calculateTransformResult, getTopLeftFromCenterPosition } from "../utils/coordinateHelpers";
import type { LayoutObject } from "../types/layoutObject.types";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";

interface Props {
  obj: LayoutObject;
  isSelected: boolean;
  onSelect: () => void;
  draggable?: boolean;
  /** Konva drag-bound constraint (used to keep doors/windows sliding on a wall). */
  dragBoundFunc?: (this: Konva.Node, pos: { x: number; y: number }) => { x: number; y: number };
  /** Live drag handler (used to snap to neighbours and show alignment guides). */
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (objectId: number, newX: number, newY: number) => void;
  onTransformEnd?: (
    objectId: number,
    newX: number,
    newY: number,
    newWidth: number,
    newHeight: number,
    newRotation: number
  ) => void;
  isSaving?: boolean;
  /** True when an active Desk resource is linked to this layout object. */
  hasDesk?: boolean;
  /** Set in booking mode to apply availability colour overlay. */
  availabilityStatus?: DeskAvailabilityStatus;
  /** True when this object is the selected desk in booking mode. */
  isAvailabilitySelected?: boolean;
  /** Called when the user clicks this object in booking mode. */
  onAvailabilitySelect?: () => void;
  /** True when the canvas is in booking mode (read-only, availability overlay). */
  isBookingMode?: boolean;
  /** True when the Enhance toggle is on: render isometric assets instead of boxes. */
  enhanced?: boolean;
}

const LABEL_FONT_SIZE = 11;
const LABEL_PADDING = 3;
const LABEL_FILL = "#1F2937";

const DESK_DOT_RADIUS = 5;
const DESK_DOT_COLOR = "#16A34A"; // green-600

const CUTOUT_X_COLOR = "#DC2626"; // red-600 — marks a "carve this area" box

export const LayoutObjectCanvasNode = forwardRef<Konva.Group, Props>(
  function LayoutObjectCanvasNode(
    {
      obj,
      isSelected,
      onSelect,
      draggable = false,
      dragBoundFunc,
      onDragMove,
      onDragEnd,
      onTransformEnd,
      isSaving = false,
      hasDesk = false,
      availabilityStatus,
      isAvailabilitySelected = false,
      onAvailabilitySelect,
      isBookingMode = false,
      enhanced = false,
    },
    ref
  ) {
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    const x = parseFloat(obj.x);
    const y = parseFloat(obj.y);
    const rotation = parseFloat(obj.rotation);

    const config = getLayoutObjectRenderConfig(obj.object_type);
    const displayLabel = obj.label || config.shortCode;
    const isCutout = obj.object_type === "cutout";

    // In enhanced (isometric) mode the artwork carries its own meaning, so the
    // short-code labels (e.g. "DSK") become visual noise. Hide them for every
    // type except meeting rooms, which still need a textual marker.
    const showLabel = !enhanced || obj.object_type === "meeting_room";

    // The inner visual is delegated to a per-type renderer (renderer registry).
    // Default is a simple shape; with the Enhance toggle on, types that have a
    // pre-built isometric asset swap to it (others stay on the default shape).
    const Renderer = getLayoutObjectRenderer(obj.object_type, enhanced);

    // Style decision is delegated to a pure, unit-tested selector (TD-032):
    // availability palette in booking mode, render config + selection in editor.
    const shapeProps = getLayoutObjectNodeStyle({
      objectType: obj.object_type,
      isSelected,
      isSaving,
      availabilityStatus,
      isAvailabilitySelected,
    });

    // Enhance mode intentionally keeps object outlines visible for now: the
    // stroke/dash doubles as a placement aid while the boundary/cutout work is
    // still being tuned. Hiding outlines in Enhance (drop stroke/dash when
    // `enhanced && !isSelected`) is deferred to the dedicated Enhance-visuals PR.
    const renderStyle = shapeProps;

    // Group origin at center of bounding box — correct for rotation and drag
    const cx = x + w / 2;
    const cy = y + h / 2;

    const handleDragEnd = useCallback(
      // Konva events are not typed cleanly for import — suppressed per team convention
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => {
        if (!onDragEnd) return;
        const { x: topLeftX, y: topLeftY } = getTopLeftFromCenterPosition(
          e.target.x(),
          e.target.y(),
          w,
          h
        );
        onDragEnd(obj.id, topLeftX, topLeftY);
      },
      [obj.id, w, h, onDragEnd]
    );

    // Konva Transformer fires 'transformend' on the transformed node too.
    const handleTransformEnd = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => {
        if (!onTransformEnd) return;
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        // CRITICAL: reset scale before React re-renders with new dimensions
        node.scaleX(1);
        node.scaleY(1);
        const { x, y, width, height, rotation } = calculateTransformResult(
          node.x(),
          node.y(),
          w,
          h,
          scaleX,
          scaleY,
          node.rotation()
        );
        onTransformEnd(obj.id, x, y, width, height, rotation);
      },
      [obj.id, w, h, onTransformEnd]
    );

    const handleMouseEnter = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => {
        if (!draggable) return;
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "grab";
      },
      [draggable]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseLeave = useCallback((e: any) => {
      const stage = e.target.getStage();
      if (stage) stage.container().style.cursor = "default";
    }, []);

    // In booking mode, onAvailabilitySelect replaces onSelect as the click handler.
    const handleClick = onAvailabilitySelect ?? onSelect;

    return (
      <Group
        ref={ref}
        x={cx}
        y={cy}
        rotation={rotation}
        draggable={draggable}
        dragBoundFunc={dragBoundFunc}
        onClick={handleClick}
        onTap={handleClick}
        onDragStart={draggable ? onSelect : undefined}
        onDragMove={draggable ? onDragMove : undefined}
        onDragEnd={draggable ? handleDragEnd : undefined}
        onTransformEnd={handleTransformEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Renderer
          object={obj}
          config={config}
          style={renderStyle}
          width={w}
          height={h}
          isSelected={isSelected}
          isSaving={isSaving}
          isBookingMode={isBookingMode}
        />
        {isCutout && (
          <Line
            points={[-w / 2, -h / 2, w / 2, h / 2, 0, 0, -w / 2, h / 2, w / 2, -h / 2]}
            stroke={CUTOUT_X_COLOR}
            strokeWidth={1.5}
            listening={false}
          />
        )}
        {showLabel && (
          <Text
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            text={displayLabel}
            fontSize={LABEL_FONT_SIZE}
            fontFamily="sans-serif"
            fill={LABEL_FILL}
            align="center"
            verticalAlign="middle"
            padding={LABEL_PADDING}
            ellipsis
            wrap="none"
            listening={false}
          />
        )}
        {hasDesk && (
          <Circle
            x={w / 2 - DESK_DOT_RADIUS - 2}
            y={-h / 2 + DESK_DOT_RADIUS + 2}
            radius={DESK_DOT_RADIUS}
            fill={DESK_DOT_COLOR}
            listening={false}
          />
        )}
      </Group>
    );
  }
);
