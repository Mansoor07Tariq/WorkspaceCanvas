import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Group, Circle, Line, Text } from "react-konva";
import type Konva from "konva";
import { getLayoutObjectRenderConfig } from "../utils/layoutObjectRenderConfig";
import { getLayoutObjectNodeStyle } from "../utils/layoutObjectNodeStyle";
import { getLayoutObjectRenderer } from "../renderers";
import { calculateTransformResult, getTopLeftFromCenterPosition } from "../utils/coordinateHelpers";
import { isWallMountedType } from "../utils/wallPlacement";
import type { LayoutObject } from "../types/layoutObject.types";
import type {
  DeskAvailabilityStatus,
  OccupantKind,
} from "@/features/bookings/utils/bookingAvailability";

/** Konva drag-bound: keeps a door/window sliding along its host wall. */
type WallDragBound = (this: Konva.Node, pos: { x: number; y: number }) => { x: number; y: number };

interface Props {
  obj: LayoutObject;
  isSelected: boolean;
  /** Stable handler (PR 068): the node passes its own id back. */
  onSelect: (id: number) => void;
  draggable?: boolean;
  /**
   * Stable factory for the door/window slide-along-wall drag bound (PR 068). The
   * node calls it with its own object; a plain (non-wall) object gets no bound.
   */
  wallDragBoundFor?: (obj: LayoutObject) => WallDragBound | undefined;
  /** Live drag handler for plain objects (snap + guides). Receives (obj, node). */
  onDragMove?: (obj: LayoutObject, node: Konva.Node) => void;
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
  /** Called when the user clicks this object in booking mode (id passed back). */
  onAvailabilitySelect?: (id: number) => void;
  /** True when the canvas is in booking mode (read-only, availability overlay). */
  isBookingMode?: boolean;
  /** True when the Enhance toggle is on: render isometric assets instead of boxes. */
  enhanced?: boolean;
  /**
   * Occupant identity for a booked desk's on-desktop tile (PR 080 B3). Flat scalars, not
   * a single object, so a booking change re-renders only the affected desk (see the memo
   * comparator). Undefined `occupantKind` ⇒ no tile.
   */
  occupantKind?: OccupantKind;
  occupantName?: string;
  occupantAvatarUrl?: string | null;
  occupantColorKey?: number | null;
  /** Reports hover (object id) / un-hover (null) so the canvas can show a tooltip. */
  onHover?: (objectId: number | null) => void;
  /**
   * Registers this node's Konva group with the canvas (for transformer attach and
   * post-drag settle). STABLE (PR 068): the node keeps its OWN internal ref and
   * reports it up via this callback in an effect, so the parent never passes a
   * fresh `ref` that would defeat memoisation.
   */
  registerNode: (id: number, node: Konva.Group | null) => void;
}

const LABEL_FONT_SIZE = 11;
const LABEL_PADDING = 3;
const LABEL_FILL = "#1F2937";

const DESK_DOT_RADIUS = 5;
const DESK_DOT_COLOR = "#16A34A"; // green-600

const CUTOUT_X_COLOR = "#DC2626"; // red-600 — marks a "carve this area" box

