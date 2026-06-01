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

// All product items that appear in the nav
const PRODUCT_LABELS = [
  en.app.sidebar.offices,
  en.app.sidebar.deskBooking,
  en.app.sidebar.myBookings,
  en.app.sidebar.people,
];

describe("AppSidebar — locked (profile incomplete)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the nav landmark", () => {
    renderSidebar();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  });

  it("dashboard item is always enabled", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: en.app.sidebar.dashboard })).not.toBeDisabled();
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
    // Hover the span wrapper (not the button, which has pointer-events:none when disabled)
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
    [en.app.sidebar.dashboard, ...PRODUCT_LABELS].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).not.toBeDisabled();
    });
  });

  it("no tooltip spans exist when profile is complete", () => {
    const { container } = renderSidebar(completeUser);
    expect(container.querySelectorAll("span[style*='width: 100%']").length).toBe(0);
  });
});

describe("AppSidebar — My Bookings nav item", () => {
  beforeEach(() => vi.clearAllMocks());

  it("My Bookings item is present in the nav", () => {
    renderSidebar(completeUser);
    expect(screen.getByRole("button", { name: en.app.sidebar.myBookings })).toBeInTheDocument();
  });

  it("My Bookings item is enabled for a profile-complete user", () => {
    renderSidebar(completeUser);
    expect(screen.getByRole("button", { name: en.app.sidebar.myBookings })).not.toBeDisabled();
  });
});

describe("AppSidebar — Events removed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Events item is not shown in the nav", () => {
    renderSidebar(completeUser);
    expect(screen.queryByRole("button", { name: en.app.sidebar.events })).not.toBeInTheDocument();
  });
});

describe("AppSidebar — active item selection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dashboard button has Mui-selected class when on /app", () => {
    renderSidebar(completeUser, ROUTES.app);
    const btn = screen.getByRole("button", { name: en.app.sidebar.dashboard });
    expect(btn).toHaveClass("Mui-selected");
  });

  it("dashboard button does not have Mui-selected class when on a different route", () => {
    renderSidebar(completeUser, ROUTES.offices);
    const btn = screen.getByRole("button", { name: en.app.sidebar.dashboard });
    expect(btn).not.toHaveClass("Mui-selected");
  });

  it("My Bookings button has Mui-selected class when on myBookings route", () => {
    renderSidebar(completeUser, ROUTES.myBookings);
    const btn = screen.getByRole("button", { name: en.app.sidebar.myBookings });
    expect(btn).toHaveClass("Mui-selected");
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
    expect(screen.queryByText(en.app.sidebar.almostThereBody)).not.toBeInTheDocument();
  });

  it("does not show Almost there card when user is null", () => {
    renderSidebar(null);
    expect(screen.queryByText(en.app.sidebar.almostThereTitle)).not.toBeInTheDocument();
  });
});
