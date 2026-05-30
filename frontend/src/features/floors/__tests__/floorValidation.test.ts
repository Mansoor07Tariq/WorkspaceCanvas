import { describe, it, expect } from "vitest";
import { validateFloorName, validateFloorLevel, buildFloorPayload } from "../utils/floorValidation";
import type { FloorFormFields } from "../types/floor.types";

const baseFields: FloorFormFields = {
  name: "Ground Floor",
  level_number: "0",
};

describe("validateFloorName", () => {
  it("returns error for empty name", () => {
    expect(validateFloorName("")).toBeTruthy();
  });

  it("returns error for whitespace-only name", () => {
    expect(validateFloorName("   ")).toBeTruthy();
  });

  it("returns undefined for valid name", () => {
    expect(validateFloorName("Ground Floor")).toBeUndefined();
  });
});

describe("validateFloorLevel", () => {
  it("returns undefined for empty string (defaults to 0)", () => {
    expect(validateFloorLevel("")).toBeUndefined();
  });

  it("returns undefined for valid integer 0", () => {
    expect(validateFloorLevel("0")).toBeUndefined();
  });

  it("returns undefined for positive integer", () => {
    expect(validateFloorLevel("1")).toBeUndefined();
    expect(validateFloorLevel("10")).toBeUndefined();
  });

  it("returns undefined for negative integer", () => {
    expect(validateFloorLevel("-1")).toBeUndefined();
  });

  it("returns error for decimal value", () => {
    expect(validateFloorLevel("1.5")).toBeTruthy();
  });

  it("returns error for non-number string", () => {
    expect(validateFloorLevel("abc")).toBeTruthy();
    expect(validateFloorLevel("ground")).toBeTruthy();
  });

  it("returns error for mixed input", () => {
    expect(validateFloorLevel("1a")).toBeTruthy();
  });
});

describe("buildFloorPayload", () => {
  it("trims name", () => {
    const payload = buildFloorPayload({ ...baseFields, name: "  Ground Floor  " });
    expect(payload.name).toBe("Ground Floor");
  });

  it("uses 0 for empty level_number", () => {
    const payload = buildFloorPayload({ ...baseFields, level_number: "" });
    expect(payload.level_number).toBe(0);
  });

  it("parses integer level_number", () => {
    const payload = buildFloorPayload({ ...baseFields, level_number: "1" });
    expect(payload.level_number).toBe(1);
  });

  it("parses negative level_number", () => {
    const payload = buildFloorPayload({ ...baseFields, level_number: "-1" });
    expect(payload.level_number).toBe(-1);
  });

  it("level_number is a number type in payload", () => {
    const payload = buildFloorPayload(baseFields);
    expect(typeof payload.level_number).toBe("number");
  });
});
