import { describe, it, expect } from "vitest";
import { isMfaRequiredResponse, isLoginSuccessResponse } from "../utils/authUtils";
import type { LoginResponse } from "../types/auth.types";

const successResponse: LoginResponse = {
  access: "eyJhbGciOiJIUzI1NiJ9.access",
  refresh: "eyJhbGciOiJIUzI1NiJ9.refresh",
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
