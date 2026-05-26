export type ProfileFieldErrors = {
  fullName?: string;
  phoneNumber?: string;
};

export const ONBOARDING_STEPS = [
  "welcome",
  "name",
  "email",
  "workDetails",
  "avatar",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
