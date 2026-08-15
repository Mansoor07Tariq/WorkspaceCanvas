import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { TodayContent } from "../TodayContent";
import type { TodayData, DaySummary } from "../../hooks/useTodayData";
import type { OccupantPoint, WeekDay } from "../../utils/todayLogic";
import { en } from "@/i18n/en";

// ─── mocks ──────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));

// The hero uses the real pure-SVG FloorOverviewMap (no Konva) — no mock needed. Stub the
// map only to keep the deep-link assertion focused on the navigation params.
vi.mock("../FloorOverviewMap", () => ({
  FloorOverviewMap: ({ onBackgroundClick }: { onBackgroundClick: () => void }) => (
    <button data-testid="floor-map" onClick={onBackgroundClick}>
      map
    </button>
  ),
}));

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({ user: { first_name: "Mansoor", full_name: "Mansoor Tariq" } }),
}));

const mockSummary = vi.fn();
vi.mock("@/features/dashboard/hooks/useWorkspaceSummary", () => ({
  useWorkspaceSummary: () => mockSummary(),
}));

const mockSelectedOrg = vi.fn();
vi.mock("@/features/organizations/context/SelectedOrganizationProvider", () => ({
  useSelectedOrganization: () => mockSelectedOrg(),
}));

const mockUseTodayData = vi.fn();
vi.mock("../../hooks/useTodayData", () => ({
  useTodayData: () => mockUseTodayData(),
}));

// Control the office-local hour so the 14:00 "Plan tomorrow" flip is deterministic.
let mockHour = 9;
vi.mock("../../utils/todayLogic", async (orig) => {
  const actual = await orig<typeof import("../../utils/todayLogic")>();
  return { ...actual, officeLocalHour: () => mockHour };
});

// ─── fixtures ─────────────────────────────────────────────────────────────────
function weekDay(i: number): WeekDay {
  return {
    date: new Date(2026, 7, 10 + i),
    iso: `2026-08-1${i}`,
    dayNumber: 10 + i,
    dayLabel: ["Mon", "Tue", "Wed", "Thu", "Fri"][i],
    isToday: i === 0,
    isWeekend: false,
  };
}

function occupant(deskId: number, name: string, x: number): OccupantPoint {
  return { deskId, layoutObjectId: deskId, userId: deskId, userName: name, isMine: false, x, y: 0 };
}

function baseData(overrides: Partial<TodayData> = {}): TodayData {
  const week = [0, 1, 2, 3, 4].map(weekDay);
  const days: DaySummary[] = week.map((day) => ({
    day,
    bookings: [],
    myBooking: null,
    others: [],
    loading: false,
  }));
  return {
    orgId: 1,
    orgName: "Acme",
    offices: [{ id: 1, name: "Dublin HQ", slug: "dublin", timezone: "Europe/Dublin" } as never],
    selectedOffice: {
      id: 1,
      name: "Dublin HQ",
      slug: "dublin",
      timezone: "Europe/Dublin",
    } as never,
    selectOffice: vi.fn(),
    defaultOfficeId: 1,
    floors: [{ id: 5, name: "Floor 2" } as never],
    selectedFloor: {
      id: 5,
      name: "Floor 2",
      boundary_width: "600",
      boundary_height: "400",
    } as never,
    selectFloor: vi.fn(),
    week,
    selectedDayIndex: 0,
    selectDay: vi.fn(),
    days,
    selectedDayBookings: [],
    occupants: [],
    myOccupant: null,
    usualDesk: { id: 3 } as never,
    usualDeskPoint: { x: 0, y: 0 },
    layoutObjects: [],
    boundary: undefined,
    availability: {
      items: [],
      counts: { available: 7, reserved: 0, bookedByMe: 0, unavailable: 0, myBooking: null },
      myBooking: null,
    },
    loading: { offices: false, floors: false, map: false, week: false },
    errors: { offices: null, floors: null, map: null, usualDesk: undefined },
    ...overrides,
  };
}

function renderToday() {
  return render(
    <MemoryRouter>
      <TodayContent />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHour = 9; // morning by default → no "Plan tomorrow" emphasis
  mockSelectedOrg.mockReturnValue({
    selectedMembership: { organization_id: 1, organization_name: "Acme", role: "member" },
  });
  mockSummary.mockReturnValue({
    summary: { has_offices: true, has_floors: true, has_bookable_desks: true },
  });
});

describe("TodayContent — header + greeting", () => {
  it("greets by name and shows the office chip with the DEFAULT badge", () => {
    mockUseTodayData.mockReturnValue(baseData());
    renderToday();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Mansoor/);
    expect(screen.getByText("Dublin HQ")).toBeInTheDocument();
    expect(screen.getByText(en.app.today.defaultBadge)).toBeInTheDocument();
  });
});

