import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useSocialLogin } from "../hooks/useSocialLogin";
import { socialAuth, getCurrentUser } from "../api/authApi";
import type { SocialAuthResponse } from "../types/auth.types";
import type { CurrentUser } from "../types/auth.types";
import { tokenStorage } from "@/lib/tokenStorage";
import { ApiError } from "@/lib/api/apiError";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetAuthenticatedUser = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({
    setAuthenticatedUser: mockSetAuthenticatedUser,
  }),
}));

vi.mock("../api/authApi", () => ({
  socialAuth: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    setAccessToken: vi.fn(),
    getAccessToken: vi.fn().mockReturnValue(null),
    clearTokens: vi.fn(),
  },
}));

vi.mock("../social/socialConfig", () => ({
  isGoogleConfigured: true,
  isMicrosoftConfigured: true,
  msalInstance: {},
}));

const mockSocialAuth = vi.mocked(socialAuth);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockSetAccessToken = vi.mocked(tokenStorage.setAccessToken);
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
  return createElement(MemoryRouter, null, children);
}

describe("useSocialLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
  });

  // --- success paths ---

  it("stores access token, calls getCurrentUser, and navigates to /app on Google success", async () => {
    mockSocialAuth.mockResolvedValueOnce({
      access: "tok-a",
      email: "user@example.com",
      email_verified: true,
      preferred_auth_provider: "google",
    });
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("google-access-token");
    });

    expect(mockSocialAuth).toHaveBeenCalledWith({
      provider: "google",
      access_token: "google-access-token",
    });
    expect(mockSetAccessToken).toHaveBeenCalledWith("tok-a");
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockSetAuthenticatedUser).toHaveBeenCalledWith(mockUser);
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.app, { replace: true });
  });

  it("stores access token, calls getCurrentUser, and navigates to /app on Microsoft success", async () => {
    mockSocialAuth.mockResolvedValueOnce({
      access: "tok-a",
      email: "user@example.com",
      email_verified: true,
      preferred_auth_provider: "microsoft",
    });
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.microsoft.onToken("ms-access-token");
    });

    expect(mockSocialAuth).toHaveBeenCalledWith({
      provider: "microsoft",
      access_token: "ms-access-token",
    });
    expect(mockSetAccessToken).toHaveBeenCalledWith("tok-a");
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockSetAuthenticatedUser).toHaveBeenCalledWith(mockUser);
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.app, { replace: true });
  });

  it("clears tokens and shows error when getCurrentUser fails after social auth", async () => {
    mockSocialAuth.mockResolvedValueOnce({
      access: "tok-a",
      email: "user@example.com",
      email_verified: true,
      preferred_auth_provider: "google",
    });
    mockGetCurrentUser.mockRejectedValueOnce(new ApiError(401, { detail: "Unauthorized." }));
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("google-access-token");
    });

    expect(mockClearTokens).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.generalError).toBe("Unauthorized.");
  });

  // --- MFA paths ---

  it("navigates to /mfa-challenge when MFA is required", async () => {
    mockSocialAuth.mockResolvedValueOnce({
      mfa_required: true,
      challenge_id: "ch-123",
      detail: "MFA required",
      email: "user@example.com",
      preferred_auth_provider: "google",
    });
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("google-access-token");
    });

    expect(mockSetAccessToken).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.mfaChallenge, {
      state: { challengeId: "ch-123", email: "user@example.com" },
    });
  });

  it("does not store tokens when MFA is required", async () => {
    mockSocialAuth.mockResolvedValueOnce({
      mfa_required: true,
      challenge_id: "ch-123",
      detail: "MFA required",
      email: "user@example.com",
      preferred_auth_provider: "google",
    });
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("google-access-token");
    });

    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });

  // --- backend error paths ---

  it("sets generalError on API failure", async () => {
    mockSocialAuth.mockRejectedValueOnce(new ApiError(400, { detail: "Invalid token." }));
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("bad-token");
    });

    expect(result.current.generalError).toBe("Invalid token.");
  });

  it("sets somethingWentWrong on unknown error", async () => {
    mockSocialAuth.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("bad-token");
    });

    expect(result.current.generalError).toBe(en.common.somethingWentWrong);
  });

  it("clears generalError on retry", async () => {
    mockSocialAuth
      .mockRejectedValueOnce(new ApiError(400, { detail: "Invalid token." }))
      .mockResolvedValueOnce({
        access: "tok-a",
        email: "user@example.com",
        email_verified: true,
        preferred_auth_provider: "google",
      });
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("bad-token");
    });
    expect(result.current.generalError).toBe("Invalid token.");

    await act(async () => {
      result.current.google.onToken("good-token");
    });
    expect(result.current.generalError).toBeUndefined();
  });

  // --- loadingProvider state ---

  it("sets loadingProvider to google during API call and clears after", async () => {
    let resolveAuth!: (value: SocialAuthResponse) => void;
    mockSocialAuth.mockReturnValueOnce(
      new Promise<SocialAuthResponse>((resolve) => {
        resolveAuth = resolve;
      })
    );
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.google.onToken("token");
    });
    expect(result.current.loadingProvider).toBe("google");

    await act(async () => {
      resolveAuth({
        access: "tok-a",
        email: "u@example.com",
        email_verified: true,
        preferred_auth_provider: "google",
      });
    });
    expect(result.current.loadingProvider).toBeUndefined();
  });

  // --- google.onStart / microsoft.onStart ---

  it("google.onStart sets loadingProvider to google", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.google.onStart();
    });

    expect(result.current.loadingProvider).toBe("google");
  });

  it("google.onStart clears generalError", async () => {
    mockSocialAuth.mockRejectedValueOnce(new ApiError(400, { detail: "Prior error." }));
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    await act(async () => {
      result.current.google.onToken("bad-token");
    });
    expect(result.current.generalError).toBe("Prior error.");

    act(() => {
      result.current.google.onStart();
    });
    expect(result.current.generalError).toBeUndefined();
  });

  it("microsoft.onStart sets loadingProvider to microsoft", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.microsoft.onStart();
    });

    expect(result.current.loadingProvider).toBe("microsoft");
  });

  // --- google.onError ---

  it("google.onError clears loadingProvider and sets googleError", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.google.onStart();
    });
    expect(result.current.loadingProvider).toBe("google");

    act(() => {
      result.current.google.onError();
    });
    expect(result.current.loadingProvider).toBeUndefined();
    expect(result.current.generalError).toBe(en.auth.social.googleError);
  });

  // --- microsoft.onError ---

  it("microsoft.onError with user_cancelled sets popupClosed", () => {
    const cancelledError = Object.assign(new Error("Cancelled"), { errorCode: "user_cancelled" });
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.microsoft.onStart();
      result.current.microsoft.onError(cancelledError);
    });

    expect(result.current.loadingProvider).toBeUndefined();
    expect(result.current.generalError).toBe(en.auth.social.popupClosed);
  });

  it("microsoft.onError with other error sets microsoftError", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.microsoft.onError(new Error("Generic MSAL error"));
    });

    expect(result.current.loadingProvider).toBeUndefined();
    expect(result.current.generalError).toBe(en.auth.social.microsoftError);
  });

  it("microsoft.onError without errorCode sets microsoftError", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.microsoft.onError("not an Error object");
    });

    expect(result.current.generalError).toBe(en.auth.social.microsoftError);
  });

  // --- onUnavailable ---

  it("google.onUnavailable sets googleUnavailable and does not set loadingProvider", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.google.onUnavailable();
    });

    expect(result.current.generalError).toBe(en.auth.social.googleUnavailable);
    expect(result.current.loadingProvider).toBeUndefined();
  });

  it("microsoft.onUnavailable sets microsoftUnavailable and does not set loadingProvider", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });

    act(() => {
      result.current.microsoft.onUnavailable();
    });

    expect(result.current.generalError).toBe(en.auth.social.microsoftUnavailable);
    expect(result.current.loadingProvider).toBeUndefined();
  });

  // --- configured flags ---

  it("google.configured is true when isGoogleConfigured is true", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });
    expect(result.current.google.configured).toBe(true);
  });

  it("microsoft.configured is true when isMicrosoftConfigured is true", () => {
    const { result } = renderHook(() => useSocialLogin(), { wrapper });
    expect(result.current.microsoft.configured).toBe(true);
  });
});
