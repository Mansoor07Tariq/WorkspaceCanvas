import { describe, it, expect } from "vitest";
import { validateMfaChallengeForm } from "../utils/mfaChallengeValidation";
import { en } from "@/i18n/en";

describe("validateMfaChallengeForm — totp mode", () => {
  it("requires token when mode is totp", () => {
    const errors = validateMfaChallengeForm("totp", "", "");
    expect(errors.token).toBe(en.auth.mfaChallenge.invalidCodeRequired);
  });

  it("rejects whitespace-only token", () => {
    const errors = validateMfaChallengeForm("totp", "   ", "");
    expect(errors.token).toBe(en.auth.mfaChallenge.invalidCodeRequired);
  });

  it("rejects token shorter than 6 digits", () => {
    const errors = validateMfaChallengeForm("totp", "12345", "");
    expect(errors.token).toBe(en.auth.mfaChallenge.invalidCodeFormat);
  });

  it("rejects token longer than 6 digits", () => {
    const errors = validateMfaChallengeForm("totp", "1234567", "");
    expect(errors.token).toBe(en.auth.mfaChallenge.invalidCodeFormat);
  });

  it("rejects non-numeric token", () => {
    const errors = validateMfaChallengeForm("totp", "abc123", "");
    expect(errors.token).toBe(en.auth.mfaChallenge.invalidCodeFormat);
  });

  it("accepts a valid 6-digit numeric token", () => {
    const errors = validateMfaChallengeForm("totp", "123456", "");
    expect(errors).toEqual({});
  });
});

describe("validateMfaChallengeForm — recovery mode", () => {
  it("requires recovery code when mode is recovery", () => {
    const errors = validateMfaChallengeForm("recovery", "", "");
    expect(errors.recovery_code).toBe(en.auth.mfaChallenge.recoveryCodeRequired);
  });

  it("rejects whitespace-only recovery code", () => {
    const errors = validateMfaChallengeForm("recovery", "", "   ");
    expect(errors.recovery_code).toBe(en.auth.mfaChallenge.recoveryCodeRequired);
  });

  it("accepts a non-empty recovery code", () => {
    const errors = validateMfaChallengeForm("recovery", "", "ABCD-1234-EFGH");
    expect(errors).toEqual({});
  });

  it("does not validate token in recovery mode", () => {
    const errors = validateMfaChallengeForm("recovery", "", "some-recovery-code");
    expect(errors.token).toBeUndefined();
  });
});
