import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { getCurrentUser, logout } from "../api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { sessionEvents } from "@/lib/sessionEvents";
import { en } from "@/i18n/en";
import type { CurrentUser } from "../types/auth.types";

vi.mock("../api/authApi", () => ({
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

// Use the real sessionEvents so tests can call emitSessionExpired directly.
// Each test's useEffect cleanup removes its own listener on unmount.

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockLogout = vi.mocked(logout);
const mockGetAccessToken = vi.mocked(tokenStorage.getAccessToken);
const mockGetRefreshToken = vi.mocked(tokenStorage.getRefreshToken);
const mockClearTokens = vi.mocked(tokenStorage.clearTokens);

const mockUser: CurrentUser = {
  id: 1,
  username: "user@example.com",
  email: "user@example.com",
  full_name: "Test User",
  first_name: "Test",
  last_name: "User",
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

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AuthProvider, null, children);
}

describe("AuthContext — bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initialises as unauthenticated and does not call getCurrentUser when no token", async () => {
    mockGetAccessToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("initialises as loading when token exists, then transitions to authenticated", async () => {
    mockGetAccessToken.mockReturnValue("tok");
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("clears tokens and becomes unauthenticated when getCurrentUser fails on bootstrap", async () => {
    mockGetAccessToken.mockReturnValue("expired-tok");
    mockGetCurrentUser.mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    expect(result.current.user).toBeNull();
    expect(mockClearTokens).toHaveBeenCalled();
  });
});

describe("AuthContext — refreshUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
  });

  it("updates user and sets authenticated on success", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Simulate token appearing
    mockGetAccessToken.mockReturnValue("tok");

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toEqual(mockUser);
  });

  it("clears tokens and becomes unauthenticated when getCurrentUser fails", async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error("Unauthorized"));
    mockGetAccessToken.mockReturnValue("tok");
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("becomes unauthenticated immediately when no access token", async () => {
    mockGetAccessToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockClearTokens).toHaveBeenCalled();
  });
});

describe("AuthContext — setAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
  });

  it("sets authenticated status and stores user", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.setAuthenticatedUser(mockUser);
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.error).toBeUndefined();
  });
});

describe("AuthContext — markUnauthenticated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
  });

  it("clears tokens, user, and sets unauthenticated", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.setAuthenticatedUser(mockUser);
    });

    act(() => {
      result.current.markUnauthenticated();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("stores optional error message", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.markUnauthenticated("Session expired.");
    });

    expect(result.current.error).toBe("Session expired.");
  });
});

describe("AuthContext — logoutUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
  });

  it("calls logout API with refresh token when present", async () => {
    mockGetRefreshToken.mockReturnValue("ref-tok");
    mockLogout.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logoutUser();
    });

    expect(mockLogout).toHaveBeenCalledWith({ refresh: "ref-tok" });
  });

  it("does not call logout API when no refresh token", async () => {
    mockGetRefreshToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logoutUser();
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("clears tokens even when backend logout fails", async () => {
    mockGetRefreshToken.mockReturnValue("ref-tok");
    mockLogout.mockRejectedValueOnce(new Error("Server error"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logoutUser();
    });

    expect(mockClearTokens).toHaveBeenCalled();
    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
  });

  it("sets unauthenticated and clears user", async () => {
    mockGetRefreshToken.mockReturnValue(null);
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.setAuthenticatedUser(mockUser);
    });

    await act(async () => {
      await result.current.logoutUser();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
  });
});

describe("AuthContext — session expired event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
  });

  it("marks unauthenticated with sessionExpired error when session expired event fires", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.setAuthenticatedUser(mockUser);
    });

    act(() => {
      sessionEvents.emitSessionExpired();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe(en.auth.session.sessionExpired);
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("unsubscribes from session expired events on unmount", () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.setAuthenticatedUser(mockUser);
    });

    unmount();

    // After unmount the listener is removed; emitting should not throw or update state.
    expect(() => {
      sessionEvents.emitSessionExpired();
    }).not.toThrow();
  });
});

describe("AuthContext — useAuth outside provider", () => {
  it("throws when used outside AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within AuthProvider");
    consoleSpy.mockRestore();
  });
});
