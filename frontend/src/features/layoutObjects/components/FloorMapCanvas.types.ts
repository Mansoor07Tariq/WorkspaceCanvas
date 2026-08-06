import type { FloorBoundary } from "../utils/coordinateHelpers";
import type { LayoutObject, LayoutObjectType } from "../types/layoutObject.types";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";

/** Public props contract for {@link FloorMapCanvas}. Unchanged by PR 067. */
export interface FloorMapCanvasProps {
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