describe("TodayContent — booked vs not-booked footer", () => {
  it("shows 'Book for {day}' with the free count when not booked", () => {
    mockUseTodayData.mockReturnValue(baseData());
    renderToday();
    expect(screen.getByText(/Book for Mon · 7 free/)).toBeInTheDocument();
  });

  it("shows 'You're at Desk N' when booked that day", () => {
    const data = baseData();
    data.days[0].myBooking = { desk_code: "A1" } as never;
    mockUseTodayData.mockReturnValue(data);
    renderToday();
    expect(screen.getByText(/You're at Desk A1/)).toBeInTheDocument();
  });
});

describe("TodayContent — near you + hover highlight", () => {
  it("ranks ≤3 people and dims others when one is hovered", async () => {
    const user = userEvent.setup();
    const occupants = [
      occupant(11, "Sarah Kelly", 10),
      occupant(12, "Tom Byrne", 20),
      occupant(13, "Aoife Nolan", 30),
      occupant(14, "James Murphy", 40),
    ];
    mockUseTodayData.mockReturnValue(baseData({ occupants, usualDeskPoint: { x: 0, y: 0 } }));
    renderToday();

    // 3 nearest shown; the 4th surfaces via "+N more".
    expect(screen.getByText("Sarah Kelly")).toBeInTheDocument();
    expect(screen.getByText("Tom Byrne")).toBeInTheDocument();
    expect(screen.getByText("Aoife Nolan")).toBeInTheDocument();
    expect(screen.queryByText("James Murphy")).not.toBeInTheDocument();
    expect(screen.getByText(/\+1 more in the office/)).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    const sarahRow = rows.find((r) => within(r).queryByText("Sarah Kelly"))!;
    const tomRow = rows.find((r) => within(r).queryByText("Tom Byrne"))!;
    expect(tomRow.getAttribute("data-dimmed")).toBe("false");
    await user.hover(sarahRow);
    // Hovering Sarah dims the other rows and marks hers active.
    expect(tomRow.getAttribute("data-dimmed")).toBe("true");
    expect(sarahRow.getAttribute("data-active")).toBe("true");
  });
});

describe("TodayContent — afternoon 'Plan tomorrow' flip (14:00 office-local)", () => {
  it("does NOT show the flip in the morning", () => {
    mockHour = 9;
    mockUseTodayData.mockReturnValue(baseData());
    renderToday();
    expect(screen.queryByText(en.app.today.planTomorrowTitle)).not.toBeInTheDocument();
  });

  it("shows the flip after 14:00 when unbooked, and books tomorrow", async () => {
    const user = userEvent.setup();
    mockHour = 15;
    mockUseTodayData.mockReturnValue(baseData());
    renderToday();
    expect(screen.getByText(en.app.today.planTomorrowTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: en.app.today.planTomorrowCta }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("office=1&floor=5&date="));
  });

  it("does NOT show the flip after 14:00 when already booked today", () => {
    mockHour = 15;
    const data = baseData();
    data.days[0].myBooking = { desk_code: "A1" } as never;
    mockUseTodayData.mockReturnValue(data);
    renderToday();
    expect(screen.queryByText(en.app.today.planTomorrowTitle)).not.toBeInTheDocument();
  });
});

describe("TodayContent — states", () => {
  it("shows the welcome card for a brand-new user (no usual desk, empty week)", () => {
    mockUseTodayData.mockReturnValue(baseData({ usualDesk: null }));
    renderToday();
    expect(screen.getByText(en.app.today.welcomeTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.app.today.welcomeCta })).toBeInTheDocument();
  });

  it("does NOT show welcome when the usual-desk fetch errored (e.g. a throttled 429)", () => {
    // A returning user whose usual-desk read was rate-limited: usualDesk is null but the
    // fetch ERRORED — must fall back to the normal Today, not the brand-new welcome card.
    mockUseTodayData.mockReturnValue(
      baseData({
        usualDesk: null,
        errors: { offices: null, floors: null, map: null, usualDesk: "Too many requests" },
      })
    );
    renderToday();
    expect(screen.queryByText(en.app.today.welcomeTitle)).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: en.app.today.weekTitle })).toBeInTheDocument();
  });

  it("shows the admin setup banner for an admin of an incomplete workspace", () => {
    mockSelectedOrg.mockReturnValue({
      selectedMembership: { organization_id: 1, organization_name: "Acme", role: "admin" },
    });
    mockSummary.mockReturnValue({
      summary: { has_offices: true, has_floors: false, has_bookable_desks: false },
    });
    mockUseTodayData.mockReturnValue(baseData());
    renderToday();
    expect(screen.getByText(en.app.today.adminBannerTitle)).toBeInTheDocument();
  });

  it("shows a partial-failure note when the map endpoint is down (rest still renders)", () => {
    mockUseTodayData.mockReturnValue(
      baseData({ errors: { offices: null, floors: null, map: "boom", usualDesk: undefined } })
    );
    renderToday();
    expect(screen.getByText(en.app.today.mapUnavailable)).toBeInTheDocument();
    // The week strip still renders (never a blank page).
    expect(screen.getByRole("tablist", { name: en.app.today.weekTitle })).toBeInTheDocument();
  });
});

describe("TodayContent — navigation (deep links preserved)", () => {
  it("clicking the map books prefilled with office/floor/date", async () => {
    const user = userEvent.setup();
    mockUseTodayData.mockReturnValue(baseData());
    renderToday();
    await user.click(screen.getByTestId("floor-map"));
    expect(mockNavigate).toHaveBeenCalledWith("/app/bookings?office=1&floor=5&date=2026-08-10");
  });
});

describe("TodayContent — near-you empty state accounts for the viewer's booking", () => {
  it("says 'nobody yet' when the day is empty and the viewer isn't booked", () => {
    mockUseTodayData.mockReturnValue(baseData());
    renderToday();
    expect(screen.getByText(en.app.today.nobodyYet)).toBeInTheDocument();
    expect(screen.queryByText(en.app.today.justYouSoFar)).not.toBeInTheDocument();
  });

  it("says 'it's just you so far' when the viewer is booked but no one else is in", () => {
    const data = baseData();
    data.days[0].myBooking = { desk_code: "14" } as never;
    mockUseTodayData.mockReturnValue(data);
    renderToday();
    expect(screen.getByText(en.app.today.justYouSoFar)).toBeInTheDocument();
    expect(screen.queryByText(en.app.today.nobodyYet)).not.toBeInTheDocument();
  });
});
