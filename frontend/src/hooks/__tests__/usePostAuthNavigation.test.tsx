import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { usePostAuthNavigation } from "../usePostAuthNavigation";
import type { CurrentUser } from "@/features/auth/types/auth.types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());
let locationState: unknown = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: locationState,
      pathname: "/login",
      search: "",
      hash: "",
      key: "k",
    }),
  };
});

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: { setAccessToken: vi.fn(), clearTokens: vi.fn() },
}));

vi.mock("@/features/auth/api/authApi", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({ setAuthenticatedUser: vi.fn() }),
}));

import { getCurrentUser } from "@/features/auth/api/authApi";
const mockGetCurrentUser = vi.mocked(getCurrentUser);

const user = { id: 1, email: "a@b.com" } as CurrentUser;

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  locationState = null;
  mockGetCurrentUser.mockResolvedValue(user);
});

afterEach(() => window.sessionStorage.clear());

describe("usePostAuthNavigation — return destination", () => {
  it("prefers an explicit returnTo from router state", async () => {
    locationState = { returnTo: "/invite/state-token" };
    window.sessionStorage.setItem("wc.pendingInviteToken", "stored-token");
    const { result } = renderHook(() => usePostAuthNavigation(), { wrapper });
    await result.current.navigateAfterAuth({ access: "a" });
    expect(mockNavigate).toHaveBeenCalledWith("/invite/state-token");
  });

  it("falls back to a persisted invite token when router state is absent", async () => {
    window.sessionStorage.setItem("wc.pendingInviteToken", "stored-token");
    const { result } = renderHook(() => usePostAuthNavigation(), { wrapper });
    await result.current.navigateAfterAuth({ access: "a" });
    expect(mockNavigate).toHaveBeenCalledWith("/invite/stored-token");
  });

  it("defaults to the app dashboard when nothing is preserved", async () => {
    const { result } = renderHook(() => usePostAuthNavigation(), { wrapper });
    await result.current.navigateAfterAuth({ access: "a" });
    expect(mockNavigate).toHaveBeenCalledWith("/app");
  });
});
