import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Desk } from "../types/desk.types";

vi.mock("../api/deskApi");
import { updateDesk } from "../api/deskApi";
const mockUpdateDesk = vi.mocked(updateDesk);

vi.mock("@/lib/api/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/apiClient")>();
  return {
    ...actual,
    ApiError: class ApiError extends Error {
      status: number;
      data: unknown;
      constructor(status: number, data: unknown) {
        super("ApiError");
        this.status = status;
        this.data = data;
      }
    },
  };
});

import { ApiError } from "@/lib/api/apiClient";
import { DeskEditForm } from "../components/DeskEditForm";

function makeDesk(overrides: Partial<Desk> = {}): Desk {
  return {
    id: 1,
    organization: 1,
    office: 2,
    floor: 3,
    layout_object: 10,
    layout_object_type: "desk",
    layout_object_label: "Desk A1",
    name: "Desk A1",
    code: "A1",
    status: "available",
    status_display: "Available",
    amenities: { monitor: true },
    notes: "Window seat",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const defaultProps = {
  officeId: 2,
  floorId: 3,
  onSaved: vi.fn(),
  onCancel: vi.fn(),
};

describe("DeskEditForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pre-fills form fields from desk", () => {
    const desk = makeDesk({ name: "Desk B2", code: "B2", notes: "Near kitchen" });
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    expect(screen.getByTestId("desk-edit-name-input")).toHaveValue("Desk B2");
    expect(screen.getByTestId("desk-edit-code-input")).toHaveValue("B2");
    expect(screen.getByTestId("desk-edit-notes-input")).toHaveValue("Near kitchen");
  });

  it("pre-fills status from desk", () => {
    const desk = makeDesk({ status: "maintenance" });
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    expect(screen.getByTestId("desk-edit-status-select")).toHaveValue("maintenance");
  });

  it("save button disabled when name is empty", () => {
    const desk = makeDesk({ name: "" });
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    expect(screen.getByTestId("desk-edit-submit")).toBeDisabled();
  });

  it("save button disabled while saving", async () => {
    let resolveSave!: (v: Desk) => void;
    mockUpdateDesk.mockReturnValue(new Promise((r) => (resolveSave = r)));
    const desk = makeDesk();
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() => expect(screen.getByTestId("desk-edit-submit")).toBeDisabled());
    resolveSave(desk);
  });

  it("successful save calls onSaved", async () => {
    mockUpdateDesk.mockResolvedValue(makeDesk({ name: "Updated" }));
    const onSaved = vi.fn();
    const desk = makeDesk();
    render(<DeskEditForm {...defaultProps} desk={desk} onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId("desk-edit-name-input"), {
      target: { value: "Updated" },
    });
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("failed save shows generic error message", async () => {
    mockUpdateDesk.mockRejectedValue(new Error("Server error"));
    const desk = makeDesk();
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() => expect(screen.getByText(/could not update desk/i)).toBeInTheDocument());
  });

  it("403 error shows permission error message", async () => {
    mockUpdateDesk.mockRejectedValue(new ApiError(403, { detail: "Forbidden" }));
    const desk = makeDesk();
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() =>
      expect(screen.getByText(/you do not have permission to edit this desk/i)).toBeInTheDocument()
    );
  });

  it("cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(<DeskEditForm {...defaultProps} desk={makeDesk()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("desk-edit-cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("updateDesk is called with trimmed name and code", async () => {
    mockUpdateDesk.mockResolvedValue(makeDesk());
    const desk = makeDesk({ name: "  Desk A1  ", code: "  A1  " });
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() => expect(mockUpdateDesk).toHaveBeenCalled());
    const payload = mockUpdateDesk.mock.calls[0][3];
    expect(payload.name).toBe("Desk A1");
    expect(payload.code).toBe("A1");
  });

  it("clearing the code field sends empty string to allow removing existing code", async () => {
    mockUpdateDesk.mockResolvedValue(makeDesk({ code: "" }));
    const desk = makeDesk({ code: "A1" });
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    fireEvent.change(screen.getByTestId("desk-edit-code-input"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() => expect(mockUpdateDesk).toHaveBeenCalled());
    const payload = mockUpdateDesk.mock.calls[0][3];
    expect(payload.code).toBe("");
    expect("code" in payload).toBe(true);
  });

  it("400 with code field error shows backend message", async () => {
    mockUpdateDesk.mockRejectedValue(
      new ApiError(400, { code: ["A desk with this code already exists in this office."] })
    );
    const desk = makeDesk();
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() =>
      expect(screen.getByText(/a desk with this code already exists/i)).toBeInTheDocument()
    );
  });

  it("updateDesk payload includes amenities and notes", async () => {
    mockUpdateDesk.mockResolvedValue(makeDesk());
    const desk = makeDesk({ amenities: { monitor: true }, notes: "Quiet zone" });
    render(<DeskEditForm {...defaultProps} desk={desk} />);
    fireEvent.click(screen.getByTestId("desk-edit-submit"));
    await waitFor(() => expect(mockUpdateDesk).toHaveBeenCalled());
    const payload = mockUpdateDesk.mock.calls[0][3];
    expect(payload.amenities).toEqual({ monitor: true });
    expect(payload.notes).toBe("Quiet zone");
  });
});
