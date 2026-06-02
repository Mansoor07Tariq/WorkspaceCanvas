import { forwardRef, useCallback } from "react";
import { Group, Rect, Circle, Text } from "react-konva";
import type Konva from "konva";
import { getLayoutObjectRenderConfig } from "../utils/layoutObjectRenderConfig";
import { getLayoutObjectNodeStyle } from "../utils/layoutObjectNodeStyle";
import { calculateTransformResult, getTopLeftFromCenterPosition } from "../utils/coordinateHelpers";
import type { LayoutObject } from "../types/layoutObject.types";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";

interface Props {
  obj: LayoutObject;
  isSelected: boolean;
  onSelect: () => void;
  draggable?: boolean;
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
}

const LABEL_FONT_SIZE = 11;
const LABEL_PADDING = 3;
const LABEL_FILL = "#1F2937";

const DESK_DOT_RADIUS = 5;
const DESK_DOT_COLOR = "#16A34A"; // green-600

export const LayoutObjectCanvasNode = forwardRef<Konva.Group, Props>(
  function LayoutObjectCanvasNode(
    {
      obj,
      isSelected,
      onSelect,
      draggable = false,
      onDragEnd,
      onTransformEnd,
      isSaving = false,
      hasDesk = false,
      availabilityStatus,
      isAvailabilitySelected = false,
      onAvailabilitySelect,
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

    // Style decision is delegated to a pure, unit-tested selector (TD-032):
    // availability palette in booking mode, render config + selection in editor.
    const shapeProps = getLayoutObjectNodeStyle({
      objectType: obj.object_type,
      isSelected,
      isSaving,
      availabilityStatus,
      isAvailabilitySelected,
    });

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
        onClick={handleClick}
        onTap={handleClick}
        onDragStart={draggable ? onSelect : undefined}
        onDragEnd={draggable ? handleDragEnd : undefined}
        onTransformEnd={handleTransformEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {config.shape === "circle" ? (
          <Circle x={0} y={0} radius={Math.min(w, h) / 2} {...shapeProps} />
        ) : (
          <Rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            cornerRadius={config.cornerRadius}
            {...shapeProps}
          />
        )}
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
