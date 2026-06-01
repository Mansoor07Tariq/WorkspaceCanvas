import { describe, it, expect } from "vitest";
import {
  getAvailabilityCanvasStyle,
  AVAILABILITY_LEGEND_LABELS,
  AVAILABILITY_LEGEND_ORDER,
} from "./bookingCanvasUtils";

describe("getAvailabilityCanvasStyle", () => {
  it("returns a green fill for available status", () => {
    const style = getAvailabilityCanvasStyle("available", false);
    expect(style.fill).toBe("#DCFCE7");
    expect(style.stroke).toBe("#16A34A");
    expect(style.opacity).toBe(1);
  });

  it("returns a slate fill for reserved status", () => {
    const style = getAvailabilityCanvasStyle("reserved", false);
    expect(style.fill).toBe("#F1F5F9");
    expect(style.stroke).toBe("#94A3B8");
  });

  it("returns a blue fill for bookedByMe status", () => {
    const style = getAvailabilityCanvasStyle("bookedByMe", false);
    expect(style.fill).toBe("#DBEAFE");
    expect(style.stroke).toBe("#4F46E5");
  });

  it("returns an amber fill for unavailable status", () => {
    const style = getAvailabilityCanvasStyle("unavailable", false);
    expect(style.fill).toBe("#FEF3C7");
    expect(style.stroke).toBe("#D97706");
  });

  it("applies amber selection stroke when isSelected is true", () => {
    const style = getAvailabilityCanvasStyle("available", true);
    expect(style.stroke).toBe("#F59E0B");
    expect(style.strokeWidth).toBe(3);
    expect(style.opacity).toBe(1);
  });

  it("selected style preserves fill from base status", () => {
    const selected = getAvailabilityCanvasStyle("reserved", true);
    const unselected = getAvailabilityCanvasStyle("reserved", false);
    expect(selected.fill).toBe(unselected.fill);
  });

  it("each status returns a distinct fill", () => {
    const fills = (["available", "reserved", "bookedByMe", "unavailable"] as const).map(
      (s) => getAvailabilityCanvasStyle(s, false).fill
    );
    const unique = new Set(fills);
    expect(unique.size).toBe(4);
  });
});

describe("AVAILABILITY_LEGEND_LABELS", () => {
  it("has a human-readable label for each status", () => {
    expect(AVAILABILITY_LEGEND_LABELS.available).toBe("Available");
    expect(AVAILABILITY_LEGEND_LABELS.reserved).toBe("Reserved");
    expect(AVAILABILITY_LEGEND_LABELS.bookedByMe).toBe("Your booking");
    expect(AVAILABILITY_LEGEND_LABELS.unavailable).toBe("Unavailable");
  });
});

describe("AVAILABILITY_LEGEND_ORDER", () => {
  it("contains all four statuses", () => {
    expect(AVAILABILITY_LEGEND_ORDER).toHaveLength(4);
    expect(AVAILABILITY_LEGEND_ORDER).toContain("available");
    expect(AVAILABILITY_LEGEND_ORDER).toContain("reserved");
    expect(AVAILABILITY_LEGEND_ORDER).toContain("bookedByMe");
    expect(AVAILABILITY_LEGEND_ORDER).toContain("unavailable");
  });
});
