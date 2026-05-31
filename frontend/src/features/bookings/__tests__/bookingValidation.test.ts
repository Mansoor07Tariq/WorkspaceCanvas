import { describe, it, expect } from "vitest";
import {
  isValidBookingDate,
  isPastBookingDate,
  todayLocalDate,
  formatBookingDate,
} from "../utils/bookingValidation";

describe("isValidBookingDate", () => {
  it('returns true for a valid date "2026-06-01"', () => {
    expect(isValidBookingDate("2026-06-01")).toBe(true);
  });

  it('returns false for an invalid month "2026-13-01"', () => {
    expect(isValidBookingDate("2026-13-01")).toBe(false);
  });

  it('returns false for a non-date string "not-a-date"', () => {
    expect(isValidBookingDate("not-a-date")).toBe(false);
  });

  it('returns false for a non-existent date "2026-02-30" (Feb 30 does not exist)', () => {
    expect(isValidBookingDate("2026-02-30")).toBe(false);
  });

  it('returns false for an empty string ""', () => {
    expect(isValidBookingDate("")).toBe(false);
  });
});

describe("isPastBookingDate", () => {
  it('returns true for a clearly past date "1990-01-01"', () => {
    expect(isPastBookingDate("1990-01-01")).toBe(true);
  });

  it('returns false for a clearly future date "2090-01-01"', () => {
    expect(isPastBookingDate("2090-01-01")).toBe(false);
  });
});

describe("todayLocalDate", () => {
  it("returns a string matching YYYY-MM-DD format", () => {
    expect(todayLocalDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a value that passes isValidBookingDate", () => {
    expect(isValidBookingDate(todayLocalDate())).toBe(true);
  });
});

describe("formatBookingDate", () => {
  it('returns a non-empty string for "2026-06-01"', () => {
    const result = formatBookingDate("2026-06-01");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a string without throwing", () => {
    const result = formatBookingDate("2026-06-01");
    expect(typeof result).toBe("string");
  });
});
