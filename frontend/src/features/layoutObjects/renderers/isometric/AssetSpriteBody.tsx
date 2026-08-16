import { Image as KonvaImage, Rect } from "react-konva";

import type { RenderConfig } from "../../utils/layoutObjectRenderConfig";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import { fitContain } from "./spriteGeometry";

interface Props {
  image: HTMLImageElement;
  style: LayoutObjectNodeStyle;
  config: RenderConfig;
  width: number;
  height: number;
  isSaving: boolean;
  isBookingMode: boolean;
}

/**
 * Shared Konva body for raster/asset renderers (PR 080): a contain-fit sprite inside the
 * object box, plus a full-box tint (the listening hit target) and a border, both from the
 * resolved availability/selection `style`. Kept as one place so the desk renderer and the
 * generic isometric renderer draw identically. Coordinates are relative to the group
 * centre (`-w/2..w/2`).
 */
export function AssetSpriteBody({
  image,
  style,
  config,
  width,
  height,
  isSaving,
  isBookingMode,
}: Props) {
  const x = -width / 2;
  const y = -height / 2;
  // Subtle in the editor (let the artwork read), stronger in booking mode so availability
  // colours stay legible over the sprite.
  const tintOpacity = isBookingMode ? 0.45 : 0.12;

  const fit = fitContain(image.naturalWidth || 0, image.naturalHeight || 0, width, height);

  return (
    <>
      <KonvaImage
        image={image}
        x={fit.x}
        y={fit.y}
        width={fit.width}
        height={fit.height}
        opacity={isSaving ? 0.6 : 1}
        listening={false}
      />
      {/* Full-box tint AND the hit target: the contain-fit image can be smaller than the
          box, so this always-full-box filled rect is the listening shape — clickable /
          draggable area equals the default rect's box, hitbox never shrinks. */}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        cornerRadius={config.cornerRadius}
        fill={style.fill}
        opacity={tintOpacity}
      />
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        cornerRadius={config.cornerRadius}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        dash={style.dash}
        fillEnabled={false}
        listening={false}
      />
    </>
  );
}
