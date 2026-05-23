import { describe, it, expect } from "vitest";
import { validateLoginForm } from "../utils/loginValidation";
import { en } from "@/i18n/en";

describe("validateLoginForm", () => {
  it("returns email required error when email is empty", () => {
    const errors = validateLoginForm("", "password123");
    expect(errors.email).toBe(en.auth.validation.emailRequired);
  });

  it("returns email required error when email is only whitespace", () => {
    const errors = validateLoginForm("   ", "password123");
    expect(errors.email).toBe(en.auth.validation.emailRequired);
  });

  it("returns invalid email error when email format is wrong", () => {
    const errors = validateLoginForm("not-an-email", "password123");
    expect(errors.email).toBe(en.auth.validation.invalidEmail);
  });

  it("returns password required error when password is empty", () => {
    const errors = validateLoginForm("user@example.com", "");
    expect(errors.password).toBe(en.auth.validation.passwordRequired);
  });

  it("returns both errors when both fields are empty", () => {
    const errors = validateLoginForm("", "");
    expect(errors.email).toBe(en.auth.validation.emailRequired);
    expect(errors.password).toBe(en.auth.validation.passwordRequired);
  });

  it("returns empty object for valid email and password", () => {
    const errors = validateLoginForm("user@example.com", "password123");
    expect(errors).toEqual({});
  });
});
