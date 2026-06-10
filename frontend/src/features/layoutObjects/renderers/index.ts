import type { LayoutObjectType } from "../types/layoutObject.types";
import { DefaultLayoutObjectRenderer } from "./DefaultLayoutObjectRenderer";
import type { LayoutObjectRenderer } from "./types";

export type { LayoutObjectRenderer, LayoutObjectRendererProps } from "./types";
export { DefaultLayoutObjectRenderer };

/**
 * Per-type renderer overrides. Empty today: every object type uses the default
 * renderer, so visual output matches the pre-registry behaviour exactly.
 *
 * Future enhanced renderers (PR 061) register here, e.g.
 *   const rendererRegistry = { desk: DeskRenderer, meeting_room: MeetingRoomRenderer };
 */
const rendererRegistry: Partial<Record<LayoutObjectType, LayoutObjectRenderer>> = {};

/**
 * Resolve the renderer for a layout object type. Falls back to the default
 * renderer for any type without a registered override (and for unknown types).
 */
export function getLayoutObjectRenderer(objectType: LayoutObjectType): LayoutObjectRenderer {
  return rendererRegistry[objectType] ?? DefaultLayoutObjectRenderer;
}
