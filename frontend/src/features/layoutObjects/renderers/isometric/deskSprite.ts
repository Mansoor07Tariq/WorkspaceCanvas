import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { getIsoAssetsByBaseType } from "./isoManifest";
import { fnv1a } from "./spriteVariant";

// Re-exported so existing importers/tests keep resolving `fnv1a` from here; the canonical
// definition (shared with the B4 renderers) lives in `spriteVariant.ts`.
export { fnv1a };

/** True for a desk that is booked (by anyone) on the selected day. */
export function isBookedStatus(status: DeskAvailabilityStatus | undefined): boolean {
  return status === "reserved" || status === "bookedByMe";
}

/**
 * Pick the desk sprite for an object (PR 080 B2, ratified rules):
 * - **aesthetic variants** are chosen by `fnv1a(id) % n` so the same desk always renders
 *   the same design (stable variety, NOT orientation — rotation rotates the sprite);
 * - **richness is bound to booking state**: a FREE desk uses the clean `Desk+System` "Less"
 *   variant; a BOOKED desk uses the bare `Desk+Chair` (empty top) so the occupant identity
 *   can sit on the desktop (B2 identity slice).
 * Returns the manifest asset key, or undefined when the pool is empty (→ styled-box
 * fallback, never blank).
 */
export function pickDeskSpriteKey(
  objectId: number,
  status: DeskAvailabilityStatus | undefined
): string | undefined {
  const pool = isBookedStatus(status)
    ? getIsoAssetsByBaseType("Desk+Chair")
    : getIsoAssetsByBaseType("Desk+System").filter((a) => a.descriptor === "Less");
  if (pool.length === 0) return undefined;
  const ordered = [...pool].sort((a, b) => a.key.localeCompare(b.key));
  return ordered[fnv1a(String(objectId)) % ordered.length].key;
}
