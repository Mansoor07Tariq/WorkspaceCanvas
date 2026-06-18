import type { LayoutObjectType } from "../types/layoutObject.types";
import { DefaultLayoutObjectRenderer } from "./DefaultLayoutObjectRenderer";
import { IsometricAssetRenderer } from "./isometric/IsometricAssetRenderer";
import type { LayoutObjectRenderer } from "./types";

export type { LayoutObjectRenderer, LayoutObjectRendererProps } from "./types";
export { DefaultLayoutObjectRenderer };

/**
 * Per-type renderer overrides used ONLY when the canvas is in "enhanced" mode
 * (the Enhance toggle). The proof-of-concept types have pre-built isometric
 * assets; every other type is intentionally absent and resolves to the default
 * shape renderer, so enhancing only swaps in art where it exists. The asset
 * renderer itself falls back to the default renderer when the asset is missing
 * or still loading, so an object is never invisible.
 */
const enhancedRendererRegistry: Partial<Record<LayoutObjectType, LayoutObjectRenderer>> = {
  desk: IsometricAssetRenderer,
  meeting_room: IsometricAssetRenderer,
};

/**
 * Resolve the renderer for a layout object type. By default every type renders
 * as a simple shape (box/circle). When `enhanced` is true, types with a
 * registered enhanced renderer swap to their isometric asset; all others stay
 * on the default renderer.
 */
export function getLayoutObjectRenderer(
  objectType: LayoutObjectType,
  enhanced = false
): LayoutObjectRenderer {
  if (enhanced) {
    return enhancedRendererRegistry[objectType] ?? DefaultLayoutObjectRenderer;
  }
  return DefaultLayoutObjectRenderer;
}
