import { describe, it, expect } from "vitest";
import { getLayoutObjectNodeStyle } from "../utils/layoutObjectNodeStyle";
import {
  SELECTED_STROKE,
  SELECTED_STROKE_WIDTH,
  getLayoutObjectRenderConfig,
} from "../utils/layoutObjectRenderConfig";
import { getAvailabilityCanvasStyle } from "@/features/bookings/utils/bookingCanvasUtils";

// TD-032: the canvas node delegates its fill/stroke/opacity/dash decision to
// this pure selector. Assertions compare against the SAME source-of-truth
// helpers the node would have used, so a constant change is caught here too.

describe("getLayoutObjectNodeStyle — booking mode (availability)", () => {
  const cases = ["available", "reserved", "bookedByMe", "unavailable"] as const;

  for (const status of cases) {
    it(`uses the availability palette for "${status}"`, () => {
      const expected = getAvailabilityCanvasStyle(status, false);
      const style = getLayoutObjectNodeStyle({
        objectType: "desk",
        isSelected: false,
        availabilityStatus: status,
      });
      expect(style.fill).toBe(expected.fill);
      expect(style.stroke).toBe(expected.stroke);
      expect(style.strokeWidth).toBe(expected.strokeWidth);
      expect(style.opacity).toBe(expected.opacity);
    });
  }

  it("applies the booking selection highlight when isAvailabilitySelected", () => {
    const expected = getAvailabilityCanvasStyle("available", true);
    const style = getLayoutObjectNodeStyle({
      objectType: "desk",
      isSelected: false,
      availabilityStatus: "available",
      isAvailabilitySelected: true,
    });
    expect(style.stroke).toBe(expected.stroke);
    expect(style.strokeWidth).toBe(expected.strokeWidth);
  });

  it("ignores editor selection when an availability status is present", () => {
    const unselected = getLayoutObjectNodeStyle({
      objectType: "desk",
      isSelected: false,
      availabilityStatus: "available",
    });
    // isSelected=true must NOT switch to the editor selection palette in booking mode.
    const selected = getLayoutObjectNodeStyle({
      objectType: "desk",
      isSelected: true,
      availabilityStatus: "available",
    });
    expect(selected).toEqual(unselected);
    expect(selected.stroke).not.toBe(SELECTED_STROKE);
  });
});

describe("getLayoutObjectNodeStyle — editor mode (render config)", () => {
  it("uses the render config when no availability status is provided", () => {
    const config = getLayoutObjectRenderConfig("desk");
    const style = getLayoutObjectNodeStyle({ objectType: "desk", isSelected: false });
    expect(style.fill).toBe(config.fill);
    expect(style.stroke).toBe(config.stroke);
    expect(style.strokeWidth).toBe(config.strokeWidth);
    expect(style.opacity).toBe(config.opacity);
  });

  it("does not apply the booking availability palette in editor mode", () => {
    const availableStyle = getAvailabilityCanvasStyle("available", false);
    const style = getLayoutObjectNodeStyle({ objectType: "desk", isSelected: false });
    expect(style.fill).not.toBe(availableStyle.fill);
  });

  it("applies the editor selection highlight when isSelected", () => {
    const style = getLayoutObjectNodeStyle({ objectType: "desk", isSelected: true });
    expect(style.stroke).toBe(SELECTED_STROKE);
    expect(style.strokeWidth).toBe(SELECTED_STROKE_WIDTH);
  });

  it("passes through the dash pattern for dashed object types", () => {
    const config = getLayoutObjectRenderConfig("room");
    const style = getLayoutObjectNodeStyle({ objectType: "room", isSelected: false });
    expect(style.dash).toEqual(config.dashPattern);
  });

  it("returns undefined dash for solid object types", () => {
    const style = getLayoutObjectNodeStyle({ objectType: "desk", isSelected: false });
    expect(style.dash).toBeUndefined();
  });
});

describe("getLayoutObjectNodeStyle — saving state", () => {
  it("dims opacity while saving", () => {
    const normal = getLayoutObjectNodeStyle({ objectType: "desk", isSelected: false });
    const saving = getLayoutObjectNodeStyle({
      objectType: "desk",
      isSelected: false,
      isSaving: true,
    });
    expect(saving.opacity).toBeLessThan(normal.opacity);
    expect(saving.opacity).toBeGreaterThanOrEqual(0.35);
  });

  it("never dims below the 0.35 floor", () => {
    // room config has opacity 0.35 already; saving must not push it lower.
    const saving = getLayoutObjectNodeStyle({
      objectType: "room",
      isSelected: false,
      isSaving: true,
    });
    expect(saving.opacity).toBeGreaterThanOrEqual(0.35);
  });
});
