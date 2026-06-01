import { describe, it, expect } from "vitest";
import { isMfaRequiredResponse, isLoginSuccessResponse, getSafeReturnTo } from "../utils/authUtils";
import type { LoginResponse } from "../types/auth.types";

const successResponse: LoginResponse = {
  access: "eyJhbGciOiJIUzI1NiJ9.access",
};

const mfaResponse: LoginResponse = {
  mfa_required: true,
  challenge_id: "550e8400-e29b-41d4-a716-446655440000",
  detail: "MFA verification required.",
};

describe("isMfaRequiredResponse", () => {
  it("returns true for an MFA required response", () => {
    expect(isMfaRequiredResponse(mfaResponse)).toBe(true);
  });

  it("returns false for a login success response", () => {
    expect(isMfaRequiredResponse(successResponse)).toBe(false);
  });
});

describe("isLoginSuccessResponse", () => {
  it("returns true for a login success response", () => {
    expect(isLoginSuccessResponse(successResponse)).toBe(true);
  });

  it("returns false for an MFA required response", () => {
    expect(isLoginSuccessResponse(mfaResponse)).toBe(false);
  });
});

describe("getSafeReturnTo", () => {
  it("returns an internal path as-is", () => {
    expect(getSafeReturnTo("/invite/abc-123")).toBe("/invite/abc-123");
  });

  it("returns an internal app path", () => {
    expect(getSafeReturnTo("/app")).toBe("/app");
  });

  it("returns null for an absolute http URL", () => {
    expect(getSafeReturnTo("https://evil.com/steal")).toBeNull();
  });

  it("returns null for a protocol-relative URL", () => {
    expect(getSafeReturnTo("//evil.com/steal")).toBeNull();
  });

  it("returns null for a non-string value", () => {
    expect(getSafeReturnTo(42)).toBeNull();
    expect(getSafeReturnTo(null)).toBeNull();
    expect(getSafeReturnTo(undefined)).toBeNull();
    expect(getSafeReturnTo({})).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getSafeReturnTo("")).toBeNull();
  });

  it("returns null for a relative path without leading slash", () => {
    expect(getSafeReturnTo("invite/abc")).toBeNull();
  });
});
