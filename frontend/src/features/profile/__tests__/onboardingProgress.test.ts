import { describe, it, expect } from "vitest";
import { getProfileCompletionPercent } from "../utils/onboardingProgress";

describe("getProfileCompletionPercent", () => {
  it("returns 15 for welcome step (index 0)", () => {
    expect(getProfileCompletionPercent(0)).toBe(15);
  });

  it("returns 30 for name step (index 1)", () => {
    expect(getProfileCompletionPercent(1)).toBe(30);
  });

  it("returns 45 for email step (index 2)", () => {
    expect(getProfileCompletionPercent(2)).toBe(45);
  });

  it("returns 65 for work details step (index 3)", () => {
    expect(getProfileCompletionPercent(3)).toBe(65);
  });

  it("returns 82 for avatar step (index 4)", () => {
    expect(getProfileCompletionPercent(4)).toBe(82);
  });

  it("returns 100 for done step (index 5)", () => {
    expect(getProfileCompletionPercent(5)).toBe(100);
  });

  it("percent increases monotonically through all steps", () => {
    const percents = [0, 1, 2, 3, 4, 5].map(getProfileCompletionPercent);
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThan(percents[i - 1]);
    }
  });

  it("returns 0 for unknown step index", () => {
    expect(getProfileCompletionPercent(99)).toBe(0);
  });
});
