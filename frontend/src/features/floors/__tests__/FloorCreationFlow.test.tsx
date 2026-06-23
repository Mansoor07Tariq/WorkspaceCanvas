import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FloorCreationFlow } from "../components/FloorCreationFlow";
import { ApiError } from "@/lib/api/apiError";

vi.mock("../api/floorApi", () => ({
  createFloor: vi.fn(),
}));

vi.mock("@/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => false,
}));

import { createFloor } from "../api/floorApi";

const mockCreateFloor = vi.mocked(createFloor);

const mockFloor = {
  id: 1,
  organization: 1,
  office: 42,
  name: "Ground Floor",
  slug: "ground-floor",
  level_number: 0,
  is_active: true,
  created_at: "",
  updated_at: "",
  boundary_width: "904",
  boundary_height: "544",
  status: "published" as const,
};

const defaultProps = {
  officeId: 42,
  onCreated: vi.fn(),
  onCancel: vi.fn(),
};

describe("FloorCreationFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders details step initially", () => {
    render(<FloorCreationFlow {...defaultProps} />);
    expect(screen.getByRole("heading", { name: /floor details/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/floor name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/level number/i)).toBeInTheDocument();
  });

  it("blocks advance with empty name", () => {
    render(<FloorCreationFlow {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/floor name/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/floor name is required/i)).toBeInTheDocument();
  });

  it("blocks advance with invalid level number", () => {
    render(<FloorCreationFlow {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/floor name/i), {
      target: { value: "Ground Floor" },
    });
    fireEvent.change(screen.getByLabelText(/level number/i), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/must be an integer/i)).toBeInTheDocument();
  });

  it("advances to review step with valid inputs", () => {
    render(<FloorCreationFlow {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/floor name/i), {
      target: { value: "Ground Floor" },
    });
    fireEvent.change(screen.getByLabelText(/level number/i), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/review and create/i)).toBeInTheDocument();
    expect(screen.getByText("Ground Floor")).toBeInTheDocument();
  });

  it("calls createFloor and onCreated on submit", async () => {
    mockCreateFloor.mockResolvedValue(mockFloor);
    const onCreated = vi.fn();

    render(<FloorCreationFlow {...defaultProps} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/floor name/i), {
      target: { value: "Ground Floor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /create floor/i }));

    await waitFor(() => {
      expect(mockCreateFloor).toHaveBeenCalledWith(42, {
        name: "Ground Floor",
        level_number: 0,
      });
      expect(onCreated).toHaveBeenCalledWith(mockFloor);
    });
  });

  it("shows API error on submit failure", async () => {
    mockCreateFloor.mockRejectedValue(new ApiError(400, { detail: "Level taken" }));

    render(<FloorCreationFlow {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/floor name/i), {
      target: { value: "Ground Floor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /create floor/i }));

    await waitFor(() => expect(screen.getByText(/level taken/i)).toBeInTheDocument());
  });

  it("back button on review returns to details", () => {
    render(<FloorCreationFlow {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/floor name/i), {
      target: { value: "Ground Floor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByLabelText(/floor name/i)).toBeInTheDocument();
  });

  it("cancel button on first step calls onCancel", () => {
    const onCancel = vi.fn();
    render(<FloorCreationFlow {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
