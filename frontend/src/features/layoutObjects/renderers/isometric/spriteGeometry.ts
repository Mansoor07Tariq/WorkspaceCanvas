import overridesJson from "@/assets/iso/manifest.overrides.json";
import { occupantTileAspect, occupantTileInset } from "@/theme/tokens";

/** Where the fitted sprite lands relative to the object box, in group-centred coords. */
export interface SpriteFit {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Maximum upward overflow, as a fraction of the object's **WIDTH** (PR 081 fix-up, Fix 3). The drawn
 * sprite may rise at most `height ≤ boxH + SPRITE_MAX_OVERFLOW_RATIO × boxW` above its floor rect;
 * beyond that it is scaled down (giving up some width — graceful, not giant).
 *
 * Why bound overflow by WIDTH, not depth: depth is the axis width-fill deliberately ignores (§ below),
 * so a depth-relative cap let the unreliable axis strangle a wide-but-shallow object — e.g. a sofa in a
 * 220×40 rect lost its width on exactly the shallow case this feature fixes. Width is the reliable axis
 * width-fill already uses: bounding overflow by it keeps wide furniture (sofas) at full width even on
 * shallow rects, while still trimming the overflow of tall, near-square art (desks). Named + exported
 * so it is tunable in one place; tune by eye against a real floor.
 */
export const SPRITE_MAX_OVERFLOW_RATIO = 0.25;

/**
 * Footprint fit (PR 081, TD-068): an isometric sprite is taller than the ground it occupies (a
 * sofa's back rises above its floor), so we fit its **width** to the object's floor rect, anchor its
 * **bottom** edge to the rect's bottom, and let the **height overflow UPWARD** — instead of the old
 * contain-fit that squeezed the whole image (full height) into the rect and left tall art tiny.
 *
 * Consequence, by design: the object rect's **depth (height) does NOT affect the sprite scale** — two
 * objects of equal width render at equal size regardless of depth. This is deliberate. Depth-priority
 * would let a narrow, deep object blow out **sideways**, and sideways overflow is far worse than
 * upward overflow because the back-to-front y-sort cannot correct it. Overflow is bounded by
 * {@link SPRITE_MAX_OVERFLOW_RATIO} (a WIDTH fraction). When natural dimensions are unknown (0) we fall
 * back to filling the box.
 */
export function fitFootprint(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number
): SpriteFit {
  if (naturalW > 0 && naturalH > 0) {
    const scale = boxW / naturalW; // fill the floor-rect width
    let width = naturalW * scale;
    let height = naturalH * scale;
    const maxHeight = boxH + SPRITE_MAX_OVERFLOW_RATIO * boxW; // bound overflow by WIDTH
    if (height > maxHeight) {
      const s = maxHeight / height; // scale down (gives up width) rather than overflow more
      width *= s;
      height = maxHeight;
    }
    // Horizontally centred; bottom edge on the rect's bottom (+boxH/2), the rest overflows up.
    return { x: -width / 2, y: boxH / 2 - height, width, height };
  }
  return { x: -boxW / 2, y: -boxH / 2, width: boxW, height: boxH };
}

/**
 * The clickable region for an enhanced object (PR 081 fix-up 2): the **UNION** of the object's floor rect
 * and the drawn sprite bounds.
 *
 * This REVERSES the earlier "hit area = the floor rect" decision. That was defensible while the colour and
 * the hit area were the same shape; once the availability affordance moved onto the sprite bounds it left a
 * strip of visible, coloured, apparently-clickable art (for a 100x60 desk: 25px tall, ~29% of the visible
 * desk and ~48% of the occupant photo) where a click fell through to the Stage and CLEARED the selection.
 *
 * Union — not simply the sprite bounds — because a width-capped sprite is NARROWER than its floor rect, so
 * swapping one shape for the other would shrink the clickable width. Because the sprite is bottom-anchored,
 * in practice this is the floor rect extended upward by the overflow, never narrower than the floor rect.
 *
 * Overlap between neighbours is intentional and needs no tie-breaking: Konva builds its hit graph in draw
 * order and the y-sort already draws front objects last, so a front object's hit shape wins — the same rule
 * that governs what you see. Accepted trade-off: a sprite's bounding box includes transparent corners, so a
 * click in a front object's transparent corner selects that front object even if a neighbour's art shows
 * through. That is the standard cost of rectangular hit areas and is far cheaper than the dead zone it
 * replaces; pixel-perfect hit detection would break the performance story.
 */
export function computeHitRect(fit: SpriteFit, boxW: number, boxH: number): SpriteFit {
  const left = Math.min(-boxW / 2, fit.x);
  const top = Math.min(-boxH / 2, fit.y);
  const right = Math.max(boxW / 2, fit.x + fit.width);
  const bottom = Math.max(boxH / 2, fit.y + fit.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Footprint-fit a sprite into a NORMALIZED sub-rectangle of the object box, then **contain it to the
 * room shell** (PR 081 fix-up, Fix 1). Room-interior furniture (PR 080 B4) must read as being *inside*
 * its room, not floating above it, so after the width-fill + bottom-anchor within the sub-rect the
 * result is clamped so the sprite's TOP never crosses the shell's top edge (`-boxH/2`) — shrinking it
 * (aspect-preserving, keeping the bottom-anchor + horizontal centre) when a shallow room lacks the
 * headroom. Free-standing objects (via {@link fitFootprint}) still overflow past their rect; only
 * shell-contained interiors are clamped.
 */
export function fitFootprintInSubRect(
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
  const inner = fitFootprint(naturalW, naturalH, subW, subH); // bottom-anchored within the sub-rect
  const cx = subLeft + subW / 2; // horizontal centre of the sub-rect
  const bottom = subTop + subH; // the sub-rect bottom (where the piece is anchored)
  let width = inner.width;
  let height = inner.height;
  let top = bottom - height;
  const shellTop = -boxH / 2;
  if (top < shellTop && height > 0) {
    const s = (bottom - shellTop) / height; // shrink so the top sits on the shell edge
    width *= s;
    height = bottom - shellTop;
    top = shellTop;
  }
  return { x: cx - width / 2, y: top, width, height };
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
 * Keys whose `desktopRect` has been **measured against clear desktop art** — the desk slab bounds
 * of the emitted bare variant, inset 4% of the short side, verified by rendering the rect over the
 * art (PR 084).
 *
 * This exists to be a **guard, not a comment**. review/47 found four `desktopRect` values that had
 * been measured against the wrong images and sat, silently wrong, on top of a monitor — harmless
 * only because nothing happened to use them. A booked desk resolving to a key that is not in this
 * set means the occupant photo is about to be drawn on unverified art; `deskSprite.test.ts` fails
 * if that ever becomes reachable. Add a key here only after rendering its rect and looking at it.
 */
export const VERIFIED_DESKTOP_RECT_KEYS: ReadonlySet<string> = new Set([
  "desk-system-1-bare",
  "desk-system-2-bare",
]);

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
 * The occupant tile's AVAILABLE box: the desk's whole top surface, keeping the desktop rect's own
 * width:height proportions (a wide desk → a wide box). This is the room the identity has to work
 * in, not the drawn identity itself — since PR 083 the photo is CONTAINED within this box by
 * {@link containInBox} rather than filling it, so the box is typically wider than what is drawn.
 * Maps the
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

/**
 * Contain an aspect ratio inside a box, centred — the occupant identity's drawn bounds (PR 083).
 *
 * REVERSES PR 080's cover-fit for the occupant photo. Cover filled the desk surface and cropped the
 * overflow; because provider photos are ~square and a desk's top surface is wide and shallow, that cut
 * the top and bottom off every face and left a horizontal band. On a seeded 80x60 desk only ~57% of the
 * photo's height survived. Contain trades drawn size for a whole face, which is the owner's call: a
 * square photo on that desk goes from 72.8x72.8 cropped to a 72.8x41.8 window, to 41.8x41.8 entire.
 *
 * ONE helper serves both paths so they cannot drift: a photo passes its natural dimensions and keeps its
 * own aspect (a wide photo is bound by width and leaves gaps above and below); the generated fallbacks
 * (initials, "Guest") have no intrinsic aspect and pass 0, taking `occupantTileAspect` — square, the modal
 * provider shape — so an initials desk and a photo desk occupy the SAME rect and read as one design.
 * Unknown natural dimensions (0, e.g. an image that never decoded) take that same square default rather
 * than filling the box, so the degenerate case still matches its neighbours instead of standing out.
 *
 * Everything the tile draws — frame, clip, "You" tag, initials — is positioned from the returned bounds,
 * never from the box, so the affordance always tracks the art (the PR 081 fix-up rule).
 */
export function containInBox(naturalW: number, naturalH: number, box: TileBox): TileBox {
  const aspect = naturalW > 0 && naturalH > 0 ? naturalW / naturalH : occupantTileAspect;
  let w = box.w;
  let h = box.w / aspect;
  if (h > box.h) {
    h = box.h; // height-bound: the wide-box case (a square photo on a shallow desktop)
    w = box.h * aspect;
  }
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
