import type { LayoutObjectType } from "../types/layoutObject.types";

/**
 * Single source of truth for the layout-object types that are bookable
 * workstations ("desk-capable" / "workstation" types).
 *
 * Mirrors the backend `DESK_CAPABLE_TYPES` (backend/offices/models.py) — the two
 * lists MUST be changed together. This replaces the five copies that previously
 * lived in deskHelpers, FloorLayoutPage, computeEnhancePlan and enhanceNormalize.
 *
 * Pure module (imports a type only), so the enhance engine can consume it without
 * breaking its no-framework / no-side-effect contract.
 */
export const DESK_CAPABLE_TYPES = ["desk", "standing_desk", "hot_desk", "private_desk"] as const;

export type DeskCapableLayoutObjectType = (typeof DESK_CAPABLE_TYPES)[number];

export const DESK_CAPABLE_TYPE_SET: ReadonlySet<DeskCapableLayoutObjectType> = new Set(
  DESK_CAPABLE_TYPES
);

/** True when a layout-object type can back a bookable Desk resource. */
export function isDeskCapableType(type: LayoutObjectType | string): boolean {
  return (DESK_CAPABLE_TYPE_SET as ReadonlySet<string>).has(type);
}
