import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshStoredTokens } from "../utils/sessionRefresh";
import { tokenStorage } from "@/lib/tokenStorage";
import { ApiError } from "@/lib/api/apiError";

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

vi.mock("@/lib/api/rawRequest", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@/lib/api/rawRequest";

const mockApiRequest = vi.mocked(apiRequest);
const mockSetAccessToken = vi.mocked(tokenStorage.setAccessToken);
const mockClearTokens = vi.mocked(tokenStorage.clearTokens);

describe("refreshStoredTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the new access token on success", async () => {
    mockApiRequest.mockResolvedValueOnce({ access: "new-access" });

    const result = await refreshStoredTokens();

    expect(result).toBe(true);
    expect(mockSetAccessToken).toHaveBeenCalledWith("new-access");
  });

  it("returns false and clears tokens when the refresh call fails", async () => {
    mockApiRequest.mockRejectedValueOnce(new ApiError(401, { detail: "Cookie expired." }));

    const result = await refreshStoredTokens();

    expect(result).toBe(false);
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("posts to the correct refresh endpoint with no body", async () => {
    mockApiRequest.mockResolvedValueOnce({ access: "new-access" });

    await refreshStoredTokens();

    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/auth/token/refresh/",
      expect.objectContaining({ method: "POST" })
    );
    const [, init] = mockApiRequest.mock.calls[0];
    expect((init as RequestInit).body).toBeUndefined();
  });

  it("returns false when a non-auth error is thrown", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("Network error"));

    const result = await refreshStoredTokens();

    expect(result).toBe(false);
    expect(mockClearTokens).toHaveBeenCalled();
  });
});
