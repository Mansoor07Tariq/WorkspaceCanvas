import { useCallback, useState } from "react";
import { FLOOR_SETUP_STEPS, type FloorSetupStepId } from "./steps";

export interface UseFloorSetupStepsResult {
  stepId: FloorSetupStepId;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  goTo: (id: FloorSetupStepId) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

/**
 * Local step state for the floor setup wizard. Free navigation (goTo any step);
 * next/prev are clamped to the ends.
 */
export function useFloorSetupSteps(initial: FloorSetupStepId = "build"): UseFloorSetupStepsResult {
  const [stepId, setStepId] = useState<FloorSetupStepId>(initial);
  const index = FLOOR_SETUP_STEPS.indexOf(stepId);
  const total = FLOOR_SETUP_STEPS.length;

  const goTo = useCallback((id: FloorSetupStepId) => setStepId(id), []);
  const next = useCallback(
    () =>
      setStepId(
        (cur) => FLOOR_SETUP_STEPS[Math.min(FLOOR_SETUP_STEPS.indexOf(cur) + 1, total - 1)]
      ),
    [total]
  );
  const prev = useCallback(
    () => setStepId((cur) => FLOOR_SETUP_STEPS[Math.max(FLOOR_SETUP_STEPS.indexOf(cur) - 1, 0)]),
    []
  );
  const reset = useCallback(() => setStepId("build"), []);

  return {
    stepId,
    index,
    total,
    isFirst: index <= 0,
    isLast: index >= total - 1,
    goTo,
    next,
    prev,
    reset,
  };
}
