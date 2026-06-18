import { Image as KonvaImage, Rect } from "react-konva";
import type { LayoutObjectRendererProps } from "../types";
import { DefaultLayoutObjectRenderer } from "../DefaultLayoutObjectRenderer";
import { getIsometricAsset } from "./assetRegistry";
import { useKonvaImage } from "./useKonvaImage";

/**
 * Renders a layout object using a pre-built isometric SVG asset instead of a
 * plain box, while preserving every behaviour the shared
 * `LayoutObjectCanvasNode` owns (position, rotation, drag, resize, selection,
 * label, bookable dot, booking click).
 *
 * Geometry/hitbox safety: the asset image is drawn to the exact object box
 * (`-w/2..w/2`, `-h/2..h/2`) and is the listening hit target, so the clickable
 * area is identical to the default rect. Rotation is applied by the parent Group.
 *
 * Booking/selection: rather than recolouring the SVG, a translucent fill tint
 * plus a border (both from the resolved `style`) overlay the asset — so
 * availability colours in booking mode and the editor selection highlight stay
 * visible without touching the artwork.
 *
 * Fallback: if no asset is registered for the type, or the image is still
 * loading / failed to load, it renders the `DefaultLayoutObjectRenderer` so the
 * object is never invisible and its hitbox never disappears.
 */
export function IsometricAssetRenderer(props: LayoutObjectRendererProps) {
  const { object, config, style, width, height, isSaving, isBookingMode } = props;
  const asset = getIsometricAsset(object.object_type);
  const { image, status } = useKonvaImage(asset?.src);

  if (!asset || status !== "loaded" || !image) {
    return <DefaultLayoutObjectRenderer {...props} />;
  }

  const x = -width / 2;
  const y = -height / 2;
  // Tint is subtle in the editor (let the artwork read) but stronger in booking
  // mode so availability colours remain legible over the asset.
  const tintOpacity = isBookingMode ? 0.45 : 0.12;

  // Contain-fit the artwork inside the object box so it is never distorted: scale
  // to the largest size that fits, then centre. The tint/border rects still cover
  // the full box below, so selection and availability stay over the whole object.
  // When natural dimensions are unavailable, fall back to filling the box.
  const naturalW = image.naturalWidth || 0;
  const naturalH = image.naturalHeight || 0;
  let imgW = width;
  let imgH = height;
  let imgX = x;
  let imgY = y;
  if (naturalW > 0 && naturalH > 0) {
    const scale = Math.min(width / naturalW, height / naturalH);
    imgW = naturalW * scale;
    imgH = naturalH * scale;
    imgX = -imgW / 2;
    imgY = -imgH / 2;
  }

  return (
    <>
      <KonvaImage
        image={image}
        x={imgX}
        y={imgY}
        width={imgW}
        height={imgH}
        opacity={isSaving ? 0.6 : 1}
        listening={false}
      />
      {/* Full-box tint AND the hit target: because the contain-fit image can be
          smaller than the box, this rect (always full-box, always filled) is the
          listening shape, so the clickable/draggable area equals the default
          rect's box and the hitbox never shrinks with the artwork. */}
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
