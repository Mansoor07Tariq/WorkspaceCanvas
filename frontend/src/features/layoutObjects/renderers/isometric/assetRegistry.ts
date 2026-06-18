import type { LayoutObjectType } from "../../types/layoutObject.types";
import deskIsometric from "@/assets/floor-map/isometric/desk-isometric.svg";
import meetingRoomIsometric from "@/assets/floor-map/isometric/meeting-room-isometric.svg";

/**
 * Metadata for a pre-built, product-owned visual asset used to render a layout
 * object type. The backend remains the source of truth for the object's type,
 * position, size, and rotation — the asset is purely the frontend visual drawn
 * inside that same object box.
 */
export interface IsometricAssetDefinition {
  /** Resolved URL of the bundled SVG asset (Vite turns the import into a URL). */
  src: string;
  /** Accessible description of the asset. */
  alt: string;
  /**
   * How the asset should scale inside the object box. Metadata for future
   * renderers; the current Konva image draws to the box width/height directly.
   */
  preserveAspectRatio?: string;
}

/**
 * Maps layout object types to their pre-built isometric asset. Only the
 * proof-of-concept types are registered; every other type is intentionally
 * absent so it keeps falling back to the default shape renderer.
 */
export const isometricAssetRegistry: Partial<Record<LayoutObjectType, IsometricAssetDefinition>> = {
  desk: {
    src: deskIsometric,
    alt: "Desk",
    preserveAspectRatio: "xMidYMid meet",
  },
  meeting_room: {
    src: meetingRoomIsometric,
    alt: "Meeting room",
    preserveAspectRatio: "xMidYMid meet",
  },
};

/** Returns the asset definition for a type, or undefined when none is registered. */
export function getIsometricAsset(type: LayoutObjectType): IsometricAssetDefinition | undefined {
  return isometricAssetRegistry[type];
}
