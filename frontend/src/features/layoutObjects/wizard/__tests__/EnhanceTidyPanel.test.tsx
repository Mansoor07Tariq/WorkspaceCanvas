import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnhanceTidyPanel } from "../EnhanceTidyPanel";
import type { UseEnhanceTidyResult } from "../../hooks/useEnhanceTidy";

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

const suggestion = {
  id: "tidy-arrange",
  title: "Standing desks are unevenly spaced",
  description: "I can align and space them.",
  objectIds: [1, 2],
  reasonCodes: ["arranged"],
  severity: "info" as const,
};

const previewPlan = {
  operations: [],
  diagnostics: [],
  summary: { changed: 2, unchanged: 0, warnings: 0, iterations: 1, converged: true },
};

describe("EnhanceTidyPanel", () => {
  it("idle shows a button that opens the preview", () => {
    const openPreview = vi.fn();
    render(<EnhanceTidyPanel tidy={makeTidy({ openPreview })} />);
    fireEvent.click(screen.getByRole("button", { name: /tidy layout/i }));
    expect(openPreview).toHaveBeenCalledTimes(1);
  });

  it("preview lists suggestions with checkboxes and applies the selection", () => {
    const apply = vi.fn();
    const toggleSuggestion = vi.fn();
    render(
      <EnhanceTidyPanel
        tidy={makeTidy({
          phase: "preview",
          plan: previewPlan,
          suggestions: [suggestion],
          selectedSuggestionIds: new Set(["tidy-arrange"]),
          selectedObjectCount: 2,
          selectedOperationCount: 2,
          canApply: true,
          apply,
          toggleSuggestion,
        })}
      />
    );
    expect(screen.getByText(/Standing desks are unevenly spaced/i)).toBeInTheDocument();
    const box = screen.getByRole("checkbox");
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(toggleSuggestion).toHaveBeenCalledWith("tidy-arrange");
    fireEvent.click(screen.getByRole("button", { name: /apply selected/i }));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("result shows the summary", () => {
    render(
      <EnhanceTidyPanel
        tidy={makeTidy({
          phase: "result",
          result: {
            enhance_run_id: 1,
            status: "success",
            applied_count: 2,
            failed_count: 0,
            skipped_count: 0,
            operation_results: [],
            updated_objects: [],
          },
          lastAction: "apply",
        })}
      />
    );
    expect(screen.getByText(/2 updated · 0 failed · 0 skipped/i)).toBeInTheDocument();
  });
});
