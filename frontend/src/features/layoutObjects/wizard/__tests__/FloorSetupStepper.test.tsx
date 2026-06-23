import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FloorSetupStepper } from "../FloorSetupStepper";

describe("FloorSetupStepper", () => {
  it("renders all steps and jumps when one is clicked", () => {
    const onStep = vi.fn();
    render(
      <FloorSetupStepper activeId="build" onStep={onStep} onNext={vi.fn()} onPrev={vi.fn()} />
    );
    expect(screen.getByTestId("floor-setup-stepper")).toBeInTheDocument();
    // Step labels (exact, so they don't collide with step descriptions).
    expect(screen.getByText("Tidy")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Review"));
    expect(onStep).toHaveBeenCalledWith("review");
  });

  it("Back is disabled on the first step", () => {
    render(
      <FloorSetupStepper activeId="build" onStep={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /^back$/i })).toBeDisabled();
  });

  it("Next calls onNext", () => {
    const onNext = vi.fn();
    render(
      <FloorSetupStepper activeId="build" onStep={vi.fn()} onNext={onNext} onPrev={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
