import { describe, it, expect, beforeEach } from "vitest";
import { tokenStorage } from "@/lib/tokenStorage";

const ACCESS_KEY = "workspacecanvas.accessToken";
const REFRESH_KEY = "workspacecanvas.refreshToken";

describe("tokenStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getAccessToken", () => {
    it("returns null when nothing is stored", () => {
      expect(tokenStorage.getAccessToken()).toBeNull();
    });

    it("returns the stored access token", () => {
      localStorage.setItem(ACCESS_KEY, "my-access-token");
      expect(tokenStorage.getAccessToken()).toBe("my-access-token");
    });
  });

  describe("getRefreshToken", () => {
    it("returns null when nothing is stored", () => {
      expect(tokenStorage.getRefreshToken()).toBeNull();
    });

    it("returns the stored refresh token", () => {
      localStorage.setItem(REFRESH_KEY, "my-refresh-token");
      expect(tokenStorage.getRefreshToken()).toBe("my-refresh-token");
    });
  });

  describe("setAccessToken", () => {
    it("updates only the access token without touching the refresh token", () => {
      tokenStorage.setTokens("old-acc", "ref456");
      tokenStorage.setAccessToken("new-acc");
      expect(localStorage.getItem(ACCESS_KEY)).toBe("new-acc");
      expect(localStorage.getItem(REFRESH_KEY)).toBe("ref456");
    });

    it("persists the access token under the correct key", () => {
      tokenStorage.setAccessToken("acc-only");
      expect(localStorage.getItem(ACCESS_KEY)).toBe("acc-only");
    });
  });

  describe("setTokens", () => {
    it("persists the access token under the correct key", () => {
      tokenStorage.setTokens("acc123", "ref456");
      expect(localStorage.getItem(ACCESS_KEY)).toBe("acc123");
    });

    it("persists the refresh token under the correct key", () => {
      tokenStorage.setTokens("acc123", "ref456");
      expect(localStorage.getItem(REFRESH_KEY)).toBe("ref456");
    });

    it("overwrites previously stored tokens", () => {
      tokenStorage.setTokens("old-acc", "old-ref");
      tokenStorage.setTokens("new-acc", "new-ref");
      expect(tokenStorage.getAccessToken()).toBe("new-acc");
      expect(tokenStorage.getRefreshToken()).toBe("new-ref");
    });
  });

  describe("clearTokens", () => {
    it("removes both tokens", () => {
      tokenStorage.setTokens("acc123", "ref456");
      tokenStorage.clearTokens();
      expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    });

    it("does not affect unrelated localStorage keys", () => {
      localStorage.setItem("other.key", "keep-me");
      tokenStorage.setTokens("acc123", "ref456");
      tokenStorage.clearTokens();
      expect(localStorage.getItem("other.key")).toBe("keep-me");
    });

    it("is safe to call when no tokens are stored", () => {
      expect(() => tokenStorage.clearTokens()).not.toThrow();
    });
  });
});