function LayoutObjectCanvasNodeInner({
  obj,
  isSelected,
  onSelect,
  draggable = false,
  wallDragBoundFor,
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
  occupantKind,
  occupantName,
  occupantAvatarUrl,
  occupantColorKey,
  onHover,
  registerNode,
}: Props) {
  const w = parseFloat(obj.width);
  const h = parseFloat(obj.height);
  const x = parseFloat(obj.x);
  const y = parseFloat(obj.y);
  // || 0 guards against a NaN rotation corrupting the Konva transform (FE-10).
  const rotation = parseFloat(obj.rotation) || 0;

  // The node owns its Konva ref and registers it with the canvas via a stable
  // callback (PR 068) — so the parent doesn't hand down a fresh `ref` each render.
  const groupRef = useRef<Konva.Group>(null);
  useEffect(() => {
    registerNode(obj.id, groupRef.current);
    return () => registerNode(obj.id, null);
  }, [registerNode, obj.id]);

  const config = getLayoutObjectRenderConfig(obj.object_type);
  const displayLabel = obj.label || config.shortCode;
  const isCutout = obj.object_type === "cutout";
  const isWallMounted = isWallMountedType(obj.object_type);

  // In enhanced (isometric) mode the artwork carries its own meaning, so the
  // short-code labels (e.g. "DSK") become visual noise. Hide them for every
  // type except meeting rooms, which still need a textual marker.
  //
  // Exception (PR 080 B3 label decision): a FREE desk on the booking map has no
  // occupant tile to say "who/which", so keep its short-code visible for pick-ability
  // and accessibility. Booked desks stay label-free — their identity tile carries the
  // meaning, and selecting one surfaces its name/code in the booking panel.
  const isFreeDeskInBooking =
    isBookingMode &&
    obj.object_type === "desk" &&
    (availabilityStatus === undefined || availabilityStatus === "available");
  const showLabel = !enhanced || obj.object_type === "meeting_room" || isFreeDeskInBooking;

  // The inner visual is delegated to a per-type renderer (renderer registry).
  const Renderer = getLayoutObjectRenderer(obj.object_type, enhanced);

  // Style decision is delegated to a pure, unit-tested selector (TD-032).
  const shapeProps = getLayoutObjectNodeStyle({
    objectType: obj.object_type,
    isSelected,
    isSaving,
    availabilityStatus,
    isAvailabilitySelected,
  });
  const renderStyle = shapeProps;

  // Group origin at center of bounding box — correct for rotation and drag
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Wall-mounted objects slide along their wall (drag bound); plain draggable
  // objects snap to neighbours (drag move). Decided here from the object itself so
  // the layer can pass STABLE handlers and keep this node memoised (PR 068).
  const dragBoundFunc = useMemo(
    () => (draggable && isWallMounted ? wallDragBoundFor?.(obj) : undefined),
    [draggable, isWallMounted, wallDragBoundFor, obj]
  );
  const handleDragMove = useMemo(
    () =>
      draggable && !isWallMounted && onDragMove
        ? (e: Konva.KonvaEventObject<DragEvent>) => onDragMove(obj, e.target)
        : undefined,
    [draggable, isWallMounted, onDragMove, obj]
  );

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
      onHover?.(obj.id);
      if (!draggable) return;
      const stage = e.target.getStage();
      if (stage) stage.container().style.cursor = "grab";
    },
    [draggable, onHover, obj.id]
  );

  const handleMouseLeave = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      onHover?.(null);
      const stage = e.target.getStage();
      if (stage) stage.container().style.cursor = "default";
    },
    [onHover]
  );

  // In booking mode a click selects the desk for availability; otherwise it
  // selects the object for editing (identical to the pre-067 behaviour).
  const availabilityActive =
    isBookingMode && availabilityStatus !== undefined && !!onAvailabilitySelect;
  const handleClick = useCallback(() => {
    if (availabilityActive && onAvailabilitySelect) onAvailabilitySelect(obj.id);
    else onSelect(obj.id);
  }, [availabilityActive, onAvailabilitySelect, onSelect, obj.id]);
  const handleSelect = useCallback(() => onSelect(obj.id), [onSelect, obj.id]);

  return (
    <Group
      ref={groupRef}
      x={cx}
      y={cy}
      rotation={rotation}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      onClick={handleClick}
      onTap={handleClick}
      onDragStart={draggable ? handleSelect : undefined}
      onDragMove={handleDragMove}
      onDragEnd={draggable ? handleDragEnd : undefined}
      onTransformEnd={handleTransformEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Renderer is a STABLE component from the per-type registry
          (getLayoutObjectRenderer), not one created per render, so its state is
          never reset. The rule fires only because removing forwardRef (PR 068)
          exposed this pre-existing registry pattern to the compiler lint. */}
      {/* eslint-disable-next-line react-hooks/static-components */}
      <Renderer
        object={obj}
        config={config}
        style={renderStyle}
        width={w}
        height={h}
        isSelected={isSelected}
        isSaving={isSaving}
        isBookingMode={isBookingMode}
        availabilityStatus={availabilityStatus}
        occupantKind={occupantKind}
        occupantName={occupantName}
        occupantAvatarUrl={occupantAvatarUrl}
        occupantColorKey={occupantColorKey}
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

/**
 * Explicit props comparison (PR 068, FE-3): re-render only when a prop that affects
 * this node's own output changes. `obj` is compared by reference — the layout state
 * updates it immutably, so an unchanged object keeps the same reference and its node
 * is skipped while a sibling is dragged/edited. All handlers are passed stable by
 * `FloorObjectsLayer`, so comparing them by reference is correct (never stale).
 */
function arePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.obj === next.obj &&
    prev.isSelected === next.isSelected &&
    prev.draggable === next.draggable &&
    prev.isSaving === next.isSaving &&
    prev.hasDesk === next.hasDesk &&
    prev.availabilityStatus === next.availabilityStatus &&
    prev.isAvailabilitySelected === next.isAvailabilitySelected &&
    prev.isBookingMode === next.isBookingMode &&
    prev.enhanced === next.enhanced &&
    // Occupant identity for the on-desk tile (PR 080 B3): flat scalars, so a booking
    // change on one desk skips every OTHER desk's node.
    prev.occupantKind === next.occupantKind &&
    prev.occupantName === next.occupantName &&
    prev.occupantAvatarUrl === next.occupantAvatarUrl &&
    prev.occupantColorKey === next.occupantColorKey &&
    prev.onSelect === next.onSelect &&
    prev.onDragMove === next.onDragMove &&
    prev.onDragEnd === next.onDragEnd &&
    prev.onTransformEnd === next.onTransformEnd &&
    prev.onAvailabilitySelect === next.onAvailabilitySelect &&
    prev.onHover === next.onHover &&
    prev.wallDragBoundFor === next.wallDragBoundFor &&
    prev.registerNode === next.registerNode
  );
}

export const LayoutObjectCanvasNode = memo(LayoutObjectCanvasNodeInner, arePropsEqual);
