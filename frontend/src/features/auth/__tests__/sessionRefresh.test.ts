import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshStoredTokens } from "../utils/sessionRefresh";
import { tokenStorage } from "@/lib/tokenStorage";
import { ApiError } from "@/lib/api/apiError";

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getRefreshToken: vi.fn(),
    getAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

vi.mock("@/lib/api/rawRequest", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@/lib/api/rawRequest";

const mockApiRequest = vi.mocked(apiRequest);
const mockGetRefreshToken = vi.mocked(tokenStorage.getRefreshToken);
const mockSetAccessToken = vi.mocked(tokenStorage.setAccessToken);
const mockSetTokens = vi.mocked(tokenStorage.setTokens);
const mockClearTokens = vi.mocked(tokenStorage.clearTokens);

describe("refreshStoredTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false and clears tokens when no refresh token is stored", async () => {
    mockGetRefreshToken.mockReturnValue(null);

    const result = await refreshStoredTokens();

    expect(result).toBe(false);
    expect(mockClearTokens).toHaveBeenCalled();
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("stores only new access token when backend does not return a new refresh", async () => {
    mockGetRefreshToken.mockReturnValue("old-refresh");
    mockApiRequest.mockResolvedValueOnce({ access: "new-access" });

    const result = await refreshStoredTokens();

    expect(result).toBe(true);
    expect(mockSetAccessToken).toHaveBeenCalledWith("new-access");
    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it("stores both tokens when backend returns a new refresh token", async () => {
    mockGetRefreshToken.mockReturnValue("old-refresh");
    mockApiRequest.mockResolvedValueOnce({ access: "new-access", refresh: "new-refresh" });

    const result = await refreshStoredTokens();

    expect(result).toBe(true);
    expect(mockSetTokens).toHaveBeenCalledWith("new-access", "new-refresh");
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });

  it("returns false and clears tokens when the refresh call fails", async () => {
    mockGetRefreshToken.mockReturnValue("old-refresh");
    mockApiRequest.mockRejectedValueOnce(new ApiError(401, { detail: "Token expired." }));

    const result = await refreshStoredTokens();

    expect(result).toBe(false);
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("posts to the correct refresh endpoint with the stored refresh token", async () => {
    mockGetRefreshToken.mockReturnValue("my-refresh");
    mockApiRequest.mockResolvedValueOnce({ access: "new-access" });

    await refreshStoredTokens();

    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/auth/token/refresh/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: "my-refresh" }),
      })
    );
  });
});
