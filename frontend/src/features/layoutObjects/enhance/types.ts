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

/** Why an operation exists. Best-effort, derived from the change + object type. */
export type ReasonCode =
  | "repositioned"
  | "resized"
  | "rotated"
  | "equalized"
  | "snapped-to-wall"
  | "arranged"
  | "wall-extended"
  | "clamped-inside"
  | "moved-out-of-cutout";

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
  code: string;
  message: string;
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

/** Optional rule toggles. Defaults keep current engine behaviour. */
export interface EnhanceRuleSet {
  /** Reserved for future per-rule configuration; engine ignores unknown keys. */
  preset?: "default";
}

export interface EnhanceEngineInput {
  boundary: FloorBoundary;
  objects: ReadonlyArray<LayoutObject>;
  /** Cutout rects; when omitted the engine derives them from `objects`. */
  cutouts?: Rect[];
  rules?: EnhanceRuleSet;
  options?: { maxIterations?: number };
}
