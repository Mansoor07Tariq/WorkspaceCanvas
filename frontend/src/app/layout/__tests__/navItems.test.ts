import { describe, it, expect } from "vitest";

import { NAV_ITEMS, isNavItemActive } from "../navItems";
import { ROUTES } from "@/routes/paths";

describe("NAV_ITEMS", () => {
  it("is the 5 renamed destinations in order", () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      "today",
      "book-desk",
      "book-room",
      "my-bookings",
      "people",
    ]);
  });

  it("marks 4 primary destinations for the phone bottom bar (People excluded)", () => {
    const bottom = NAV_ITEMS.filter((i) => i.bottomBar).map((i) => i.id);
    expect(bottom).toEqual(["today", "book-desk", "book-room", "my-bookings"]);
    expect(bottom).not.toContain("people");
  });
});

describe("isNavItemActive", () => {
  const today = NAV_ITEMS.find((i) => i.id === "today")!;
  const bookDesk = NAV_ITEMS.find((i) => i.id === "book-desk")!;
  const myBookings = NAV_ITEMS.find((i) => i.id === "my-bookings")!;
  const people = NAV_ITEMS.find((i) => i.id === "people")!;

  it("Today matches only the exact home path (not /app sub-routes)", () => {
    expect(isNavItemActive(today, ROUTES.app)).toBe(true);
    expect(isNavItemActive(today, ROUTES.bookings)).toBe(false);
    expect(isNavItemActive(today, ROUTES.myBookings)).toBe(false);
  });

  it("the booking routes are distinguished by exact path (not prefix)", () => {
    // /app/bookings must NOT light up on /app/bookings/my or /app/bookings/rooms.
    expect(isNavItemActive(bookDesk, ROUTES.bookings)).toBe(true);
    expect(isNavItemActive(bookDesk, ROUTES.myBookings)).toBe(false);
    expect(isNavItemActive(bookDesk, ROUTES.rooms)).toBe(false);
    expect(isNavItemActive(myBookings, ROUTES.myBookings)).toBe(true);
    expect(isNavItemActive(myBookings, ROUTES.bookings)).toBe(false);
  });

  it("People matches its path and sub-paths", () => {
    expect(isNavItemActive(people, ROUTES.people)).toBe(true);
    expect(isNavItemActive(people, `${ROUTES.people}/123`)).toBe(true);
  });
});
