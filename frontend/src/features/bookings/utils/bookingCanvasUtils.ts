import type { DeskAvailabilityStatus } from "./bookingAvailability";

export interface AvailabilityCanvasStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

// Color-coded per status. Do not rely on color alone — legend + list provide text labels.
const BASE_STYLES: Record<DeskAvailabilityStatus, AvailabilityCanvasStyle> = {
  available: { fill: "#DCFCE7", stroke: "#16A34A", strokeWidth: 2, opacity: 1 },
  reserved: { fill: "#F1F5F9", stroke: "#94A3B8", strokeWidth: 1.5, opacity: 0.8 },
  bookedByMe: { fill: "#DBEAFE", stroke: "#4F46E5", strokeWidth: 2.5, opacity: 1 },
  unavailable: { fill: "#FEF3C7", stroke: "#D97706", strokeWidth: 1.5, opacity: 0.55 },
};

const BOOKING_SELECTED_STROKE = "#F59E0B"; // amber — matches editor selection stroke
const BOOKING_SELECTED_STROKE_WIDTH = 3;

/** Returns Konva shape style for a desk in booking mode. */
export function getAvailabilityCanvasStyle(
  status: DeskAvailabilityStatus,
  isSelected: boolean
): AvailabilityCanvasStyle {
  const base = BASE_STYLES[status];
  if (isSelected) {
    return {
      ...base,
      stroke: BOOKING_SELECTED_STROKE,
      strokeWidth: BOOKING_SELECTED_STROKE_WIDTH,
      opacity: 1,
    };
  }
  return base;
}

/** Full text labels for the map legend. */
export const AVAILABILITY_LEGEND_LABELS: Record<DeskAvailabilityStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  bookedByMe: "Your booking",
  unavailable: "Unavailable",
};

export const AVAILABILITY_LEGEND_ORDER: DeskAvailabilityStatus[] = [
  "available",
  "reserved",
  "bookedByMe",
  "unavailable",
];
