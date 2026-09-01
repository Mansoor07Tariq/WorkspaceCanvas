import { describe, it, expect } from "vitest";
import type { DeskAvailabilityStatus } from "@/features/bookings/utils/bookingAvailability";
import { getIsoAsset } from "../isometric/isoManifest";
import {
  BARE_DESCRIPTOR,
  fnv1a,
  isBookedStatus,
  pickDeskSpriteKey,
  selectableDeskDesigns,
} from "../isometric/deskSprite";
import { VERIFIED_DESKTOP_RECT_KEYS, getDesktopRect } from "../isometric/spriteGeometry";

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

describe("pickDeskSpriteKey — booking clears the desk, it does not replace it (PR 084)", () => {
  const FLOORS = Array.from({ length: 40 }, (_, i) => i + 1);
  const designs = selectableDeskDesigns();

  it("every selectable design is a BARE variant with a real emitted asset", () => {
    expect(designs.length).toBeGreaterThan(0);
    for (const d of designs) {
      expect(d.descriptor).toBe(BARE_DESCRIPTOR);
      expect(d.outputs.length).toBeGreaterThan(0);
    }
  });

  it("a booked desk resolves to the BARE variant of the design", () => {
    // Replaces "booked desks draw the bare Desk+Chair". `Desk+Chair` is no longer used for desks:
    // it is a different desk at different dimensions, so swapping to it resized the sprite.
    const bare = new Set(designs.map((d) => d.key));
    for (const f of FLOORS) {
      for (const status of ["reserved", "bookedByMe"] as DeskAvailabilityStatus[]) {
        expect(bare).toContain(pickDeskSpriteKey(f, status));
      }
    }
  });

  it("a free desk resolves to the SAME design, differing only by clutter", () => {
    // The heart of the PR: free and booked share `variantIndex` (same desk) and differ only in
    // `descriptor` (the stuff on it).
    for (const f of FLOORS) {
      const free = getIsoAsset(pickDeskSpriteKey(f, "available")!)!;
      const booked = getIsoAsset(pickDeskSpriteKey(f, "reserved")!)!;
      expect(free.variantIndex).toBe(booked.variantIndex); // same desk
      expect(free.baseType).toBe(booked.baseType);
      expect(booked.descriptor).toBe(BARE_DESCRIPTOR);
      expect(free.descriptor).not.toBe(BARE_DESCRIPTOR); // …only the clutter differs
      expect(free.key).not.toBe(booked.key);
    }
  });

  it("free and booked are DIMENSIONALLY IDENTICAL — booking must not resize or move the desk", () => {
    // Criterion 1, and the one most likely to be missed. `fitFootprint` fills the object's width
    // and anchors the bottom, so the drawn height and anchor follow the asset's aspect ratio: two
    // assets with different trimmed boxes draw at different sizes. Asserting equal outputs at every
    // width is what makes "the same desk in the same place" a fact rather than an intention.
    for (const f of FLOORS) {
      const free = getIsoAsset(pickDeskSpriteKey(f, "available")!)!;
      const booked = getIsoAsset(pickDeskSpriteKey(f, "reserved")!)!;
      expect(free.aspectRatio).toBe(booked.aspectRatio);
      expect(free.trimmed).toEqual(booked.trimmed);
      expect(free.outputs.map((o) => o.width)).toEqual(booked.outputs.map((o) => o.width));
    }
  });

  it("the booked key's desktopRect is MEASURED, not inherited (the review/47 guard)", () => {
    // review/47 found four rects measured against the wrong art, sitting on a monitor, harmless
    // only because nothing used them. This fails the moment a booked desk resolves to art whose
    // rect nobody has verified.
    for (const f of FLOORS) {
      const key = pickDeskSpriteKey(f, "reserved")!;
      expect(VERIFIED_DESKTOP_RECT_KEYS).toContain(key);
      const rect = getDesktopRect(key);
      expect(rect).not.toEqual(getDesktopRect(undefined)); // a real override, not the default
      expect(rect.w).toBeGreaterThan(0);
      expect(rect.h).toBeGreaterThan(0);
    }
  });

  it("no design is selectable without a bare counterpart (criterion 5)", () => {
    // Desk+System 3 and 4 bake the monitor into layer zero, so they can never show a clear desktop
    // and must not be reachable at all — a floor that picked one could not render a booked desk.
    const selectable = new Set(designs.map((d) => d.variantIndex));
    for (const f of FLOORS) {
      expect(selectable).toContain(getIsoAsset(pickDeskSpriteKey(f, "available")!)!.variantIndex);
    }
    expect(selectable).not.toContain(3);
    expect(selectable).not.toContain(4);
  });

  it("the `Less` filter is GONE, not retuned", () => {
    // review/47 measured the old premise as false: `Less` has MORE on the desktop than the plain
    // variant. Free desks must no longer be pinned to that descriptor.
    const freeDescriptors = new Set(
      FLOORS.map((f) => getIsoAsset(pickDeskSpriteKey(f, "available")!)!.descriptor)
    );
    expect(freeDescriptors.size).toBeGreaterThan(0);
    expect([...freeDescriptors].every((d) => d === "Less")).toBe(false);
  });

  it("stays floor-scoped and deterministic (PR 082 unchanged)", () => {
    expect(pickDeskSpriteKey(7, "available")).toBe(pickDeskSpriteKey(7, "available"));
    expect(pickDeskSpriteKey(7, "reserved")).toBe(pickDeskSpriteKey(7, "reserved"));
    const keys = new Set(FLOORS.map((f) => pickDeskSpriteKey(f, "available")));
    expect(keys.size).toBeGreaterThan(1); // floors do not all collapse to one design
  });
});
