/**
 * Types for the deterministic Tidy-preview copy layer.
 *
 * This layer turns a technical EnhancePlan into friendly, human-readable
 * suggestions for the preview dialog. It is pure and deterministic — no AI/LLM,
 * no network, no React/MUI/Konva. Copy comes from i18n; the backend keeps
 * storing the raw reasonCodes/results for audit.
 */
import type { LayoutObject } from "../types/layoutObject.types";

/** The minimal object shape the suggestion builder needs. */
export type LayoutObjectLike = Pick<
  LayoutObject,
  "id" | "label" | "object_type" | "object_type_display"
>;

export type TidySuggestionSeverity = "info" | "warning";

export interface TidySuggestion {
  /** Stable, deterministic id (category-based) for React keys. */
  id: string;
  title: string;
  description: string;
  /** Layout-object ids this suggestion covers. */
  objectIds: number[];
  /** Raw engine reason codes rolled into this suggestion (deduped). */
  reasonCodes: string[];
  severity: TidySuggestionSeverity;
}
