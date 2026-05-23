import { describe, it, expect } from "vitest";
import { validateSignupForm, validatePasswordConfirmation } from "../utils/signupValidation";

describe("validateSignupForm", () => {
  it("requires email", () => {
    expect(validateSignupForm("", "", "password1").email).toBe("Email is required.");
  });

  it("validates email format", () => {
    expect(validateSignupForm("", "notanemail", "password1").email).toBe(
      "Enter a valid email address."
    );
  });

  it("requires password", () => {
    expect(validateSignupForm("", "a@b.com", "").password).toBe("Password is required.");
  });

  it("validates password minimum length", () => {
    expect(validateSignupForm("", "a@b.com", "short").password).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("validates full name max length", () => {
    expect(validateSignupForm("a".repeat(256), "a@b.com", "password1").full_name).toBe(
      "Full name must be 255 characters or fewer."
    );
  });

  it("returns no errors for valid inputs", () => {
    expect(validateSignupForm("Jane Smith", "jane@example.com", "password1")).toEqual({});
  });

  it("full name is optional — no error when empty", () => {
    expect(validateSignupForm("", "a@b.com", "password1").full_name).toBeUndefined();
  });
});

describe("validatePasswordConfirmation", () => {
  it("requires confirm password", () => {
    expect(validatePasswordConfirmation("password1", "")).toBe("Please confirm your password.");
  });

  it("returns mismatch error when passwords differ", () => {
    expect(validatePasswordConfirmation("password1", "different")).toBe("Passwords do not match.");
  });

  it("returns empty string when passwords match", () => {
    expect(validatePasswordConfirmation("password1", "password1")).toBe("");
  });
});
