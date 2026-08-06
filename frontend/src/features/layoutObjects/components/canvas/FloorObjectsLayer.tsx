import { Layer, Transformer } from "react-konva";
import type Konva from "konva";
import {
  alignOpeningToWall,
  isWallMountedType,
  type getSnapWalls,
} from "../../utils/wallPlacement";
import { MIN_OBJECT_SIZE } from "../../utils/coordinateHelpers";
import { makeMinSizeBoundBox } from "../../utils/transformerBounds";
import { ROTATION_SNAPS } from "./canvasStyle";
import { LayoutObjectCanvasNode } from "../LayoutObjectCanvasNode";
import type { LayoutObject } from "../../types/layoutObject.types";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";

type WallDragBound = (this: Konva.Node, pos: { x: number; y: number }) => { x: number; y: number };

interface Props {
  objects: LayoutObject[];
  carveShape: boolean;
  snapWalls: ReturnType<typeof getSnapWalls>;
  selectedObjectId: number | null;
  isBookingMode: boolean;
  canManageLayout: boolean;
  enhanced: boolean;
  savingObjectIds?: ReadonlySet<number>;
  bookableObjectIds?: ReadonlySet<number>;
  availabilityByLayoutObjectId?: ReadonlyMap<number, DeskAvailabilityStatus>;
  selectedAvailabilityLayoutObjectId?: number | null;
  notesTooltipEnabled: boolean;
  selectedIsWallMounted: boolean;
  scale: number;
  nodeRefs: React.MutableRefObject<Map<number, Konva.Group>>;
  transformerRef: React.RefObject<Konva.Transformer | null>;
  onSelectObject: (id: number | null) => void;
  onAvailabilityObjectSelect?: (layoutObjectId: number) => void;
  setHoveredObjectId: (id: number | null) => void;
  wallDragBoundFor: (obj: LayoutObject) => WallDragBound | undefined;
  handleObjectDragMove: (obj: LayoutObject, node: Konva.Node) => void;
  handleObjectDragEndChecked: (id: number, x: number, y: number) => void;
  onObjectTransformEnd?: (
    objectId: number,
    newX: number,
    newY: number,
    newWidth: number,
    newHeight: number,
    newRotation: number
  ) => void;
}

/**
 * The layer of interactive layout-object nodes plus the object Transformer.
 * Extracted from FloorMapCanvas (PR 067); wiring is moved verbatim. The FE-6
 * zoom-invariant min-size gate uses the shared `makeMinSizeBoundBox` helper.
 */
export function FloorObjectsLayer({
  objects,
  carveShape,
  snapWalls,
  selectedObjectId,
  isBookingMode,
  canManageLayout,
  enhanced,
  savingObjectIds,
  bookableObjectIds,
  availabilityByLayoutObjectId,
  selectedAvailabilityLayoutObjectId,
  notesTooltipEnabled,
  selectedIsWallMounted,
  scale,
  nodeRefs,
  transformerRef,
  onSelectObject,
  onAvailabilityObjectSelect,
  setHoveredObjectId,
  wallDragBoundFor,
  handleObjectDragMove,
  handleObjectDragEndChecked,
  onObjectTransformEnd,
}: Props) {
  return (
    <Layer>
      {objects.map((obj) => {
        // Where the floor is carved (enhanced / booking), a cutout is shown by the
        // carved shape + rerouted walls, so its X box is not drawn.
        if (carveShape && obj.object_type === "cutout") return null;
        // Render doors/windows flush on their wall at the wall's thickness, so
        // existing openings match the (now thicker) walls too.
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
            onHover={notesTooltipEnabled ? setHoveredObjectId : undefined}
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
          boundBoxFunc={makeMinSizeBoundBox(MIN_OBJECT_SIZE, scale)}
        />
      )}
    </Layer>
  );
}
