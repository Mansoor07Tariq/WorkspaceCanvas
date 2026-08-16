import { describe, it, expect } from "vitest";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { getIsoAssetsByBaseType } from "../isometric/isoManifest";
import { fnv1a, isBookedStatus, pickDeskSpriteKey } from "../isometric/deskSprite";

describe("fnv1a", () => {
  it("is deterministic for the same input", () => {
    expect(fnv1a("42")).toBe(fnv1a("42"));
  });

  it("differs across inputs (well-distributed)", () => {
    expect(fnv1a("1")).not.toBe(fnv1a("2"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = fnv1a("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("isBookedStatus", () => {
  it("is true only for reserved / bookedByMe", () => {
    expect(isBookedStatus("reserved")).toBe(true);
    expect(isBookedStatus("bookedByMe")).toBe(true);
    expect(isBookedStatus("available")).toBe(false);
    expect(isBookedStatus("unavailable")).toBe(false);
    expect(isBookedStatus(undefined)).toBe(false);
  });
});

describe("pickDeskSpriteKey", () => {
  const freePool = getIsoAssetsByBaseType("Desk+System").filter((a) => a.descriptor === "Less");
  const bookedPool = getIsoAssetsByBaseType("Desk+Chair");

  it("has non-empty sprite pools (manifest sanity)", () => {
    expect(freePool.length).toBeGreaterThan(0);
    expect(bookedPool.length).toBeGreaterThan(0);
  });

  it("free/available desks draw the clean Desk+System 'Less' variant", () => {
    const key = pickDeskSpriteKey(1, "available");
    expect(freePool.map((a) => a.key)).toContain(key);
  });

  it("booked desks draw the bare Desk+Chair (empty top for the identity tile)", () => {
    for (const status of ["reserved", "bookedByMe"] as DeskAvailabilityStatus[]) {
      const key = pickDeskSpriteKey(1, status);
      expect(bookedPool.map((a) => a.key)).toContain(key);
    }
  });

  it("is deterministic: the same desk id + state always yields the same sprite", () => {
    expect(pickDeskSpriteKey(7, "available")).toBe(pickDeskSpriteKey(7, "available"));
    expect(pickDeskSpriteKey(7, "reserved")).toBe(pickDeskSpriteKey(7, "reserved"));
  });

  it("treats variants as aesthetic (state, not id, moves between pools)", () => {
    // Same id: free vs booked must come from different pools, so the keys differ.
    const free = pickDeskSpriteKey(3, "available");
    const booked = pickDeskSpriteKey(3, "reserved");
    expect(free).not.toBe(booked);
  });
});
