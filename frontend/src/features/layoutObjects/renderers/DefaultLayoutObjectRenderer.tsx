import { Rect, Circle } from "react-konva";
import type { LayoutObjectRendererProps } from "./types";

/**
 * Default layout object renderer.
 *
 * Reproduces the original inline shape rendering from `LayoutObjectCanvasNode`:
 * a centred Circle for `config.shape === "circle"`, otherwise a centred Rect with
 * `config.cornerRadius`. Visual properties (fill/stroke/strokeWidth/opacity/dash)
 * come entirely from `style`, which is identical to what the node previously
 * spread onto the shape — so output is pixel-for-pixel unchanged.
 *
 * This is the fallback renderer for every object type today. Future enhanced
 * renderers (PR 061) register per-type and may draw richer Konva primitives, but
 * should still spread `style` onto their base shape to keep selection, saving,
 * and booking-availability colours working.
 */
export function DefaultLayoutObjectRenderer({
  config,
  style,
  width,
  height,
}: LayoutObjectRendererProps) {
  if (config.shape === "circle") {
    return <Circle x={0} y={0} radius={Math.min(width, height) / 2} {...style} />;
  }

  return (
    <Rect
      x={-width / 2}
      y={-height / 2}
      width={width}
      height={height}
      cornerRadius={config.cornerRadius}
      {...style}
    />
  );
}
