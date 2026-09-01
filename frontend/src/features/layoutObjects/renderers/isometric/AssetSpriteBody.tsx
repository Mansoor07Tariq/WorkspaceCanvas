import { Image as KonvaImage, Rect } from "react-konva";

import type { RenderConfig } from "../../utils/layoutObjectRenderConfig";
import type { LayoutObjectNodeStyle } from "../../utils/layoutObjectNodeStyle";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { computeHitRect, fitFootprint } from "./spriteGeometry";

interface Props {
  image: HTMLImageElement;
  style: LayoutObjectNodeStyle;
  config: RenderConfig;
  width: number;
  height: number;
  isSaving: boolean;
  isBookingMode: boolean;
  /**
   * The desk availability status, when this object is a bookable desk in booking mode. Its presence
   * is what earns the strong availability tint; non-bookable furniture (undefined) shows its art
   * without a dominating colour wash (PR 081 fix-up, Fix 2).
   */
  availabilityStatus?: DeskAvailabilityStatus;
}

/**
 * Shared Konva body for the isometric asset renderers (PR 080; PR 081 footprint fit + affordance).
 * Layers, group-centred (`-w/2..w/2`):
 *  1. the footprint-fit sprite (bottom-anchored to the floor rect, overflowing upward);
 *  2. an **invisible** hit-target rect at the object's floor rect — the clickable region stays where
 *     the object sits, not where its art rises (PR 081 decision 1). NOTE: hit area (floor rect) and the
 *     coloured region (sprite bounds, below) are deliberately DIFFERENT shapes — do not "fix" the mismatch;
 *  3. the availability **fill** over the DRAWN SPRITE bounds — a strong colour only for a bookable desk
 *     (which carries an `availabilityStatus`); other furniture shows its art untinted so it never reads
 *     as a flat coloured blob;
 *  4. the selection/availability **border** over the sprite bounds.
 */
export function AssetSpriteBody({
  image,
  style,
  config,
  width,
  height,
  isSaving,
  isBookingMode,
  availabilityStatus,
}: Props) {
  const fit = fitFootprint(image.naturalWidth || 0, image.naturalHeight || 0, width, height);
  // Clickable = floor rect ∪ drawn sprite. Union (not just the sprite) because a width-capped sprite is
  // narrower than its floor rect, and swapping shapes would shrink the clickable width.
  const hit = computeHitRect(fit, width, height);

  // A strong availability wash only for bookable desks (which carry a status); in the editor a subtle
  // wash lets selection/state read; other booking-map furniture stays untinted so its art shows.
  const fillOpacity = availabilityStatus !== undefined ? 0.4 : isBookingMode ? 0 : 0.12;

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
      {/* Hit target = floor rect ∪ sprite bounds. Invisible (opacity 0) but hit-tested via `listening`
          (Konva's hit graph ignores opacity). Overlap with neighbours is intentional and needs no
          tie-breaking: Konva hit-tests in draw order and the y-sort draws front objects last, so the front
          object wins — the same rule that governs what you see. Trade-off: the bounding box includes the
          sprite's transparent corners, so a click in a front object's transparent corner selects it even if
          a neighbour's art shows through; that is the standard cost of rectangular hit areas. */}
      <Rect
        x={hit.x}
        y={hit.y}
        width={hit.width}
        height={hit.height}
        cornerRadius={config.cornerRadius}
        fill={style.fill}
        opacity={0}
      />
      {/* Availability affordance FOLLOWS the drawn sprite (not the floor rect). */}
      {fillOpacity > 0 && (
        <Rect
          x={fit.x}
          y={fit.y}
          width={fit.width}
          height={fit.height}
          cornerRadius={config.cornerRadius}
          fill={style.fill}
          opacity={fillOpacity}
          listening={false}
        />
      )}
      <Rect
        x={fit.x}
        y={fit.y}
        width={fit.width}
        height={fit.height}
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
