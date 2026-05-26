import { describe, it, expect } from "vitest";
import {
  validateOrgName,
  validateAllowedDomain,
  validateOrgSetupStep,
} from "../utils/orgValidation";

describe("validateOrgName", () => {
  it("returns error for empty string", () => {
    expect(validateOrgName("")).toBeDefined();
  });

  it("returns error for whitespace-only string", () => {
    expect(validateOrgName("   ")).toBeDefined();
  });

  it("returns undefined for valid name", () => {
    expect(validateOrgName("Acme Corp")).toBeUndefined();
  });
});

describe("validateAllowedDomain", () => {
  it("returns undefined for empty string (field is optional)", () => {
    expect(validateAllowedDomain("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(validateAllowedDomain("   ")).toBeUndefined();
  });

  it("returns undefined for valid domain", () => {
    expect(validateAllowedDomain("example.com")).toBeUndefined();
  });

  it("returns undefined for uppercase domain (frontend accepts it; backend lowercases)", () => {
    expect(validateAllowedDomain("ACME.COM")).toBeUndefined();
  });

  it("returns undefined for subdomain", () => {
    expect(validateAllowedDomain("mail.example.co.uk")).toBeUndefined();
  });

  it("returns error for email address", () => {
    expect(validateAllowedDomain("user@example.com")).toBeDefined();
  });

  it("returns error for URL with https", () => {
    expect(validateAllowedDomain("https://example.com")).toBeDefined();
  });

  it("returns error for URL with http", () => {
    expect(validateAllowedDomain("http://example.com")).toBeDefined();
  });

  it("returns error for domain with path", () => {
    expect(validateAllowedDomain("example.com/team")).toBeDefined();
  });

  it("returns error for string with no TLD", () => {
    expect(validateAllowedDomain("notadomain")).toBeDefined();
  });
});

describe("validateOrgSetupStep", () => {
  it("validates name on the name step", () => {
    const errors = validateOrgSetupStep("name", "", "");
    expect(errors.name).toBeDefined();
    expect(errors.allowed_email_domain).toBeUndefined();
  });

  it("passes name step when name is provided", () => {
    const errors = validateOrgSetupStep("name", "Acme", "");
    expect(errors.name).toBeUndefined();
  });

  it("validates domain on the domain step", () => {
    const errors = validateOrgSetupStep("domain", "Acme", "notadomain");
    expect(errors.allowed_email_domain).toBeDefined();
    expect(errors.name).toBeUndefined();
  });

  it("passes domain step when domain is empty (optional)", () => {
    const errors = validateOrgSetupStep("domain", "Acme", "");
    expect(errors.allowed_email_domain).toBeUndefined();
  });

  it("returns no errors for steps without validation (welcome, type, review)", () => {
    expect(validateOrgSetupStep("welcome", "", "")).toEqual({});
    expect(validateOrgSetupStep("type", "", "notadomain")).toEqual({});
    expect(validateOrgSetupStep("review", "", "notadomain")).toEqual({});
  });
});
