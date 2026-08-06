import { BOUNDARY_WALL_THICKNESS, type FloorBoundary } from "../../utils/coordinateHelpers";

// Shared canvas palette + wall geometry, extracted from FloorMapCanvas (PR 067).
export const GRID_COLOR = "#E5E7EB";
export const CANVAS_BG = "#F3F4F6"; // grey margin outside the room (gray-100)
export const ROOM_FILL = "#FFFFFF"; // white interior of the office

// Walls are drawn to match the "wall" object from the library (Structure
// palette): a solid grey band with a darker outline, not a thin line. The four
// segments frame the white interior and extend OUTWARD from the boundary, so the
// containment region (DEFAULT_FLOOR_BOUNDARY) stays the inner wall face.
export const WALL_FILL = "#D1D5DB"; // gray-300 — same as the wall object fill
export const WALL_STROKE = "#4B5563"; // gray-600 — same as the wall object stroke
export const WALL_STROKE_WIDTH = 2;
export const WALL_THICKNESS = BOUNDARY_WALL_THICKNESS;

export const GUIDE_COLOR = "#EC4899"; // pink-500 alignment guides
// Tidy ghost-preview outline/connector (PR 069). Violet reads as "proposed /
// enhance" and is distinct from the pink drag guides and the blue boundary handles.
export const GHOST_COLOR = "#7C3AED"; // violet-600 (dashed outline + connector)
export const GHOST_FILL = "rgba(124, 58, 237, 0.10)"; // violet-600 @ 10% — subtle ghost fill
export const BOUNDARY_HANDLE_COLOR = "#2563EB"; // blue-600 room-resize handles
export const ROOM_WALL_COLOR = "#6B7280"; // gray-500 — thin walls drawn around rooms in enhance
export const ROOM_WALL_THICKNESS = 5;

// Objects rotate in 10° increments — snap the transformer's rotation handle to
// every multiple of 10 (tolerance 5 covers the whole range, so it always snaps).
export const ROTATION_SNAPS = Array.from({ length: 36 }, (_, i) => i * 10);

/**
 * Four wall segments framing the interior, each extending outward by
 * WALL_THICKNESS. Top/bottom span the full width (incl. corners) so the corners
 * read as solid wall. Computed from the (editable) boundary so they track resize.
 */
export function buildWallSegments(b: FloorBoundary) {
  return [
    // top
    {
      x: b.x - WALL_THICKNESS,
      y: b.y - WALL_THICKNESS,
      width: b.width + WALL_THICKNESS * 2,
      height: WALL_THICKNESS,
    },
    // bottom
    {
      x: b.x - WALL_THICKNESS,
      y: b.y + b.height,
      width: b.width + WALL_THICKNESS * 2,
      height: WALL_THICKNESS,
    },
    // left
    { x: b.x - WALL_THICKNESS, y: b.y, width: WALL_THICKNESS, height: b.height },
    // right
    { x: b.x + b.width, y: b.y, width: WALL_THICKNESS, height: b.height },
  ];
}
