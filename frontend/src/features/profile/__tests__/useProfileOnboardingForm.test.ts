/**
 * PR 057 (Errors 1, 2, 3): useProfileOnboardingForm
 *  - seeds the Full Name from the authenticated user (Google name) once it loads
 *  - seeds the avatar preview from the existing (Google) avatar
 *  - does not overwrite a value the user typed
 *  - shows a delayed transition (`completing`) before flipping the auth user
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { CurrentUser } from "@/features/auth/types/auth.types";

let mockUser: CurrentUser | null = null;
const mockSetAuthenticatedUser = vi.fn();

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, setAuthenticatedUser: mockSetAuthenticatedUser }),
}));

const mockUpdateProfile = vi.fn();
const mockUploadAvatar = vi.fn();
vi.mock("../api/profileApi", () => ({
  updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
  uploadAvatar: (...a: unknown[]) => mockUploadAvatar(...a),
}));

import { useProfileOnboardingForm } from "../hooks/useProfileOnboardingForm";

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 1,
    username: "u@example.com",
    email: "u@example.com",
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
    preferred_auth_provider: "google",
    mfa_enabled: false,
    memberships: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
});

describe("useProfileOnboardingForm — Google prefill (Errors 1 & 2)", () => {
  it("seeds full name and avatar preview from the authenticated user on mount", () => {
    mockUser = makeUser({ full_name: "Jane Doe", avatar: "/media/users/avatars/g.png" });
    const { result } = renderHook(() => useProfileOnboardingForm());
    expect(result.current.fields.fullName).toBe("Jane Doe");
    expect(result.current.avatarPreview).toBe("http://localhost:8000/media/users/avatars/g.png");
  });

  it("seeds the name once the user loads after mount (async auth)", () => {
    mockUser = null;
    const { result, rerender } = renderHook(() => useProfileOnboardingForm());
    expect(result.current.fields.fullName).toBe("");

    mockUser = makeUser({ full_name: "Late Loader" });
    rerender();
    expect(result.current.fields.fullName).toBe("Late Loader");
  });

  it("leaves the name blank when the user has no Google name", () => {
    mockUser = makeUser({ full_name: "" });
    const { result } = renderHook(() => useProfileOnboardingForm());
    expect(result.current.fields.fullName).toBe("");
  });

  it("does not overwrite a value the user typed when the same user re-renders", () => {
    mockUser = makeUser({ full_name: "Jane Doe" });
    const { result, rerender } = renderHook(() => useProfileOnboardingForm());
    expect(result.current.fields.fullName).toBe("Jane Doe");

    act(() => result.current.setField("fullName", "Custom Name"));
    rerender(); // same user id — seeding must not run again
    expect(result.current.fields.fullName).toBe("Custom Name");
  });

  it("does not override an uploaded avatar preview with the remote one", () => {
    mockUser = makeUser({ avatar: "/media/users/avatars/g.png" });
    const { result } = renderHook(() => useProfileOnboardingForm());
    const file = new File(["x"], "a.png", { type: "image/png" });
    act(() => result.current.selectAvatarFile(file));
    // A blob: preview from the uploaded file, not the remote Google URL.
    expect(result.current.avatarPreview).not.toBe("/media/users/avatars/g.png");
  });
});

describe("useProfileOnboardingForm — completion transition (Error 3)", () => {
  it("sets `completing` and delays setAuthenticatedUser until the transition ends", async () => {
    mockUser = makeUser({ id: 7 });
    const finalUser = makeUser({ id: 7, full_name: "Jane Doe", is_profile_completed: true });
    mockUpdateProfile.mockResolvedValue(finalUser);

    const { result } = renderHook(() => useProfileOnboardingForm());
    act(() => result.current.setField("fullName", "Jane Doe"));
    act(() => result.current.handleFinish(false));

    // Overlay state turns on; the auth user is NOT flipped immediately.
    await waitFor(() => expect(result.current.completing).toBe(true));
    expect(mockSetAuthenticatedUser).not.toHaveBeenCalled();

    // After the transition delay the user is flipped and the overlay clears.
    await waitFor(() => expect(mockSetAuthenticatedUser).toHaveBeenCalledWith(finalUser), {
      timeout: 4000,
    });
    await waitFor(() => expect(result.current.completing).toBe(false));
  });

  it("does not enter the transition when the API call fails", async () => {
    mockUser = makeUser();
    mockUpdateProfile.mockRejectedValue(new Error("server error"));

    const { result } = renderHook(() => useProfileOnboardingForm());
    act(() => result.current.setField("fullName", "Jane Doe"));
    act(() => result.current.handleFinish(false));

    await waitFor(() => expect(result.current.submission.generalError).toBeTruthy());
    expect(result.current.completing).toBe(false);
    expect(mockSetAuthenticatedUser).not.toHaveBeenCalled();
  });
});
