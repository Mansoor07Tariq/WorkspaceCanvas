import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFloorSetupSteps } from "../useFloorSetupSteps";

describe("useFloorSetupSteps", () => {
  it("starts on build and reports position", () => {
    const { result } = renderHook(() => useFloorSetupSteps());
    expect(result.current.stepId).toBe("build");
    expect(result.current.index).toBe(0);
    expect(result.current.total).toBe(4);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
  });

  it("navigates freely with goTo", () => {
    const { result } = renderHook(() => useFloorSetupSteps());
    act(() => result.current.goTo("review"));
    expect(result.current.stepId).toBe("review");
    expect(result.current.isLast).toBe(true);
  });

  it("next/prev are clamped to the ends", () => {
    const { result } = renderHook(() => useFloorSetupSteps());
    act(() => result.current.prev());
    expect(result.current.stepId).toBe("build"); // clamped at start
    act(() => result.current.next());
    expect(result.current.stepId).toBe("openings");
    act(() => result.current.goTo("review"));
    act(() => result.current.next());
    expect(result.current.stepId).toBe("review"); // clamped at end
  });

  it("reset returns to build", () => {
    const { result } = renderHook(() => useFloorSetupSteps("tidy"));
    expect(result.current.stepId).toBe("tidy");
    act(() => result.current.reset());
    expect(result.current.stepId).toBe("build");
  });
});
