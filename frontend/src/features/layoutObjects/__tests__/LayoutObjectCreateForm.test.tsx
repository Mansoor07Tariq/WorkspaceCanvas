import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LayoutObjectCreateForm } from "../components/LayoutObjectCreateForm";
import type { LayoutObjectFieldErrors, LayoutObjectFormFields } from "../types/layoutObject.types";
import { makeDefaultFields } from "../utils/layoutObjectValidation";

const defaultFields: LayoutObjectFormFields = {
  ...makeDefaultFields("desk"),
  object_type: "desk",
};

const noErrors: LayoutObjectFieldErrors = {};

function renderForm(
  overrides: Partial<{
    fields: LayoutObjectFormFields;
    fieldErrors: LayoutObjectFieldErrors;
    submissionLoading: boolean;
    submissionError: string | undefined;
    onFieldChange: () => void;
    onSubmit: () => void;
  }> = {}
) {
  const onFieldChange = overrides.onFieldChange ?? vi.fn();
  const onSubmit = overrides.onSubmit ?? vi.fn();
  render(
    <LayoutObjectCreateForm
      fields={overrides.fields ?? defaultFields}
      fieldErrors={overrides.fieldErrors ?? noErrors}
      submissionLoading={overrides.submissionLoading ?? false}
      submissionError={overrides.submissionError}
      onFieldChange={onFieldChange}
      onSubmit={onSubmit}
    />
  );
  return { onFieldChange, onSubmit };
}

describe("LayoutObjectCreateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Add object title and button", () => {
    renderForm();
    expect(screen.getAllByText(/add object/i).length).toBeGreaterThanOrEqual(2);
  });

  it("renders the object type select", () => {
    renderForm();
    expect(screen.getByLabelText(/object type/i)).toBeInTheDocument();
  });

  it("renders the label field", () => {
    renderForm();
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
  });

  it("renders position and size fields", () => {
    renderForm();
    expect(screen.getByLabelText(/x position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/y position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/height/i)).toBeInTheDocument();
  });

  it("renders the bookable checkbox", () => {
    renderForm();
    expect(screen.getByLabelText(/bookable/i)).toBeInTheDocument();
  });

  it("calls onSubmit when Add object button is clicked", () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: /add object/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows field error for object_type", () => {
    renderForm({
      fieldErrors: { object_type: "Select an object type." },
    });
    expect(screen.getByText(/select an object type/i)).toBeInTheDocument();
  });

  it("shows field error for width", () => {
    renderForm({
      fieldErrors: { width: "Must be greater than 0." },
    });
    expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument();
  });

  it("shows submission error when provided", () => {
    renderForm({ submissionError: "Server error occurred." });
    expect(screen.getByText(/server error occurred/i)).toBeInTheDocument();
  });

  it("disables submit button when loading", () => {
    renderForm({ submissionLoading: true });
    expect(screen.getByRole("button", { name: /add object/i })).toBeDisabled();
  });

  it("calls onFieldChange with label value when label changes", async () => {
    const onFieldChange = vi.fn();
    renderForm({ onFieldChange });
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: "Desk A1" },
    });
    await waitFor(() => {
      expect(onFieldChange).toHaveBeenCalledWith("label", "Desk A1");
    });
  });
});
