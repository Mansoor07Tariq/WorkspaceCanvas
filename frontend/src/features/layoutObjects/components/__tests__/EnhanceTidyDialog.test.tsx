import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnhanceTidyDialog } from "../EnhanceTidyDialog";
import type { UseEnhanceTidyResult } from "../../hooks/useEnhanceTidy";
import type { EnhancePlan } from "../../enhance";
import type { EnhanceRunResult } from "../../enhanceApply";

function makeTidy(over: Partial<UseEnhanceTidyResult> = {}): UseEnhanceTidyResult {
  return {
    phase: "idle",
    plan: null,
    suggestions: [],
    selectedSuggestionIds: new Set(),
    toggleSuggestion: vi.fn(),
    selectedObjectCount: 0,
    selectedOperationCount: 0,
    canApply: false,
    result: null,
    lastAction: null,
    busy: false,
    error: false,
    canUndo: false,
    canRetry: false,
    openPreview: vi.fn(),
    cancel: vi.fn(),
    apply: vi.fn(),
    undo: vi.fn(),
    retry: vi.fn(),
    close: vi.fn(),
    ...over,
  };
}

const suggestion = (id: string, title: string, objectIds: number[] = [1]) => ({
  id,
  title,
  description: "I can tidy this up.",
  objectIds,
  reasonCodes: ["arranged"],
  severity: "info" as const,
});

/** A preview tidy with the given suggestions all selected (Apply enabled). */
function previewTidy(
  suggestions: ReturnType<typeof suggestion>[],
  over: Partial<UseEnhanceTidyResult> = {}
): UseEnhanceTidyResult {
  const objectIds = new Set(suggestions.flatMap((s) => s.objectIds));
  return makeTidy({
    phase: "preview",
    plan: planWith(Math.max(1, objectIds.size)),
    suggestions,
    selectedSuggestionIds: new Set(suggestions.map((s) => s.id)),
    selectedObjectCount: objectIds.size,
    selectedOperationCount: objectIds.size,
    canApply: objectIds.size > 0,
    ...over,
  });
}

const planWith = (n: number): EnhancePlan => ({
  operations: Array.from({ length: n }, (_, i) => ({
    type: "updateObject" as const,
    objectId: i + 1,
    before: { x: "0.00", y: "0.00", width: "1.00", height: "1.00", rotation: "0.00" },
    after: { x: "1.00", y: "0.00", width: "1.00", height: "1.00", rotation: "0.00" },
    patch: { x: "1.00" },
    reasonCodes: ["repositioned" as const],
  })),
  diagnostics: [],
  summary: { changed: n, unchanged: 0, warnings: 0, iterations: 1, converged: true },
});

describe("EnhanceTidyDialog", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<EnhanceTidyDialog tidy={makeTidy()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("preview enables 'Apply selected' and applies when clicked", () => {
    const apply = vi.fn();
    render(
      <EnhanceTidyDialog
        tidy={previewTidy([suggestion("tidy-arrange", "A few desks are unevenly spaced", [1, 2])], {
          apply,
        })}
      />
    );
    const applyBtn = screen.getByRole("button", { name: /apply selected/i });
    expect(applyBtn).toBeEnabled();
    fireEvent.click(applyBtn);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("preview renders friendly suggestion titles and descriptions", () => {
    render(
      <EnhanceTidyDialog
        tidy={previewTidy([
          suggestion("tidy-arrange", "A few desks are unevenly spaced", [1, 2, 3]),
        ])}
      />
    );
    expect(screen.getByText(/I found a few small layout improvements/i)).toBeInTheDocument();
    expect(screen.getByText(/A few desks are unevenly spaced/i)).toBeInTheDocument();
  });

  it("renders a checkbox per suggestion and toggles selection", () => {
    const toggleSuggestion = vi.fn();
    render(
      <EnhanceTidyDialog
        tidy={previewTidy(
          [
            suggestion("tidy-arrange", "A few desks are unevenly spaced", [1]),
            suggestion("tidy-boundary", "A desk is outside the boundary", [2]),
          ],
          { toggleSuggestion }
        )}
      />
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeChecked();
    fireEvent.click(boxes[1]);
    expect(toggleSuggestion).toHaveBeenCalledWith("tidy-boundary");
  });

  it("disables 'Apply selected' when nothing is selected", () => {
    render(
      <EnhanceTidyDialog
        tidy={previewTidy([suggestion("tidy-arrange", "A few desks are unevenly spaced", [1])], {
          selectedSuggestionIds: new Set(),
          selectedObjectCount: 0,
          selectedOperationCount: 0,
          canApply: false,
        })}
      />
    );
    expect(screen.getByRole("button", { name: /apply selected/i })).toBeDisabled();
  });

  it("preview with no changes shows the clean message and disables Apply", () => {
    render(<EnhanceTidyDialog tidy={makeTidy({ phase: "preview", plan: planWith(0) })} />);
    expect(screen.getByText(/already looks tidy/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply selected/i })).toBeDisabled();
  });

  it("partial-success result shows summary, details, retry and undo", () => {
    const result: EnhanceRunResult = {
      enhance_run_id: 1,
      status: "partial_success",
      applied_count: 1,
      failed_count: 1,
      skipped_count: 0,
      operation_results: [
        { object_id: 1, status: "applied", reason_codes: [] },
        {
          object_id: 2,
          status: "failed",
          reason_codes: [],
          error_code: "validation_error",
          error_message: "Width must be positive.",
        },
      ],
      updated_objects: [],
    };
    const undo = vi.fn();
    const retry = vi.fn();
    render(
      <EnhanceTidyDialog
        tidy={makeTidy({
          phase: "result",
          result,
          lastAction: "apply",
          canUndo: true,
          canRetry: true,
          undo,
          retry,
        })}
      />
    );
    expect(screen.getByText(/1 updated · 1 failed · 0 skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/Width must be positive\./i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry failed/i }));
    expect(retry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /undo applied/i }));
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("cancel in preview calls cancel", () => {
    const cancel = vi.fn();
    render(<EnhanceTidyDialog tidy={makeTidy({ phase: "preview", plan: planWith(1), cancel })} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
