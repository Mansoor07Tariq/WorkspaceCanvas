/**
 * Public contract for the pure Enhance/Tidy engine.
 *
 * The engine takes a layout + rules and returns a PLAN: a list of proposed
 * operations (with before/after/patch/reasonCodes), diagnostics, and a summary.
 * It is deterministic, never mutates its inputs, and imports no React / Konva /
 * MUI / hooks / API clients. The plan powers preview, best-effort apply, retry,
 * undo, and audit — see ./computeEnhancePlan and ../enhanceApply.
 */
import type { FloorBoundary } from "../utils/coordinateHelpers";
import type { Rect } from "../utils/floorShape";
import type { LayoutObject } from "../types/layoutObject.types";

/** Geometry snapshot — all values are 2-decimal numeric strings (wire format). */
export interface GeomSnapshot {
  x: string;
  y: string;
  width: string;
  height: string;
  rotation: string;
}

/**
 * Why an operation exists. Best-effort, derived from the change + object type.
 * Only the codes the engine can actually emit are listed (honest types): the
 * per-rule provenance codes the engine does not yet thread (equalized,
 * snapped-to-wall, clamped-inside, moved-out-of-cutout) were removed. See
 * docs/063 and TD-049.
 */
export type ReasonCode = "repositioned" | "resized" | "rotated" | "arranged" | "wall-extended";

/** A single proposed change to one object. */
export interface EnhanceOperation {
  type: "updateObject";
  objectId: number;
  before: GeomSnapshot;
  after: GeomSnapshot;
  /** Minimal set of changed fields (what the backend should PATCH). */
  patch: Partial<GeomSnapshot>;
  reasonCodes: ReasonCode[];
}

export type DiagnosticLevel = "info" | "warning" | "error";

export interface Diagnostic {
  level: DiagnosticLevel;
  /** Stable, translatable key. The UI maps this to copy (see i18n tidyDiagnostics). */
  code: string;
  /** Optional fallback text; the pure engine emits code only (copy lives in i18n). */
  message?: string;
  objectId?: number;
}

export interface EnhanceSummary {
  /** Objects with a proposed change. */
  changed: number;
  /** Objects the engine left untouched. */
  unchanged: number;
  /** Number of warning/error diagnostics. */
  warnings: number;
  /** Convergence loop iterations that ran. */
  iterations: number;
  /** Whether the engine reached a fixed point before the iteration cap. */
  converged: boolean;
}

export interface EnhancePlan {
  operations: EnhanceOperation[];
  diagnostics: Diagnostic[];
  summary: EnhanceSummary;
}

export interface EnhanceEngineInput {
  boundary: FloorBoundary;
  objects: ReadonlyArray<LayoutObject>;
  /** Cutout rects; when omitted the engine derives them from `objects`. */
  cutouts?: Rect[];
}
