import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../ProtectedRoute";
import { en } from "@/i18n/en";
import { ROUTES } from "../paths";
import type { AuthContextValue } from "@/features/auth/types/authState.types";

const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: null,
  refreshUser: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  markUnauthenticated: vi.fn(),
  logoutUser: vi.fn(),
};

function renderProtectedRoute(status: AuthContextValue["status"]) {
  mockUseAuth.mockReturnValue({ ...baseAuth, status });
  return render(
    <MemoryRouter initialEntries={[ROUTES.app]}>
      <Routes>
        <Route path={ROUTES.login} element={<div>Login Page</div>} />
        <Route
          path={ROUTES.app}
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state when status is loading", () => {
    renderProtectedRoute("loading");
    expect(screen.getByText(en.auth.session.protectedRouteLoading)).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    renderProtectedRoute("unauthenticated");
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    renderProtectedRoute("authenticated");
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("does not render children when loading", () => {
    renderProtectedRoute("loading");
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("does not render children when unauthenticated", () => {
    renderProtectedRoute("unauthenticated");
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });
});
