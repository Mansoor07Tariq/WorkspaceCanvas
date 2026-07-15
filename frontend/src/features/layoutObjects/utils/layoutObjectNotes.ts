import type { LayoutObject } from "../types/layoutObject.types";

/** Notes live in the object's metadata; coerce to a string for display/editing. */
export function getObjectNotes(obj: Pick<LayoutObject, "metadata">): string {
  return typeof obj.metadata.notes === "string" ? obj.metadata.notes : "";
}
