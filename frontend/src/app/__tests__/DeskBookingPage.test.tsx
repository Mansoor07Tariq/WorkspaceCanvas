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

// Mock BookingFloorMap to avoid pulling in Konva and lazy-loading in unit tests.
// Interaction and availability prop tests are covered in BookingFloorMap.test.tsx.
vi.mock("@/features/bookings/components/BookingFloorMap", () => ({
  BookingFloorMap: ({ selectedDeskId }: { selectedDeskId: number | null }) => (
    <div data-testid="mock-booking-floor-map" data-selected-desk={selectedDeskId ?? "none"} />
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DeskBookingPage />
    </MemoryRouter>
  );
}

describe("DeskBookingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Desk Booking heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Desk Booking" })).toBeInTheDocument();
  });

  it("renders office and floor selects", () => {
    renderPage();
    expect(screen.getByTestId("office-select")).toBeInTheDocument();
    expect(screen.getByTestId("floor-select")).toBeInTheDocument();
  });

  it("renders the booking date input", () => {
    renderPage();
    expect(screen.getByLabelText("Booking Date")).toBeInTheDocument();
  });

  it("shows prompt to select office and floor when none selected", () => {
    renderPage();
    expect(
      screen.getByText("Select an office and floor to view desk availability.")
    ).toBeInTheDocument();
  });

  it("page heading is an h1 element with text 'Desk Booking'", () => {
    renderPage();
    const heading = screen.getByRole("heading", { name: "Desk Booking", level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });

  it("floor map is not rendered before a floor is selected", () => {
    renderPage();
    expect(screen.queryByTestId("mock-booking-floor-map")).not.toBeInTheDocument();
    expect(screen.queryByText("Floor map")).not.toBeInTheDocument();
  });

  it("does not expose any other user's name in the initial render", () => {
    const { container } = renderPage();
    // Privacy guard: no user identity data should appear at page level
    expect(container.textContent).not.toContain("Jane Smith");
    expect(container.textContent).not.toContain("user_name");
  });
});
