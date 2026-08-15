import { describe, it, expect } from "vitest";

import {
  buildWeekDays,
  dayPartFromHour,
  deskLabel,
  interpolate,
  officeLocalHour,
  rankNearest,
  resolveOrigin,
  scaleToFit,
  shouldEmphasizeTomorrow,
  toISODate,
} from "../todayLogic";
import type { OccupantPoint } from "../todayLogic";

describe("dayPartFromHour", () => {
  it("splits morning / afternoon / evening at 12 and 17", () => {
    expect(dayPartFromHour(0)).toBe("morning");
    expect(dayPartFromHour(11)).toBe("morning");
    expect(dayPartFromHour(12)).toBe("afternoon");
    expect(dayPartFromHour(16)).toBe("afternoon");
    expect(dayPartFromHour(17)).toBe("evening");
    expect(dayPartFromHour(23)).toBe("evening");
  });
});

describe("shouldEmphasizeTomorrow (the 14:00 flip)", () => {
  it("is false before 14:00 and true from 14:00 on (the boundary)", () => {
    expect(shouldEmphasizeTomorrow(13)).toBe(false);
    expect(shouldEmphasizeTomorrow(14)).toBe(true); // the tested edge
    expect(shouldEmphasizeTomorrow(15)).toBe(true);
    expect(shouldEmphasizeTomorrow(9)).toBe(false);
  });
});

describe("officeLocalHour", () => {
  it("returns an office-local hour for a fixed instant + timezone", () => {
    // 2026-08-10T12:00:00Z → 13:00 in Dublin (IST, UTC+1) that date.
    const instant = new Date("2026-08-10T12:00:00Z");
    expect(officeLocalHour(instant, "Europe/Dublin")).toBe(13);
    // Tokyo (UTC+9) → 21:00.
    expect(officeLocalHour(instant, "Asia/Tokyo")).toBe(21);
  });

  it("falls back to the local hour on a bad timezone", () => {
    const instant = new Date("2026-08-10T12:00:00Z");
    expect(officeLocalHour(instant, "Not/AZone")).toBe(instant.getHours());
  });
});

describe("buildWeekDays", () => {
  it("returns Mon–Fri of the containing week and flags today", () => {
    // 2026-08-12 is a Wednesday.
    const wed = new Date(2026, 7, 12, 10, 0, 0);
    const week = buildWeekDays(wed);
    expect(week).toHaveLength(5);
    expect(week.map((d) => d.dayLabel)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(week.map((d) => d.dayNumber)).toEqual([10, 11, 12, 13, 14]);
    expect(week.find((d) => d.isToday)?.dayNumber).toBe(12);
    expect(week.every((d) => !d.isWeekend)).toBe(true);
    expect(week[0].iso).toBe("2026-08-10");
  });

  it("handles a Sunday by backing up to the previous Monday", () => {
    // 2026-08-16 is a Sunday.
    const sun = new Date(2026, 7, 16, 9, 0, 0);
    const week = buildWeekDays(sun);
    expect(week[0].iso).toBe("2026-08-10");
    expect(week[4].iso).toBe("2026-08-14");
    expect(week.some((d) => d.isToday)).toBe(false); // Sunday isn't in Mon–Fri
  });
});

describe("toISODate", () => {
  it("emits local YYYY-MM-DD (not UTC)", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

function occ(deskId: number, x: number, y: number, isMine = false): OccupantPoint {
  return { deskId, layoutObjectId: deskId, userId: deskId, userName: `U${deskId}`, isMine, x, y };
}

describe("rankNearest", () => {
  it("returns the N nearest to the origin, closest first, excluding me", () => {
    const origin = { x: 0, y: 0 };
    const people = [
      occ(1, 100, 0),
      occ(2, 10, 0),
      occ(3, 30, 0),
      occ(4, 5, 0, true), // mine — excluded
      occ(5, 50, 0),
    ];
    const nearest = rankNearest(people, origin, 3);
    expect(nearest.map((p) => p.deskId)).toEqual([2, 3, 5]);
  });

  it("breaks ties by desk id for stable ordering", () => {
    const origin = { x: 0, y: 0 };
    const people = [occ(9, 10, 0), occ(3, 0, 10), occ(7, 6, 8)];
    // all at distance 10 → sorted by desk id
    expect(rankNearest(people, origin, 3).map((p) => p.deskId)).toEqual([3, 7, 9]);
  });

  it("returns [] for max 0", () => {
    expect(rankNearest([occ(1, 1, 1)], { x: 0, y: 0 }, 0)).toEqual([]);
  });
});

describe("resolveOrigin", () => {
  const people = [occ(1, 10, 0), occ(2, 20, 0)];
  it("prefers my booking", () => {
    expect(resolveOrigin({ x: 5, y: 5 }, { x: 99, y: 99 }, people)).toEqual({ x: 5, y: 5 });
  });
  it("falls back to the usual desk", () => {
    expect(resolveOrigin(null, { x: 7, y: 7 }, people)).toEqual({ x: 7, y: 7 });
  });
  it("falls back to the centroid of occupants", () => {
    expect(resolveOrigin(null, null, people)).toEqual({ x: 15, y: 0 });
  });
  it("falls back to origin when nothing is known", () => {
    expect(resolveOrigin(null, null, [])).toEqual({ x: 0, y: 0 });
  });
});

describe("scaleToFit", () => {
  it("scales down to fit and never upscales", () => {
    expect(scaleToFit(800, 400)).toBe(0.5);
    expect(scaleToFit(400, 800)).toBe(1);
    expect(scaleToFit(0, 400)).toBe(1);
  });
});

describe("deskLabel (never doubles 'Desk')", () => {
  it("leaves a name that already says 'desk' untouched", () => {
    expect(deskLabel("Desk 14")).toBe("Desk 14"); // not "Desk Desk 14"
    expect(deskLabel("Window desk")).toBe("Window desk");
  });
  it("prefixes a bare code", () => {
    expect(deskLabel("14")).toBe("Desk 14");
    expect(deskLabel("A1")).toBe("Desk A1");
    expect(deskLabel(14)).toBe("Desk 14");
  });
  it("handles empty / nullish", () => {
    expect(deskLabel("")).toBe("Desk");
    expect(deskLabel(null)).toBe("Desk");
    expect(deskLabel(undefined)).toBe("Desk");
  });
});

describe("interpolate", () => {
  it("replaces {vars} and leaves unknowns", () => {
    expect(interpolate("{a} + {b}", { a: 1, b: "two" })).toBe("1 + two");
    expect(interpolate("{missing}", {})).toBe("{missing}");
  });
});
