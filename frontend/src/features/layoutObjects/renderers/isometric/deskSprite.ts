import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { getIsoAssetsByBaseType } from "./isoManifest";
import { fnv1a, pickVariantKey } from "./spriteVariant";

// Re-exported so existing importers/tests keep resolving `fnv1a` from here; the canonical
// definition (shared with the B4 renderers) lives in `spriteVariant.ts`.
export { fnv1a };

/** True for a desk that is booked (by anyone) on the selected day. */
export function isBookedStatus(status: DeskAvailabilityStatus | undefined): boolean {
  return status === "reserved" || status === "bookedByMe";
}

/**
 * Pick the desk sprite, **scoped to the FLOOR** (PR 082; supersedes the PR 080 per-object rule):
 * - **aesthetic variants** are floor-scoped, so every desk of the same kind on a floor matches;
 * - **richness stays bound to booking state**: a FREE desk uses the clean `Desk+System` "Less" variant;
 *   a BOOKED desk uses the bare `Desk+Chair` (empty top) so the occupant identity can sit on the desktop.
 *   Those are two different families, so each gets its own floor-scoped pick.
 *
 * Closes **TD-069**: this now delegates to {@link pickVariantKey} instead of hashing with its own
 * (unsalted) convention, so there is exactly ONE hashing rule. The register warned that unifying the two
 * would silently reshuffle every desk — this PR reshuffles them anyway by design, so the cost is taken
 * once, here, rather than left as a trap.
 *
 * Returns the manifest asset key, or undefined when the pool is empty (→ styled-box fallback, never blank).
 */
export function pickDeskSpriteKey(
  floorId: number,
  status: DeskAvailabilityStatus | undefined
): string | undefined {
  const pool = isBookedStatus(status)
    ? getIsoAssetsByBaseType("Desk+Chair")
    : getIsoAssetsByBaseType("Desk+System").filter((a) => a.descriptor === "Less");
  return pickVariantKey(floorId, pool);
}
