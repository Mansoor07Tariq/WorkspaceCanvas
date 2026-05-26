import { describe, it, expect } from "vitest";
import { getProfileCompletionPercent } from "../utils/onboardingProgress";
import { ONBOARDING_STEPS } from "../types/profile.types";

describe("getProfileCompletionPercent", () => {
  it("returns 15 for welcome step", () => {
    expect(getProfileCompletionPercent("welcome")).toBe(15);
  });

  it("returns 30 for name step", () => {
    expect(getProfileCompletionPercent("name")).toBe(30);
  });

  it("returns 45 for email step", () => {
    expect(getProfileCompletionPercent("email")).toBe(45);
  });

  it("returns 65 for work details step", () => {
    expect(getProfileCompletionPercent("workDetails")).toBe(65);
  });

  it("returns 82 for avatar step", () => {
    expect(getProfileCompletionPercent("avatar")).toBe(82);
  });

  it("returns 100 for done step", () => {
    expect(getProfileCompletionPercent("done")).toBe(100);
  });

  it("percent increases monotonically through all steps", () => {
    const percents = ONBOARDING_STEPS.map(getProfileCompletionPercent);
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThan(percents[i - 1]);
    }
  });
});
