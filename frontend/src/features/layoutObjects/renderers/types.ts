import type { ComponentType } from "react";
import type { LayoutObject } from "../types/layoutObject.types";
import type { RenderConfig } from "../utils/layoutObjectRenderConfig";
import type { LayoutObjectNodeStyle } from "../utils/layoutObjectNodeStyle";
import type {
  DeskAvailabilityStatus,
  OccupantKind,
} from "@/features/bookings/utils/bookingAvailability";

/**
 * Props handed to every layout object renderer.
 *
 * A renderer draws ONLY the inner visual of a layout object (the base shape, and
 * later: icons/illustrations). The shared `LayoutObjectCanvasNode` owns the Konva
 * Group geometry, position, rotation, drag/transform binding, selection, label,
 * and the bookable dot — so renderers never re-implement those concerns.
 *
 * The renderer is rendered inside a Konva Group whose origin is the centre of the
 * object's bounding box. Coordinates are therefore relative to that centre:
 * a centred rect spans `[-width/2, -height/2]` to `[width/2, height/2]`.
 */
export interface LayoutObjectRendererProps {
  /** The full layout object (id, type, label, geometry, metadata). */
  object: LayoutObject;
  /** Static visual config resolved from `object.object_type`. */
  config: RenderConfig;
  /**
   * Resolved fill/stroke/opacity/dash for the current state. This already folds
   * in editor selection, saving dim, and booking-mode availability colours — a
   * renderer that spreads `style` onto its base shape keeps all of those working.
   */
  style: LayoutObjectNodeStyle;
  /** Object width in canvas units (`parseFloat(object.width)`). */
  width: number;
  /** Object height in canvas units (`parseFloat(object.height)`). */
  height: number;
  /** True when this object is the editor selection. */
  isSelected: boolean;
  /** True while an optimistic save is in flight. */
  isSaving: boolean;
  /** True when the canvas is in booking mode (read-only, availability overlay). */
  isBookingMode: boolean;
  /**
   * Desk availability status when known (booking mode). The desk renderer uses it to pick
   * booking-state-aware art (free → the clean desk; booked → the bare desk). Already a
   * compared scalar on the memoised node, so passing it costs no extra re-renders.
   */
  availabilityStatus?: DeskAvailabilityStatus;
  /**
   * Occupant identity for a booked desk's on-desktop tile (PR 080 B3), threaded as flat
   * scalars so a single booking change re-renders ONLY that desk's node (a whole-object
   * prop would share a reference across the map and defeat the PR-068 memo). Absent
   * `occupantKind` ⇒ no tile (free desk, or a booking the viewer may not see).
   */
  occupantKind?: OccupantKind;
  /** Occupant display name — drives initials and the tile's accessible label. */
  occupantName?: string;
  /** Occupant photo URL, or null → the tile shows coloured initials. */
  occupantAvatarUrl?: string | null;
  /** Occupant user id → stable tile colour; null falls back to a name hash. */
  occupantColorKey?: number | null;
}

/**
 * A layout object renderer is a Konva-returning React component. It must render
 * react-konva shapes (Rect, Circle, Path, …) and nothing that breaks the Konva
 * scene graph (no HTML/DOM elements).
 */
export type LayoutObjectRenderer = ComponentType<LayoutObjectRendererProps>;
