import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "../AppSidebar";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";
import type { CurrentUser } from "@/features/auth/types/auth.types";

const mockUseAuth = vi.fn();

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const incompleteUser: CurrentUser = {
  id: 1,
  username: "user@example.com",
  email: "user@example.com",
  full_name: "",
  first_name: "",
  last_name: "",
  avatar: null,
  phone_number: "",
  job_title: "",
  timezone: "UTC",
  locale: "en",
  is_profile_completed: false,
  email_verified: true,
  preferred_auth_provider: "email",
  mfa_enabled: false,
  memberships: [],
};

const completeUser: CurrentUser = {
  ...incompleteUser,
  full_name: "Jane Smith",
  is_profile_completed: true,
};

function renderSidebar(user: CurrentUser | null = incompleteUser, initialPath = "/app") {
  mockUseAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppSidebar />
    </MemoryRouter>
  );
}

// Product items that require a completed profile (Today is always enabled).
const PRODUCT_LABELS = [
  en.app.sidebar.bookDesk,
  en.app.sidebar.bookRoom,
  en.app.sidebar.myBookingsNav,
  en.app.sidebar.people,
];

describe("AppSidebar — locked (profile incomplete)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the nav landmark", () => {
    renderSidebar();
    expect(
      screen.getByRole("navigation", { name: en.app.sidebar.primaryNavLabel })
    ).toBeInTheDocument();
  });

  it("Today item is always enabled", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: en.app.sidebar.today })).not.toBeDisabled();
  });

  it.each(PRODUCT_LABELS)("%s item is disabled when profile is incomplete", (label) => {
    renderSidebar();
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-disabled", "true");
  });

  it("disabled items are wrapped in a tooltip span", () => {
    const { container } = renderSidebar();
    const tooltipSpans = container.querySelectorAll("span[style*='width: 100%']");
    expect(tooltipSpans.length).toBe(PRODUCT_LABELS.length);
  });

  it("locked tooltip text is present in the DOM for disabled items", async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    const tooltipSpan = container.querySelectorAll("span[style*='width: 100%']")[0];
    await user.hover(tooltipSpan);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });
});

describe("AppSidebar — unlocked (profile complete)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("all five items are enabled", () => {
    renderSidebar(completeUser);
    [en.app.sidebar.today, ...PRODUCT_LABELS].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).not.toBeDisabled();
    });
  });

  it("no tooltip spans exist when profile is complete", () => {
    const { container } = renderSidebar(completeUser);
    expect(container.querySelectorAll("span[style*='width: 100%']").length).toBe(0);
  });
});

describe("AppSidebar — nav destinations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the five renamed destinations and not Offices/Dashboard/Events", () => {
    renderSidebar(completeUser);
    [
      en.app.sidebar.today,
      en.app.sidebar.bookDesk,
      en.app.sidebar.bookRoom,
      en.app.sidebar.myBookingsNav,
      en.app.sidebar.people,
    ].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: en.app.sidebar.offices })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.app.sidebar.events })).not.toBeInTheDocument();
  });
});

describe("AppSidebar — active item selection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Today button is selected when on /app", () => {
    renderSidebar(completeUser, ROUTES.app);
    const btn = screen.getByRole("button", { name: en.app.sidebar.today });
    expect(btn).toHaveClass("Mui-selected");
    expect(btn).toHaveAttribute("aria-current", "page");
  });

  it("Today button is not selected when on a different route", () => {
    renderSidebar(completeUser, ROUTES.bookings);
    const btn = screen.getByRole("button", { name: en.app.sidebar.today });
    expect(btn).not.toHaveClass("Mui-selected");
  });

  it("My bookings button is selected on the myBookings route (not Book a desk)", () => {
    renderSidebar(completeUser, ROUTES.myBookings);
    expect(screen.getByRole("button", { name: en.app.sidebar.myBookingsNav })).toHaveClass(
      "Mui-selected"
    );
    expect(screen.getByRole("button", { name: en.app.sidebar.bookDesk })).not.toHaveClass(
      "Mui-selected"
    );
  });
});

describe("AppSidebar — null user", () => {
  beforeEach(() => vi.clearAllMocks());

  it("all product items are disabled when user is null", () => {
    renderSidebar(null);
    PRODUCT_LABELS.forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-disabled", "true");
    });
  });
});

describe("AppSidebar — Almost there card", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Almost there card when profile is incomplete", () => {
    renderSidebar(incompleteUser);
    expect(screen.getByText(en.app.sidebar.almostThereTitle)).toBeInTheDocument();
    expect(screen.getByText(en.app.sidebar.almostThereBody)).toBeInTheDocument();
  });

  it("does not show Almost there card when profile is complete", () => {
    renderSidebar(completeUser);
    expect(screen.queryByText(en.app.sidebar.almostThereTitle)).not.toBeInTheDocument();
  });

  it("does not show Almost there card when user is null", () => {
    renderSidebar(null);
    expect(screen.queryByText(en.app.sidebar.almostThereTitle)).not.toBeInTheDocument();
  });
});
