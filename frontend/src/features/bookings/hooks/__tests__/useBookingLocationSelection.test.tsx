import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useBookingLocationSelection } from "../useBookingLocationSelection";
import { saveLastOfficeFloor } from "../../utils/lastOfficeFloor";
import { tomorrowLocalDate } from "../../utils/bookingValidation";

// Ports the PR 071 deep-link + remembered-pair coverage so the shared hook owns it.

const mockUseOffices = vi.fn();
vi.mock("@/features/offices/hooks/useOffices", () => ({
  useOffices: () => mockUseOffices(),
}));

const mockUseFloors = vi.fn();
vi.mock("@/features/floors/hooks/useFloors", () => ({
  useFloors: (officeId: number) => mockUseFloors(officeId),
}));

function Probe() {
  const loc = useBookingLocationSelection(10);
  return (
    <div>
      <span data-testid="office">{String(loc.selectedOfficeId)}</span>
      <span data-testid="floor">{String(loc.selectedFloorId)}</span>
      <span data-testid="date">{loc.selectedDate}</span>
      <button onClick={() => loc.selectOffice(1)}>set-office</button>
      <button onClick={() => loc.selectFloor(10)}>set-floor</button>
    </div>
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="search">{loc.search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mockUseOffices.mockReturnValue({
    offices: [{ id: 1, name: "HQ" }],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockUseFloors.mockImplementation((officeId: number) => ({
    floors: officeId === 1 ? [{ id: 10, name: "Ground" }] : [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }));
});

describe("useBookingLocationSelection", () => {
  it("initialises office/floor/date from the URL", () => {
    const date = tomorrowLocalDate();
    renderAt(`/x?office=1&floor=10&date=${date}`);
    expect(screen.getByTestId("office")).toHaveTextContent("1");
    expect(screen.getByTestId("floor")).toHaveTextContent("10");
    expect(screen.getByTestId("date")).toHaveTextContent(date);
  });

  it("URL params win over the remembered pair", async () => {
    saveLastOfficeFloor(2, 20);
    renderAt("/x?office=1&floor=10");
    // The remembered (2/20) must NOT override the URL (1/10).
    await waitFor(() => expect(screen.getByTestId("office")).toHaveTextContent("1"));
    expect(screen.getByTestId("floor")).toHaveTextContent("10");
  });

  it("restores the remembered pair on a param-less arrival", async () => {
    saveLastOfficeFloor(1, 10);
    renderAt("/x");
    await waitFor(() => expect(screen.getByTestId("office")).toHaveTextContent("1"));
    await waitFor(() => expect(screen.getByTestId("floor")).toHaveTextContent("10"));
  });

  it("falls back silently when the remembered office is stale", async () => {
    saveLastOfficeFloor(999, 20); // office 999 is not in the loaded list
    renderAt("/x");
    // Let the restore effect run (it sees a stale office and gives up).
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("date="));
    expect(screen.getByTestId("office").textContent).toBe("");
    expect(screen.getByTestId("floor").textContent).toBe("");
  });

  it("syncs the current selection to the URL (replace)", async () => {
    const user = userEvent.setup();
    renderAt("/x");
    await user.click(screen.getByText("set-office"));
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("office=1"));
    expect(screen.getByTestId("office")).toHaveTextContent("1");
  });
});
