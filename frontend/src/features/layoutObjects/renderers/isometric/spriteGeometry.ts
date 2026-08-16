import overridesJson from "@/assets/iso/manifest.overrides.json";
import { occupantTileInset } from "@/theme/tokens";

/** Where the contain-fit sprite lands inside the object box, in group-centred coords. */
export interface SpriteFit {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Contain-fit a sprite of natural size into the object box: the largest size that fits
 * without distortion, centred (group origin is the box centre, so x/y are negative-half).
 * When natural dimensions are unknown (0), fills the box. Shared by `AssetSpriteBody` (the
 * drawn sprite) and the desk renderer (to place the occupant tile on the same sprite).
 */
export function fitContain(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number
): SpriteFit {
  if (naturalW > 0 && naturalH > 0) {
    const scale = Math.min(boxW / naturalW, boxH / naturalH);
    const width = naturalW * scale;
    const height = naturalH * scale;
    return { x: -width / 2, y: -height / 2, width, height };
  }
  return { x: -boxW / 2, y: -boxH / 2, width: boxW, height: boxH };
}

/**
 * Contain-fit a sprite into a NORMALIZED sub-rectangle of the object box (group-centred coords).
 * Used to place room-interior furniture (PR 080 B4) within a room shell: `place` is 0..1 of the
 * box (padding already baked in), the sprite is aspect-fit and centred inside it. When natural
 * dimensions are unknown (0), it fills the sub-rect.
 */
export function fitContainInSubRect(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
  place: { x: number; y: number; w: number; h: number }
): SpriteFit {
  const subLeft = -boxW / 2 + place.x * boxW;
  const subTop = -boxH / 2 + place.y * boxH;
  const subW = place.w * boxW;
  const subH = place.h * boxH;
  const inner = fitContain(naturalW, naturalH, subW, subH); // centred at origin, sized to sub-rect
  return {
    x: subLeft + subW / 2 + inner.x,
    y: subTop + subH / 2 + inner.y,
    width: inner.width,
    height: inner.height,
  };
}

/**
 * Normalized sub-rectangle (fractions of the sprite image) of a desk asset's TOP surface —
 * where the occupant identity tile is drawn, clipped so it never spills onto the chair.
 */
export interface DesktopRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A conservative default for any desk asset without a measured override: the upper band of
 * the sprite, inset from the edges. Real desks put the chair in the lower ~40%, so this
 * stays on the wood; per-asset rects in `manifest.overrides.json` refine it.
 */
export const DEFAULT_DESKTOP_RECT: DesktopRect = { x: 0.06, y: 0.05, w: 0.88, h: 0.5 };

const overrides = overridesJson as Record<string, { desktopRect?: DesktopRect } | undefined>;

/**
 * The desktop rect for a sprite key, read LIVE from `manifest.overrides.json` so retuning a
 * rect is a one-line data edit with no code change and no asset rebuild. Falls back to
 * {@link DEFAULT_DESKTOP_RECT} for any key without one.
 */
export function getDesktopRect(key: string | undefined): DesktopRect {
  if (!key) return DEFAULT_DESKTOP_RECT;
  return overrides[key]?.desktopRect ?? DEFAULT_DESKTOP_RECT;
}

/** The occupant tile rectangle (group-centred coords), filling the desk's top surface. */
export interface TileBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Place the occupant tile: it FILLS the desk's top surface, keeping the desktop rect's own
 * width:height proportions (a wide desk → a wide tile) rather than a centred square. Maps the
 * normalized `desktopRect` through the sprite's on-canvas `fit`, then insets uniformly by the
 * `occupantTileInset` token so a small wood margin and the corner radius remain. Because it's
 * drawn inside the object's Konva Group, the parent group's rotation carries the tile at any angle.
 */
export function computeTileBox(fit: SpriteFit, rect: DesktopRect): TileBox {
  const rectLeft = fit.x + rect.x * fit.width;
  const rectTop = fit.y + rect.y * fit.height;
  const rectW = rect.w * fit.width;
  const rectH = rect.h * fit.height;
  const inset = occupantTileInset * Math.min(rectW, rectH);
  return {
    x: rectLeft + inset,
    y: rectTop + inset,
    w: rectW - 2 * inset,
    h: rectH - 2 * inset,
  };
}
