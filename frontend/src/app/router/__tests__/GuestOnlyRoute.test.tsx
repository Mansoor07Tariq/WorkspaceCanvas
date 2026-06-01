import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GuestOnlyRoute } from "../GuestOnlyRoute";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";
import type { AuthContextValue } from "@/features/auth/types/authState.types";

const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const baseAuth: AuthContextValue = {
  status: "unauthenticated",
  user: null,
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn(),
};

function renderGuestOnlyRoute(status: AuthContextValue["status"]) {
  mockUseAuth.mockReturnValue({ ...baseAuth, status });
  return render(
    <MemoryRouter initialEntries={[ROUTES.login]}>
      <Routes>
        <Route path={ROUTES.app} element={<div>App Page</div>} />
        <Route
          path={ROUTES.login}
          element={
            <GuestOnlyRoute>
              <div>Guest Content</div>
            </GuestOnlyRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("GuestOnlyRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when status is unauthenticated", () => {
    renderGuestOnlyRoute("unauthenticated");
    expect(screen.getByText("Guest Content")).toBeInTheDocument();
  });

  it("redirects to /app when status is authenticated", () => {
    renderGuestOnlyRoute("authenticated");
    expect(screen.getByText("App Page")).toBeInTheDocument();
    expect(screen.queryByText("Guest Content")).not.toBeInTheDocument();
  });

  it("renders loading spinner when status is loading", () => {
    renderGuestOnlyRoute("loading");
    expect(screen.getByText(en.auth.session.loading)).toBeInTheDocument();
    expect(screen.queryByText("Guest Content")).not.toBeInTheDocument();
  });

  it("does not render children when loading", () => {
    renderGuestOnlyRoute("loading");
    expect(screen.queryByText("Guest Content")).not.toBeInTheDocument();
  });

  it("does not render children when authenticated", () => {
    renderGuestOnlyRoute("authenticated");
    expect(screen.queryByText("Guest Content")).not.toBeInTheDocument();
  });
});
