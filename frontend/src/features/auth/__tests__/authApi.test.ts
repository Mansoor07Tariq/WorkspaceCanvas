import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest } from "../../../lib/apiClient";
import {
  login,
  signup,
  verifyEmail,
  resendVerification,
  socialAuth,
  verifyMfaChallenge,
  getMfaStatus,
  setupMfa,
  confirmMfa,
  disableMfa,
  regenerateRecoveryCodes,
  refreshToken,
  logout,
  getCurrentUser,
} from "../authApi";

vi.mock("../../../lib/apiClient", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../tokenStorage", () => ({
  tokenStorage: {
    getAccessToken: vi.fn().mockReturnValue("test-access-token"),
  },
}));

const mockApiRequest = vi.mocked(apiRequest);

describe("authApi", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockApiRequest.mockResolvedValue(undefined);
  });

  describe("login", () => {
    it("posts to /api/auth/token/ with email and password", async () => {
      mockApiRequest.mockResolvedValueOnce({ access: "acc", refresh: "ref" });
      await login({ email: "user@example.com", password: "pass" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/token/", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "pass" }),
      });
    });

    it("returns the response from apiRequest", async () => {
      const response = { access: "acc", refresh: "ref" };
      mockApiRequest.mockResolvedValueOnce(response);
      expect(await login({ email: "user@example.com", password: "pass" })).toEqual(response);
    });
  });

  describe("signup", () => {
    it("posts to /api/auth/signup/ with signup data", async () => {
      await signup({ email: "user@example.com", password: "pass123!" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/signup/", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "pass123!" }),
      });
    });

    it("includes optional full_name when provided", async () => {
      await signup({ email: "user@example.com", password: "pass123!", full_name: "Alice" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/signup/", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          password: "pass123!",
          full_name: "Alice",
        }),
      });
    });
  });

  describe("verifyEmail", () => {
    it("posts to /api/auth/verify-email/ with token", async () => {
      await verifyEmail({ token: "abc123" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/verify-email/", {
        method: "POST",
        body: JSON.stringify({ token: "abc123" }),
      });
    });
  });

  describe("resendVerification", () => {
    it("posts to /api/auth/resend-verification/ with email", async () => {
      await resendVerification({ email: "user@example.com" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/resend-verification/", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com" }),
      });
    });
  });

  describe("socialAuth", () => {
    it("posts to /api/auth/social/ with provider and access_token", async () => {
      await socialAuth({ provider: "google", access_token: "google-token" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/social/", {
        method: "POST",
        body: JSON.stringify({ provider: "google", access_token: "google-token" }),
      });
    });
  });

  describe("verifyMfaChallenge", () => {
    it("posts to /api/auth/mfa/challenge/verify/ with challenge_id and token", async () => {
      await verifyMfaChallenge({ challenge_id: "uuid-123", token: "123456" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/mfa/challenge/verify/", {
        method: "POST",
        body: JSON.stringify({ challenge_id: "uuid-123", token: "123456" }),
      });
    });

    it("posts with recovery_code instead of token", async () => {
      await verifyMfaChallenge({ challenge_id: "uuid-123", recovery_code: "abc123def456" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/mfa/challenge/verify/", {
        method: "POST",
        body: JSON.stringify({ challenge_id: "uuid-123", recovery_code: "abc123def456" }),
      });
    });
  });

  describe("getMfaStatus", () => {
    it("gets /api/auth/mfa/status/ with Authorization header", async () => {
      await getMfaStatus();
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/mfa/status/", {
        headers: { Authorization: "Bearer test-access-token" },
      });
    });
  });

  describe("setupMfa", () => {
    it("posts to /api/auth/mfa/setup/ with Authorization header", async () => {
      await setupMfa();
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/mfa/setup/", {
        method: "POST",
        headers: { Authorization: "Bearer test-access-token" },
      });
    });
  });

  describe("confirmMfa", () => {
    it("posts to /api/auth/mfa/confirm/ with token and Authorization header", async () => {
      await confirmMfa({ token: "123456" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/mfa/confirm/", {
        method: "POST",
        body: JSON.stringify({ token: "123456" }),
        headers: { Authorization: "Bearer test-access-token" },
      });
    });
  });

  describe("disableMfa", () => {
    it("posts to /api/auth/mfa/disable/ with Authorization header", async () => {
      await disableMfa({ password: "mypass", token: "123456" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/mfa/disable/", {
        method: "POST",
        body: JSON.stringify({ password: "mypass", token: "123456" }),
        headers: { Authorization: "Bearer test-access-token" },
      });
    });
  });

  describe("regenerateRecoveryCodes", () => {
    it("posts to /api/auth/mfa/recovery-codes/regenerate/ with Authorization header", async () => {
      await regenerateRecoveryCodes({ password: "mypass", token: "123456" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/mfa/recovery-codes/regenerate/", {
        method: "POST",
        body: JSON.stringify({ password: "mypass", token: "123456" }),
        headers: { Authorization: "Bearer test-access-token" },
      });
    });
  });

  describe("refreshToken", () => {
    it("posts to /api/auth/token/refresh/ with refresh token", async () => {
      await refreshToken({ refresh: "ref-token" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/token/refresh/", {
        method: "POST",
        body: JSON.stringify({ refresh: "ref-token" }),
      });
    });
  });

  describe("logout", () => {
    it("posts to /api/auth/logout/ with refresh token and Authorization header", async () => {
      await logout({ refresh: "ref-token" });
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh: "ref-token" }),
        headers: { Authorization: "Bearer test-access-token" },
      });
    });
  });

  describe("getCurrentUser", () => {
    it("gets /api/auth/me/ with Authorization header", async () => {
      await getCurrentUser();
      expect(mockApiRequest).toHaveBeenCalledWith("/api/auth/me/", {
        headers: { Authorization: "Bearer test-access-token" },
      });
    });
  });
});
