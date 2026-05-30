import type { LayoutObjectType } from "@/features/layoutObjects/types/layoutObject.types";
import type { Desk, DeskCapableLayoutObjectType } from "../types/desk.types";

/** Layout object types that can be linked to a Desk resource. */
export const DESK_CAPABLE_TYPES: ReadonlySet<DeskCapableLayoutObjectType> = new Set([
  "desk",
  "standing_desk",
  "hot_desk",
  "private_desk",
]);

/**
 * Returns true if the layout object type can be converted into a Desk resource.
 */
export function isDeskCapableLayoutObject(
  type: LayoutObjectType
): type is DeskCapableLayoutObjectType {
  return (DESK_CAPABLE_TYPES as ReadonlySet<string>).has(type);
}

/**
 * Returns the active Desk linked to a given layout object ID, or undefined if
 * none exists in the provided desk list.
 */
export function getDeskForLayoutObject(desks: Desk[], layoutObjectId: number): Desk | undefined {
  return desks.find((d) => d.layout_object === layoutObjectId && d.is_active);
}
