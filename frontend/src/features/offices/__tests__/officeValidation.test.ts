import { describe, it, expect } from "vitest";
import {
  validateOfficeName,
  validateOfficeTimezone,
  buildOfficePayload,
} from "../utils/officeValidation";
import type { OfficeFormFields } from "../types/office.types";

const baseFields: OfficeFormFields = {
  name: "Dublin Office",
  address_line_1: "",
  address_line_2: "",
  city: "",
  county_or_state: "",
  country: "",
  timezone: "",
};

describe("validateOfficeName", () => {
  it("returns error for empty name", () => {
    expect(validateOfficeName("")).toBeTruthy();
  });

  it("returns error for whitespace-only name", () => {
    expect(validateOfficeName("   ")).toBeTruthy();
  });

  it("returns undefined for valid name", () => {
    expect(validateOfficeName("Dublin Office")).toBeUndefined();
  });
});

describe("validateOfficeTimezone", () => {
  it("returns undefined for empty timezone", () => {
    expect(validateOfficeTimezone("")).toBeUndefined();
  });

  it("returns undefined for valid timezone", () => {
    expect(validateOfficeTimezone("Europe/Dublin")).toBeUndefined();
    expect(validateOfficeTimezone("America/New_York")).toBeUndefined();
    expect(validateOfficeTimezone("UTC")).toBeUndefined();
  });

  it("returns error for invalid timezone format", () => {
    expect(validateOfficeTimezone("not a timezone")).toBeTruthy();
    expect(validateOfficeTimezone("123Invalid")).toBeTruthy();
  });
});

describe("buildOfficePayload", () => {
  it("trims name", () => {
    const payload = buildOfficePayload({ ...baseFields, name: "  Dublin  " });
    expect(payload.name).toBe("Dublin");
  });

  it("omits empty optional fields", () => {
    const payload = buildOfficePayload(baseFields);
    expect(payload).not.toHaveProperty("city");
    expect(payload).not.toHaveProperty("country");
    expect(payload).not.toHaveProperty("timezone");
  });

  it("includes populated optional fields trimmed", () => {
    const payload = buildOfficePayload({
      ...baseFields,
      city: "  Dublin  ",
      country: "  Ireland  ",
      timezone: "  Europe/Dublin  ",
    });
    expect(payload.city).toBe("Dublin");
    expect(payload.country).toBe("Ireland");
    expect(payload.timezone).toBe("Europe/Dublin");
  });
});
