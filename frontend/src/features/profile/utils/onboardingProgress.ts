// Maps step index (0-5) to profile completion percentage shown in UI.
const STEP_PERCENTS: Record<number, number> = {
  0: 15, // welcome
  1: 30, // name
  2: 45, // email
  3: 65, // workDetails
  4: 82, // avatar
  5: 100, // done
};

export function getProfileCompletionPercent(stepIndex: number): number {
  return STEP_PERCENTS[stepIndex] ?? 0;
}
