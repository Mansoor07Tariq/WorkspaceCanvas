import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { getAvailabilityCanvasStyle } from "@/features/bookings/utils/bookingCanvasUtils";
import type { LayoutObjectType } from "../types/layoutObject.types";
import {
  SELECTED_STROKE,
  SELECTED_STROKE_WIDTH,
  getLayoutObjectRenderConfig,
} from "./layoutObjectRenderConfig";

export interface LayoutObjectNodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  dash: number[] | undefined;
}

interface GetNodeStyleParams {
  objectType: LayoutObjectType;
  /** Editor-mode selection highlight. Ignored when an availability status is present. */
  isSelected: boolean;
  /** True while an optimistic save is in flight — dims the shape. */
  isSaving?: boolean;
  /**
   * Booking-mode availability status. When provided, the availability palette
   * is the source of truth and editor styling/selection is ignored — matching
   * how `FloorMapCanvas` separates booking and editor modes.
   */
  availabilityStatus?: DeskAvailabilityStatus;
  /** Booking-mode selection highlight (the selected desk). */
  isAvailabilitySelected?: boolean;
}

/**
 * Pure style selector for a layout object canvas node (TD-032).
 *
 * Centralises the fill/stroke/opacity/dash decision so it can be unit-tested
 * independently of Konva. `LayoutObjectCanvasNode` renders exactly what this
 * returns.
 */
export function getLayoutObjectNodeStyle({
  objectType,
  isSelected,
  isSaving = false,
  availabilityStatus,
  isAvailabilitySelected = false,
}: GetNodeStyleParams): LayoutObjectNodeStyle {
  const config = getLayoutObjectRenderConfig(objectType);

  // Booking mode: availability palette wins and editor selection is ignored.
  const availStyle =
    availabilityStatus !== undefined
      ? getAvailabilityCanvasStyle(availabilityStatus, isAvailabilitySelected)
      : null;

  const fill = availStyle ? availStyle.fill : config.fill;
  const stroke = availStyle ? availStyle.stroke : isSelected ? SELECTED_STROKE : config.stroke;
  const strokeWidth = availStyle
    ? availStyle.strokeWidth
    : isSelected
      ? SELECTED_STROKE_WIDTH
      : config.strokeWidth;
  const baseOpacity = availStyle ? availStyle.opacity : config.opacity;

  return {
    fill,
    stroke,
    strokeWidth,
    // Keep a minimum opacity so overlays don't vanish during save.
    opacity: isSaving ? Math.max(baseOpacity * 0.65, 0.35) : baseOpacity,
    dash: config.dashPattern.length > 0 ? config.dashPattern : undefined,
  };
}
