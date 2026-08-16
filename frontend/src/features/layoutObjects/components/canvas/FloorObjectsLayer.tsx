import { useCallback, useMemo } from "react";
import { Layer, Transformer } from "react-konva";
import type Konva from "konva";
import { alignOpeningToWall, type getSnapWalls } from "../../utils/wallPlacement";
import { MIN_OBJECT_SIZE } from "../../utils/coordinateHelpers";
import { makeMinSizeBoundBox } from "../../utils/transformerBounds";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";
import { ROTATION_SNAPS } from "./canvasStyle";
import { LayoutObjectCanvasNode } from "../LayoutObjectCanvasNode";
import type { LayoutObject } from "../../types/layoutObject.types";
import type {
  DeskAvailabilityStatus,
  OccupantIdentity,
} from "@/features/bookings/utils/bookingAvailability";

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
  occupantByLayoutObjectId?: ReadonlyMap<number, OccupantIdentity>;
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
  occupantByLayoutObjectId,
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
  // Stable node registrar (PR 068): each node reports its Konva group here in an
  // effect, so the layer never hands a fresh `ref` down that would defeat memo.
  const registerNode = useCallback(
    (id: number, node: Konva.Group | null) => {
      if (node) nodeRefs.current.set(id, node);
      else nodeRefs.current.delete(id);
    },
    [nodeRefs]
  );

  // Draw order (PR 080 B4): room shells behind all furniture, then furniture back-to-front by
  // bottom edge (y + height) so overlapping sprites (a plant in front of a sofa) layer correctly.
  // A STABLE copy — keys stay `obj.id` and the memo comparator is reference-based, so reordering
  // changes only Konva sibling paint order, never node identity or the PR-068 render-count.
  const orderedObjects = useMemo(() => {
    const rank = (o: LayoutObject) =>
      getLayoutObjectRenderConfig(o.object_type).category === "Rooms & Zones" ? 0 : 1;
    const bottom = (o: LayoutObject) => parseFloat(o.y) + parseFloat(o.height);
    return [...objects].sort((a, b) => rank(a) - rank(b) || bottom(a) - bottom(b));
  }, [objects]);

  return (
    <Layer>
      {orderedObjects.map((obj) => {
        // Where the floor is carved (enhanced / booking), a cutout is shown by the
        // carved shape + rerouted walls, so its X box is not drawn.
        if (carveShape && obj.object_type === "cutout") return null;
        // Render doors/windows flush on their wall at the wall's thickness, so
        // existing openings match the (now thicker) walls too.
        const displayObj = alignOpeningToWall(obj, snapWalls);
        const availabilityStatus = availabilityByLayoutObjectId?.get(obj.id);
        const isAvailabilitySelected = selectedAvailabilityLayoutObjectId === obj.id;
        // Read the occupant off the map here and forward FLAT scalars: the node's memo
        // compares each, so a booking change on one desk re-renders only that desk.
        const occupant = occupantByLayoutObjectId?.get(obj.id);
        return (
          <LayoutObjectCanvasNode
            key={obj.id}
            registerNode={registerNode}
            obj={displayObj}
            isSelected={!isBookingMode && obj.id === selectedObjectId}
            onSelect={onSelectObject}
            draggable={canManageLayout && !isBookingMode}
            wallDragBoundFor={wallDragBoundFor}
            onDragMove={handleObjectDragMove}
            onDragEnd={isBookingMode ? undefined : handleObjectDragEndChecked}
            onTransformEnd={isBookingMode ? undefined : onObjectTransformEnd}
            isSaving={savingObjectIds?.has(obj.id)}
            hasDesk={bookableObjectIds?.has(obj.id)}
            isBookingMode={isBookingMode}
            enhanced={enhanced}
            onHover={notesTooltipEnabled ? setHoveredObjectId : undefined}
            availabilityStatus={availabilityStatus}
            isAvailabilitySelected={isAvailabilitySelected}
            onAvailabilitySelect={onAvailabilityObjectSelect}
            occupantKind={occupant?.kind}
            occupantName={occupant?.name}
            occupantAvatarUrl={occupant ? occupant.avatarUrl : undefined}
            occupantColorKey={occupant ? occupant.colorKey : undefined}
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
