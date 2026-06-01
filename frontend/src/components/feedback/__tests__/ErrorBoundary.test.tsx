import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";

// A child that throws during render
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test render error");
  }
  return <div data-testid="child-content">Hello</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error noise from React's error boundary logging during tests
  let consoleError: typeof console.error;
  let originalLocation: typeof window.location;

  beforeEach(() => {
    consoleError = console.error;
    console.error = vi.fn();
    originalLocation = window.location;
  });

  afterEach(() => {
    console.error = consoleError;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders children normally when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("catches a thrown child error and shows the fallback UI", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    // The child should not be visible
    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
  });

  it('shows "Something went wrong." message when an error is caught', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("shows the descriptive message when an error is caught", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Please refresh the page or try again.")).toBeInTheDocument();
  });

  it('shows a "Reload page" button when an error is caught', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
  });

  it("reload button calls window.location.reload", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadMock },
    });

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: /reload page/i }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("renders a custom fallback prop when provided and an error is caught", () => {
    const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
  });

  it("has role=alert on the fallback container for accessibility", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    // getAllByRole handles multiple alert roles (the outer Box + MUI Alert both carry role="alert")
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});
