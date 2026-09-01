import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { getIsoAsset, getIsoAssetsByBaseType, type IsoAsset } from "./isoManifest";
import { fnv1a, pickVariantKey } from "./spriteVariant";

// Re-exported so existing importers/tests keep resolving `fnv1a` from here; the canonical
// definition (shared with the B4 renderers) lives in `spriteVariant.ts`.
export { fnv1a };

/** The descriptor the pipeline gives an emitted layer-zero variant (`emitBare` in the overrides). */
export const BARE_DESCRIPTOR = "Bare";

const DESK_FAMILY = "Desk+System";

/** True for a desk that is booked (by anyone) on the selected day. */
export function isBookedStatus(status: DeskAvailabilityStatus | undefined): boolean {
  return status === "reserved" || status === "bookedByMe";
}

/**
 * Desk designs a floor may choose from: exactly those with an emitted **bare** counterpart.
 *
 * A design without one cannot express "booked" without swapping to different furniture, so it is
 * not selectable at all (PR 084 criterion 5). Today that excludes `Desk+System` 3 and 4, whose
 * monitor is baked into layer zero of the source — there is no clear desktop to emit. The cost is
 * variety ACROSS floors, not within one: PR 082 already scopes a variant to the floor, so a floor
 * shows a single desk design either way.
 */
export function selectableDeskDesigns(): IsoAsset[] {
  return getIsoAssetsByBaseType(DESK_FAMILY).filter((a) => a.descriptor === BARE_DESCRIPTOR);
}

/**
 * Pick the desk sprite. **Booking changes the desk's clutter, never its identity or its size.**
 *
 * The floor picks ONE design (PR 082's floor-scoped rule, untouched — `pickVariantKey` hashing
 * floor and family). Booked resolves to that design's bare variant; free resolves to the same
 * design carrying clutter. Because the pipeline crops the bare variant to the full render's trim
 * rectangle, both share a canvas and an aspect ratio, so `fitFootprint` draws them at the identical
 * size in the identical place — booking clears the desk instead of replacing it.
 *
 * Supersedes the PR 080 rule "free → `Desk+System` filtered to *Less*; booked → `Desk+Chair`".
 * Both halves were wrong: the family swap changed the furniture AND its dimensions, and the `Less`
 * premise was false — review/47 measured `Less` as having MORE on the desktop than the plain
 * variant (it adds a plant, notepad, pen cup and phone). The filter is deleted rather than retuned,
 * because the descriptor no longer carries booking state: **bare means booked, any clutter means
 * free**. `Desk+Chair` is no longer used for desks at all.
 *
 * Returns the manifest asset key, or undefined when no design is selectable (→ styled-box
 * fallback, never blank).
 */
export function pickDeskSpriteKey(
  floorId: number,
  status: DeskAvailabilityStatus | undefined
): string | undefined {
  const designs = selectableDeskDesigns();
  const bareKey = pickVariantKey(floorId, designs);
  if (!bareKey) return undefined;
  if (isBookedStatus(status)) return bareKey;

  // Same design, with its clutter. Salted so the clutter choice is independent of the design
  // choice; both are floor-scoped, so every free desk on a floor still matches.
  const index = getIsoAsset(bareKey)?.variantIndex;
  const clutter = getIsoAssetsByBaseType(DESK_FAMILY).filter(
    (a) => a.variantIndex === index && a.descriptor !== BARE_DESCRIPTOR
  );
  return pickVariantKey(floorId, clutter, 1) ?? bareKey;
}
