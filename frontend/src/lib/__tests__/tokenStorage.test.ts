import { describe, it, expect, beforeEach } from "vitest";
import { tokenStorage } from "@/lib/tokenStorage";

// Reset in-memory state between tests by clearing tokens before each test.
describe("tokenStorage (in-memory)", () => {
  beforeEach(() => {
    tokenStorage.clearTokens();
  });

  describe("getAccessToken", () => {
    it("returns null when nothing is stored", () => {
      expect(tokenStorage.getAccessToken()).toBeNull();
    });

    it("returns the access token after setAccessToken", () => {
      tokenStorage.setAccessToken("my-access-token");
      expect(tokenStorage.getAccessToken()).toBe("my-access-token");
    });
  });

  describe("setAccessToken", () => {
    it("stores the access token in memory", () => {
      tokenStorage.setAccessToken("acc-only");
      expect(tokenStorage.getAccessToken()).toBe("acc-only");
    });

    it("overwrites a previously stored access token", () => {
      tokenStorage.setAccessToken("old-acc");
      tokenStorage.setAccessToken("new-acc");
      expect(tokenStorage.getAccessToken()).toBe("new-acc");
    });
  });

  describe("setTokens", () => {
    it("stores the access token", () => {
      tokenStorage.setTokens("acc123");
      expect(tokenStorage.getAccessToken()).toBe("acc123");
    });

    it("overwrites a previously stored token", () => {
      tokenStorage.setTokens("old-acc");
      tokenStorage.setTokens("new-acc");
      expect(tokenStorage.getAccessToken()).toBe("new-acc");
    });
  });

  describe("clearTokens", () => {
    it("removes the access token", () => {
      tokenStorage.setAccessToken("acc123");
      tokenStorage.clearTokens();
      expect(tokenStorage.getAccessToken()).toBeNull();
    });

    it("is safe to call when no tokens are stored", () => {
      expect(() => tokenStorage.clearTokens()).not.toThrow();
    });
  });
});
