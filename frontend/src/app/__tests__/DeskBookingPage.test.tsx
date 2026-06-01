import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DeskBookingPage } from "../pages/DeskBookingPage";

vi.mock("@/features/offices/hooks/useOffices", () => ({
  useOffices: () => ({ offices: [], loading: false, error: null, refresh: vi.fn() }),
}));

vi.mock("@/features/floors/hooks/useFloors", () => ({
  useFloors: () => ({ floors: [], loading: false, error: null, refresh: vi.fn() }),
}));

vi.mock("@/features/desks/hooks/useDesks", () => ({
  useDesks: () => ({ desks: [], loading: false, error: undefined, refresh: vi.fn() }),
}));

vi.mock("@/features/layoutObjects/hooks/useLayoutObjects", () => ({
  useLayoutObjects: () => ({
    objects: [],
    loading: false,
    error: undefined,
    refresh: vi.fn(),
    updateObjectLocally: vi.fn(),
    setSaving: vi.fn(),
    savingObjectIds: new Set(),
  }),
}));

vi.mock("@/features/bookings/hooks/useDeskBookings", () => ({
  useDeskBookings: () => ({ bookings: [], loading: false, error: undefined, refresh: vi.fn() }),
}));

describe("DeskBookingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Desk Booking heading", () => {
    render(
      <MemoryRouter>
        <DeskBookingPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Desk Booking" })).toBeInTheDocument();
  });

  it("renders office and floor selects", () => {
    render(
      <MemoryRouter>
        <DeskBookingPage />
      </MemoryRouter>
    );
    expect(screen.getByTestId("office-select")).toBeInTheDocument();
    expect(screen.getByTestId("floor-select")).toBeInTheDocument();
  });

  it("renders the booking date input", () => {
    render(
      <MemoryRouter>
        <DeskBookingPage />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("Booking Date")).toBeInTheDocument();
  });

  it("shows prompt to select office and floor when none selected", () => {
    render(
      <MemoryRouter>
        <DeskBookingPage />
      </MemoryRouter>
    );
    expect(
      screen.getByText("Select an office and floor to view desk availability.")
    ).toBeInTheDocument();
  });

  it("page heading is an h1 element with text 'Desk Booking'", () => {
    render(
      <MemoryRouter>
        <DeskBookingPage />
      </MemoryRouter>
    );
    const heading = screen.getByRole("heading", { name: "Desk Booking", level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });
});
