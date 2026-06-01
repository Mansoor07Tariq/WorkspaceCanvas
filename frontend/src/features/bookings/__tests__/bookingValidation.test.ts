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

  it('contains the year "2026" in the formatted output for "2026-06-01"', () => {
    const result = formatBookingDate("2026-06-01");
    expect(result).toContain("2026");
  });
});

describe("isPastBookingDate — boundary cases", () => {
  it("returns false for today's date (today is not in the past)", () => {
    expect(isPastBookingDate(todayLocalDate())).toBe(false);
  });

  it("returns false for a future date", () => {
    expect(isPastBookingDate("2090-01-01")).toBe(false);
  });

  it("returns true for a past date", () => {
    expect(isPastBookingDate("1990-01-01")).toBe(true);
  });
});

describe("isValidBookingDate — additional coverage", () => {
  it("returns true for today's date", () => {
    expect(isValidBookingDate(todayLocalDate())).toBe(true);
  });

  it("returns true for a far-future date", () => {
    expect(isValidBookingDate("2090-12-31")).toBe(true);
  });

  it('returns false for an invalid day "2026-01-32"', () => {
    expect(isValidBookingDate("2026-01-32")).toBe(false);
  });

  it('returns false for a date missing leading zeros "2026-1-1"', () => {
    expect(isValidBookingDate("2026-1-1")).toBe(false);
  });
});
