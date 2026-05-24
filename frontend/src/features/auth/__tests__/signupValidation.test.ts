import { describe, it, expect } from "vitest";
import { validateSignupForm, validatePasswordConfirmation } from "../utils/signupValidation";

const VALID_PASSWORD = "Strongpass1!";

describe("validateSignupForm", () => {
  it("requires email", () => {
    expect(validateSignupForm("", "", VALID_PASSWORD).email).toBe("Email is required.");
  });

  it("validates email format", () => {
    expect(validateSignupForm("", "notanemail", VALID_PASSWORD).email).toBe(
      "Enter a valid email address."
    );
  });

  it("requires password", () => {
    expect(validateSignupForm("", "a@b.com", "").password).toBe("Password is required.");
  });

  it("rejects password shorter than 8 characters", () => {
    expect(validateSignupForm("", "a@b.com", "Short1!").password).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("rejects password with no uppercase letter", () => {
    expect(validateSignupForm("", "a@b.com", "weakpass1!").password).toBe(
      "Password must contain at least one uppercase letter."
    );
  });

  it("rejects password with no number", () => {
    expect(validateSignupForm("", "a@b.com", "Weakpass!").password).toBe(
      "Password must contain at least one number."
    );
  });

  it("rejects password with no special character", () => {
    expect(validateSignupForm("", "a@b.com", "Weakpass1").password).toBe(
      "Password must contain at least one special character."
    );
  });

  it("validates full name max length", () => {
    expect(validateSignupForm("a".repeat(256), "a@b.com", VALID_PASSWORD).full_name).toBe(
      "Full name must be 255 characters or fewer."
    );
  });

  it("returns no errors for valid inputs", () => {
    expect(validateSignupForm("Jane Smith", "jane@example.com", VALID_PASSWORD)).toEqual({});
  });

  it("full name is optional — no error when empty", () => {
    expect(validateSignupForm("", "a@b.com", VALID_PASSWORD).full_name).toBeUndefined();
  });
});

describe("validatePasswordConfirmation", () => {
  it("requires confirm password", () => {
    expect(validatePasswordConfirmation(VALID_PASSWORD, "")).toBe("Please confirm your password.");
  });

  it("returns mismatch error when passwords differ", () => {
    expect(validatePasswordConfirmation(VALID_PASSWORD, "different")).toBe(
      "Passwords do not match."
    );
  });

  it("returns empty string when passwords match", () => {
    expect(validatePasswordConfirmation(VALID_PASSWORD, VALID_PASSWORD)).toBe("");
  });
});
