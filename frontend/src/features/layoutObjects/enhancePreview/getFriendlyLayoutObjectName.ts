import { en } from "@/i18n/en";
import type { LayoutObjectLike } from "./types";

/**
 * A friendly, human name for an object in suggestion copy:
 *   custom label → backend display name (e.g. "Standing Desk") → "Object".
 * Deterministic; safe to use at the start of a sentence.
 */
export function getFriendlyLayoutObjectName(obj: LayoutObjectLike | undefined): string {
  if (!obj) return en.app.layoutObjects.tidySuggestFallbackName;
  const label = obj.label?.trim();
  if (label) return label;
  const display = obj.object_type_display?.trim();
  if (display) return display;
  return en.app.layoutObjects.tidySuggestFallbackName;
}

/** Sentence-case a library display name: "Standing Desk" → "Standing desk". */
function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Naive English pluralization, good enough for object-type display names. */
function pluralize(s: string): string {
  if (/(?:s|x|z|ch|sh)$/i.test(s)) return `${s}es`;
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`;
  return `${s}s`;
}

/**
 * A friendly PLURAL name for a group of objects, used in grouped suggestion
 * titles: when every object shares a type, use that type's pluralized library
 * name (e.g. "Standing desks"); otherwise the generic "Objects". Deterministic.
 */
export function getFriendlyGroupName(objects: ReadonlyArray<LayoutObjectLike>): string {
  const fallback = en.app.layoutObjects.tidySuggestFallbackNamePlural;
  const first = objects[0];
  if (!first) return fallback;
  const sameType = objects.every((o) => o.object_type === first.object_type);
  const display = first.object_type_display?.trim();
  if (sameType && display) return pluralize(sentenceCase(display));
  return fallback;
}
