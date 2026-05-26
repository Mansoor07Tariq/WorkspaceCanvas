import type { OnboardingStep } from "../types/profile.types";

const STEP_PERCENTS: Record<OnboardingStep, number> = {
  welcome: 15,
  name: 30,
  email: 45,
  workDetails: 65,
  avatar: 82,
  done: 100,
};

export function getProfileCompletionPercent(step: OnboardingStep): number {
  return STEP_PERCENTS[step];
}
