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
    setAccessToken: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/sessionRefresh", () => ({
  refreshStoredTokens: vi.fn(),
}));

// Use the real sessionEvents so tests can call emitSessionExpired directly.
// Each test's useEffect cleanup removes its own listener on unmount.

import { refreshStoredTokens } from "@/features/auth/utils/sessionRefresh";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockLogout = vi.mocked(logout);
const mockClearTokens = vi.mocked(tokenStorage.clearTokens);
const mockRefreshStoredTokens = vi.mocked(refreshStoredTokens);

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

  it("always starts as loading on mount", () => {
    mockRefreshStoredTokens.mockResolvedValue(false);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe("loading");
  });

  it("becomes unauthenticated when refresh fails on bootstrap", async () => {
    mockRefreshStoredTokens.mockResolvedValue(false);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    expect(result.current.user).toBeNull();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("calls getCurrentUser after successful refresh and becomes authenticated", async () => {
    mockRefreshStoredTokens.mockResolvedValue(true);
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("clears tokens and becomes unauthenticated when getCurrentUser fails after refresh", async () => {
    mockRefreshStoredTokens.mockResolvedValue(true);
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
    mockRefreshStoredTokens.mockResolvedValue(false);
  });

  it("updates user and sets authenticated on success", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toEqual(mockUser);
  });

  it("clears tokens and becomes unauthenticated when getCurrentUser fails", async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error("Unauthorized"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
    expect(mockClearTokens).toHaveBeenCalled();
  });
});

describe("AuthContext — setAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshStoredTokens.mockResolvedValue(false);
  });

  it("sets authenticated status and stores user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

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
    mockRefreshStoredTokens.mockResolvedValue(false);
  });

  it("clears tokens, user, and sets unauthenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

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

  it("stores optional error message", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    act(() => {
      result.current.markUnauthenticated("Session expired.");
    });

    expect(result.current.error).toBe("Session expired.");
  });
});

describe("AuthContext — logoutUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshStoredTokens.mockResolvedValue(false);
  });

  it("calls logout API without arguments", async () => {
    mockLogout.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.logoutUser();
    });

    expect(mockLogout).toHaveBeenCalledWith();
  });

  it("always calls the logout API regardless of token state", async () => {
    mockLogout.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.logoutUser();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("clears tokens even when backend logout fails", async () => {
    mockLogout.mockRejectedValueOnce(new Error("Server error"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.logoutUser();
    });

    expect(mockClearTokens).toHaveBeenCalled();
    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
  });

  it("sets unauthenticated and clears user", async () => {
    mockLogout.mockResolvedValueOnce(undefined);
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

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
    mockRefreshStoredTokens.mockResolvedValue(false);
  });

  it("marks unauthenticated with sessionExpired error when session expired event fires", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

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

  it("unsubscribes from session expired events on unmount", async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

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
