/**
 * Floor setup wizard (PR 064) — the guided build flow.
 *
 * Steps are GUIDANCE, not gates: the admin can jump to any step at any time.
 * Step state is local UI only; the persisted lifecycle is `floor.status`
 * (draft while building/editing → published on finish).
 */
export type FloorSetupStepId = "build" | "openings" | "tidy" | "review";

export const FLOOR_SETUP_STEPS: FloorSetupStepId[] = ["build", "openings", "tidy", "review"];

export const isFloorSetupStep = (v: string): v is FloorSetupStepId =>
  (FLOOR_SETUP_STEPS as string[]).includes(v);
