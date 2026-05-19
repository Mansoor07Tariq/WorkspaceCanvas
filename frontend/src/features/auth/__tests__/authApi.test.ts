import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../../../lib/api/apiClient";
import { AUTH_ENDPOINTS } from "../api/authEndpoints";
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
} from "../api/authApi";

vi.mock("../../../lib/api/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockPost = vi.mocked(api.post);
const mockGet = vi.mocked(api.get);

describe("authApi", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    mockPost.mockResolvedValue(undefined);
    mockGet.mockResolvedValue(undefined);
  });

  describe("login", () => {
    it("posts to the login endpoint with auth: false", async () => {
      mockPost.mockResolvedValueOnce({ access: "acc", refresh: "ref" });
      await login({ email: "user@example.com", password: "pass" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.login,
        { email: "user@example.com", password: "pass" },
        { auth: false }
      );
    });
  });

  describe("signup", () => {
    it("posts to the signup endpoint with auth: false", async () => {
      await signup({ email: "user@example.com", password: "pass123!" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.signup,
        { email: "user@example.com", password: "pass123!" },
        { auth: false }
      );
    });

    it("includes optional full_name when provided", async () => {
      await signup({ email: "user@example.com", password: "pass123!", full_name: "Alice" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.signup,
        { email: "user@example.com", password: "pass123!", full_name: "Alice" },
        { auth: false }
      );
    });
  });

  describe("verifyEmail", () => {
    it("posts to the verifyEmail endpoint with auth: false", async () => {
      await verifyEmail({ token: "abc123" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.verifyEmail,
        { token: "abc123" },
        { auth: false }
      );
    });
  });

  describe("resendVerification", () => {
    it("posts to the resendVerification endpoint with auth: false", async () => {
      await resendVerification({ email: "user@example.com" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.resendVerification,
        { email: "user@example.com" },
        { auth: false }
      );
    });
  });

  describe("socialAuth", () => {
    it("posts to the social endpoint with auth: false", async () => {
      await socialAuth({ provider: "google", access_token: "g-tok" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.social,
        { provider: "google", access_token: "g-tok" },
        { auth: false }
      );
    });
  });

  describe("verifyMfaChallenge", () => {
    it("posts to mfaChallengeVerify with a TOTP token and auth: false", async () => {
      await verifyMfaChallenge({ challenge_id: "uuid-123", token: "123456" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.mfaChallengeVerify,
        { challenge_id: "uuid-123", token: "123456" },
        { auth: false }
      );
    });

    it("posts to mfaChallengeVerify with a recovery_code and auth: false", async () => {
      await verifyMfaChallenge({ challenge_id: "uuid-123", recovery_code: "abc123def456" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.mfaChallengeVerify,
        { challenge_id: "uuid-123", recovery_code: "abc123def456" },
        { auth: false }
      );
    });
  });

  describe("refreshToken", () => {
    it("posts to the refreshToken endpoint with auth: false", async () => {
      await refreshToken({ refresh: "ref-token" });
      expect(api.post).toHaveBeenCalledWith(
        AUTH_ENDPOINTS.refreshToken,
        { refresh: "ref-token" },
        { auth: false }
      );
    });
  });

  describe("getMfaStatus", () => {
    it("gets the mfaStatus endpoint (auth: true by default)", async () => {
      await getMfaStatus();
      expect(api.get).toHaveBeenCalledWith(AUTH_ENDPOINTS.mfaStatus);
    });
  });

  describe("setupMfa", () => {
    it("posts to the mfaSetup endpoint with no body (auth: true by default)", async () => {
      await setupMfa();
      expect(api.post).toHaveBeenCalledWith(AUTH_ENDPOINTS.mfaSetup);
    });
  });

  describe("confirmMfa", () => {
    it("posts to the mfaConfirm endpoint (auth: true by default)", async () => {
      await confirmMfa({ token: "123456" });
      expect(api.post).toHaveBeenCalledWith(AUTH_ENDPOINTS.mfaConfirm, { token: "123456" });
    });
  });

  describe("disableMfa", () => {
    it("posts to the mfaDisable endpoint (auth: true by default)", async () => {
      await disableMfa({ password: "mypass", token: "123456" });
      expect(api.post).toHaveBeenCalledWith(AUTH_ENDPOINTS.mfaDisable, {
        password: "mypass",
        token: "123456",
      });
    });
  });

  describe("regenerateRecoveryCodes", () => {
    it("posts to mfaRecoveryCodesRegenerate (auth: true by default)", async () => {
      await regenerateRecoveryCodes({ password: "mypass", token: "123456" });
      expect(api.post).toHaveBeenCalledWith(AUTH_ENDPOINTS.mfaRecoveryCodesRegenerate, {
        password: "mypass",
        token: "123456",
      });
    });
  });

  describe("logout", () => {
    it("posts to the logout endpoint (auth: true by default)", async () => {
      await logout({ refresh: "ref-token" });
      expect(api.post).toHaveBeenCalledWith(AUTH_ENDPOINTS.logout, { refresh: "ref-token" });
    });
  });

  describe("getCurrentUser", () => {
    it("gets the me endpoint (auth: true by default)", async () => {
      await getCurrentUser();
      expect(api.get).toHaveBeenCalledWith(AUTH_ENDPOINTS.me);
    });
  });
});
