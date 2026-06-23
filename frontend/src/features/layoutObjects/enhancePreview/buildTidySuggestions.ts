/**
 * buildTidySuggestions — turn a technical EnhancePlan into friendly, grouped,
 * deterministic suggestions for the Tidy preview.
 *
 * Pure: no mutation of inputs, no I/O, no AI/LLM, no React/MUI/Konva. Copy is
 * sourced from i18n and interpolated with object names. Operations are grouped
 * by a single dominant category (chosen by reason-code priority); a category
 * with one object gets an object-specific line, more than one gets a grouped
 * line. The backend still stores raw reasonCodes/results for audit.
 */
import { en } from "@/i18n/en";
import type { EnhancePlan } from "../enhance";
import { getFriendlyLayoutObjectName, getFriendlyGroupName } from "./getFriendlyLayoutObjectName";
import type { LayoutObjectLike, TidySuggestion, TidySuggestionSeverity } from "./types";

const c = en.app.layoutObjects;

type Category =
  | "cutout"
  | "boundary"
  | "wallExtend"
  | "wallSnap"
  | "arrange"
  | "resize"
  | "rotate"
  | "align";

// Display order (also priority for the "+N more" cap — warnings first).
const CATEGORY_ORDER: Category[] = [
  "cutout",
  "boundary",
  "wallExtend",
  "wallSnap",
  "arrange",
  "resize",
  "rotate",
  "align",
];

const SEVERITY: Record<Category, TidySuggestionSeverity> = {
  cutout: "warning",
  boundary: "warning",
  wallExtend: "info",
  wallSnap: "info",
  arrange: "info",
  resize: "info",
  rotate: "info",
  align: "info",
};

/**
 * Pick the dominant category for an operation from its reason codes, most
 * specific first. Unknown / future codes fall through to "align".
 */
function categoryOf(reasonCodes: string[]): Category {
  const has = (code: string) => reasonCodes.includes(code);
  if (has("moved-out-of-cutout")) return "cutout";
  if (has("clamped-inside")) return "boundary";
  if (has("wall-extended")) return "wallExtend";
  if (has("snapped-to-wall")) return "wallSnap";
  if (has("arranged")) return "arrange";
  if (has("equalized") || has("resized")) return "resize";
  if (has("rotated")) return "rotate";
  return "align"; // "repositioned" or any unknown code
}

const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export function buildTidySuggestions(
  plan: EnhancePlan,
  objects: ReadonlyArray<LayoutObjectLike>
): TidySuggestion[] {
  const byId = new Map(objects.map((o) => [o.id, o]));

  // Group operations by dominant category, preserving first-seen membership.
  const groups = new Map<Category, { objectIds: number[]; reasonCodes: Set<string> }>();
  for (const op of plan.operations) {
    const cat = categoryOf(op.reasonCodes);
    const group = groups.get(cat) ?? { objectIds: [], reasonCodes: new Set<string>() };
    if (!group.objectIds.includes(op.objectId)) group.objectIds.push(op.objectId);
    for (const rc of op.reasonCodes) group.reasonCodes.add(rc);
    groups.set(cat, group);
  }

  const suggestions: TidySuggestion[] = [];
  for (const cat of CATEGORY_ORDER) {
    const group = groups.get(cat);
    if (!group) continue;
    const copy = c.tidySuggestions[cat];
    const single = group.objectIds.length === 1;
    const groupObjects = group.objectIds
      .map((id) => byId.get(id))
      .filter((o): o is LayoutObjectLike => o !== undefined);
    const name = single
      ? getFriendlyLayoutObjectName(byId.get(group.objectIds[0]))
      : getFriendlyGroupName(groupObjects);
    suggestions.push({
      id: `tidy-${cat}`,
      title: fmt(single ? copy.single : copy.group, { name }),
      description: single ? copy.singleDesc : copy.groupDesc,
      objectIds: group.objectIds,
      reasonCodes: [...group.reasonCodes],
      severity: SEVERITY[cat],
    });
  }

  return suggestions;
}
