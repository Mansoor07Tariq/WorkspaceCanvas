import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfficeCreationFlow } from "../components/OfficeCreationFlow";
import { ApiError } from "@/lib/api/apiError";

vi.mock("../api/officeApi", () => ({
  createOffice: vi.fn(),
}));

vi.mock("@/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => false,
}));

import { createOffice } from "../api/officeApi";

const mockCreateOffice = vi.mocked(createOffice);

const mockOffice = {
  id: 1,
  name: "Dublin Office",
  slug: "dublin-office",
  address_line_1: "",
  address_line_2: "",
  city: "",
  county_or_state: "",
  country: "",
  timezone: "",
  is_active: true,
  created_at: "",
  updated_at: "",
};

describe("OfficeCreationFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders welcome step initially", () => {
    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    expect(screen.getByText(/create your first office/i)).toBeInTheDocument();
  });

  it("advances to name step on Get started click", () => {
    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByLabelText(/office name/i)).toBeInTheDocument();
  });

  it("blocks advance with empty name", () => {
    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/office name is required/i)).toBeInTheDocument();
  });

  it("advances from name to location step with valid name", () => {
    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(screen.getByLabelText(/office name/i), {
      target: { value: "Dublin Office" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
  });

  it("advances from location to review step", () => {
    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(screen.getByLabelText(/office name/i), {
      target: { value: "Dublin Office" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/review and create/i)).toBeInTheDocument();
    expect(screen.getByText("Dublin Office")).toBeInTheDocument();
  });

  it("blocks location advance with invalid timezone", () => {
    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(screen.getByLabelText(/office name/i), {
      target: { value: "Dublin Office" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/timezone/i), {
      target: { value: "Not A Timezone" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/valid iana timezone/i)).toBeInTheDocument();
  });

  it("calls createOffice and onCreated on submit", async () => {
    mockCreateOffice.mockResolvedValue(mockOffice);
    const onCreated = vi.fn();

    render(<OfficeCreationFlow onCreated={onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(screen.getByLabelText(/office name/i), {
      target: { value: "Dublin Office" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /create office/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(mockOffice));
  });

  it("shows API error on submit failure", async () => {
    mockCreateOffice.mockRejectedValue(new ApiError(500, { detail: "Server error" }));

    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(screen.getByLabelText(/office name/i), {
      target: { value: "Dublin Office" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /create office/i }));

    await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
  });

  it("back button returns to previous step", () => {
    render(<OfficeCreationFlow onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(screen.getByLabelText(/office name/i), {
      target: { value: "Dublin Office" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByLabelText(/office name/i)).toBeInTheDocument();
  });
});
