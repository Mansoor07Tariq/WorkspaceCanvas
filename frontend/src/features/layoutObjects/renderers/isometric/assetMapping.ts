import type { LayoutObjectType } from "../../types/layoutObject.types";

/**
 * How a single-sprite object type maps to a manifest asset family (PR 080 B4). Either a fixed
 * `base` family, or a `small`/`large` pair split at an area `threshold` (canvas px²) so a big
 * sofa reads bigger than a small one. The specific variant within the family is then hash-picked
 * (`pickVariantKey`) for deterministic variety. Types absent from the map fall back to the styled
 * box (never blank).
 */
export type SingleSpriteMapping =
  | { base: string }
  | { small: string; large: string; threshold: number };

// Area (px²) above which a sofa object uses the larger sprite family. A desk is ~80×50=4000 px²,
// so ~12000 ≈ a couch clearly bigger than a single desk. Tunable in one place.
export const SOFA_LARGE_AREA = 12000;

export const SINGLE_SPRITE_MAP: Partial<Record<LayoutObjectType, SingleSpriteMapping>> = {
  // Seating
  sofa: { small: "Small Sofa", large: "Big Sofa", threshold: SOFA_LARGE_AREA },
  lounge_chair: { base: "Small Sofa" },
  stool: { base: "Stool" },
  chair_table_set: { base: "Short Table with one Bench" },
  // Tables
  table: { base: "Table" },
  coffee_table: { base: "Table" },
  lunch_table: { base: "Long Table" },
  boardroom_table: { base: "Long Table with Benches" },
  // Facilities
  toilet: { base: "Toilet" },
  sink: { base: "Toilet Sink" },
  kitchen_sink: { base: "Kitchen Shelf" },
  // Structure openings (wall-mounted; the box is a thin wall-aligned strip, and these sprites are
  // wide-thin bars, so contain-fit lays them along the wall). Doors render CLOSED — see the report.
  door: { base: "Door closed" },
  window: { base: "Window" },
  // Decor
  plant: { base: "Plant" },
};

/** Resolve the asset family for a single-sprite object at a given box area. */
export function resolveBaseType(mapping: SingleSpriteMapping, area: number): string {
  if ("base" in mapping) return mapping.base;
  return area >= mapping.threshold ? mapping.large : mapping.small;
}
