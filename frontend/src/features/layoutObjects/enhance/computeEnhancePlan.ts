/**
 * computeEnhancePlan — the pure Enhance/Tidy engine entry point.
 *
 * Wraps the geometry core (runEnhanceNormalization) in the richer plan contract:
 * operations with before/after/patch/reasonCodes, diagnostics, and a summary.
 * Deterministic, no I/O, no input mutation, no framework imports.
 */
import { runEnhanceNormalization, type NormalizationPatch } from "../utils/enhanceNormalize";
import { formatCoordinate, DEFAULT_FLOOR_BOUNDARY } from "../utils/coordinateHelpers";
import { getCutoutRects } from "../utils/floorShape";
import type { LayoutObject } from "../types/layoutObject.types";
import type {
  EnhanceEngineInput,
  EnhanceOperation,
  EnhancePlan,
  Diagnostic,
  GeomSnapshot,
  ReasonCode,
} from "./types";

const GEOM_FIELDS: (keyof GeomSnapshot)[] = ["x", "y", "width", "height", "rotation"];

/** Normalize an object's stored geometry to the 2-decimal wire format. */
function snapshotOf(o: LayoutObject): GeomSnapshot {
  return {
    x: formatCoordinate(parseFloat(o.x)),
    y: formatCoordinate(parseFloat(o.y)),
    width: formatCoordinate(parseFloat(o.width)),
    height: formatCoordinate(parseFloat(o.height)),
    rotation: formatCoordinate(parseFloat(o.rotation) || 0),
  };
}

function afterOf(p: NormalizationPatch): GeomSnapshot {
  return { x: p.x, y: p.y, width: p.width, height: p.height, rotation: p.rotation };
}

/** Minimal patch: only the fields that actually differ between before and after. */
function minimalPatch(before: GeomSnapshot, after: GeomSnapshot): Partial<GeomSnapshot> {
  const patch: Partial<GeomSnapshot> = {};
  for (const f of GEOM_FIELDS) {
    if (before[f] !== after[f]) patch[f] = after[f];
  }
  return patch;
}

/** Workstation types the engine packs/aligns into rows, columns and grids. */
const WORKSTATION_TYPES = new Set(["desk", "standing_desk", "hot_desk", "private_desk"]);

/**
 * Best-effort reason codes. The engine core does not yet thread per-rule
 * provenance, so codes are derived from the object type and which geometry
 * fields changed:
 *  • walls only change via end-extension → "wall-extended";
 *  • a size change is the engine equalizing run sizes → "resized";
 *  • a workstation that only moved is being packed/aligned into its row →
 *    "arranged" (friendlier than a bare reposition);
 *  • anything else that moved → "repositioned".
 */
function reasonCodesFor(objectType: string, patch: Partial<GeomSnapshot>): ReasonCode[] {
  if (objectType === "wall") return ["wall-extended"];
  const moved = patch.x !== undefined || patch.y !== undefined;
  const resized = patch.width !== undefined || patch.height !== undefined;
  const codes: ReasonCode[] = [];
  if (resized) codes.push("resized");
  else if (moved && WORKSTATION_TYPES.has(objectType)) codes.push("arranged");
  else if (moved) codes.push("repositioned");
  if (patch.rotation !== undefined) codes.push("rotated");
  return codes.length ? codes : ["repositioned"];
}

export function computeEnhancePlan(input: EnhanceEngineInput): EnhancePlan {
  const boundary = input.boundary ?? DEFAULT_FLOOR_BOUNDARY;
  const objects = input.objects;
  const cutouts = input.cutouts ?? getCutoutRects([...objects]);

  const { patches, iterations, converged } = runEnhanceNormalization(
    [...objects],
    boundary,
    cutouts
  );

  const typeById = new Map(objects.map((o) => [o.id, o.object_type as string]));
  const beforeById = new Map(objects.map((o) => [o.id, snapshotOf(o)]));

  const operations: EnhanceOperation[] = [];
  for (const p of patches) {
    const before = beforeById.get(p.id);
    if (!before) continue;
    const after = afterOf(p);
    const patch = minimalPatch(before, after);
    if (Object.keys(patch).length === 0) continue; // no net change after formatting
    operations.push({
      type: "updateObject",
      objectId: p.id,
      before,
      after,
      patch,
      reasonCodes: reasonCodesFor(typeById.get(p.id) ?? "", patch),
    });
  }

  const diagnostics: Diagnostic[] = [];
  if (!converged) {
    diagnostics.push({
      level: "warning",
      code: "max-iterations-reached",
      message: "Enhance stopped before the layout fully settled; results may be partial.",
    });
  }

  const warnings = diagnostics.filter((d) => d.level !== "info").length;

  return {
    operations,
    diagnostics,
    summary: {
      changed: operations.length,
      unchanged: objects.length - operations.length,
      warnings,
      iterations,
      converged,
    },
  };
}
