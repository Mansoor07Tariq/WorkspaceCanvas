import { describe, it, expect } from "vitest";
import { validateResendVerificationForm } from "../utils/emailVerificationValidation";
import { en } from "@/i18n/en";

describe("validateResendVerificationForm", () => {
  it("returns email required when email is empty", () => {
    const errors = validateResendVerificationForm("");
    expect(errors.email).toBe(en.auth.validation.emailRequired);
  });

  it("returns email required when email is whitespace only", () => {
    const errors = validateResendVerificationForm("   ");
    expect(errors.email).toBe(en.auth.validation.emailRequired);
  });

  it("returns invalid email when format is wrong", () => {
    const errors = validateResendVerificationForm("not-an-email");
    expect(errors.email).toBe(en.auth.validation.invalidEmail);
  });

  it("returns empty object for a valid email", () => {
    const errors = validateResendVerificationForm("user@example.com");
    expect(errors).toEqual({});
  });
});
