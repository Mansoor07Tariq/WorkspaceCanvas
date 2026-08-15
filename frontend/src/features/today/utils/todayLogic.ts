/**
 * Pure logic for the Today screen (PR 079). No React, no I/O — everything here is a
 * deterministic function of its inputs so it can be unit-tested directly (the time-of-day
 * flip at the 14:00 office-local boundary, the nearest-N ranking, the week strip).
 */

/**
 * One shared desk label that never doubles the word "Desk" (PR 079 fix-up). Desk display
 * names already vary — "Desk 14", a bare code "14"/"A1", or a descriptive "Window desk".
 * Prefix "Desk " only when the name doesn't already say "desk", so we never render
 * "Desk Desk 14".
 */
export function deskLabel(name: string | number | null | undefined): string {
  const s = String(name ?? "").trim();
  if (!s) return "Desk";
  return /desk/i.test(s) ? s : `Desk ${s}`;
}

/** Minimal `{name}`-style interpolation for the hand-rolled i18n strings. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

export type DayPart = "morning" | "afternoon" | "evening";

/** The office-local hour (0–23) for `now`, honouring an IANA `timeZone` when given. */
export function officeLocalHour(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getHours();
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
    // Intl may emit "24" for midnight under some engines; normalise to 0–23.
    return Number(hourPart) % 24;
  } catch {
    return now.getHours();
  }
}

/** morning < 12:00, afternoon 12:00–16:59, evening ≥ 17:00 (office-local). */
export function dayPartFromHour(hour: number): DayPart {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * After 14:00 office-local, an un-booked "Today" flips its emphasis from "book today" to
 * "plan tomorrow" (the office day is mostly gone). The 14:00 boundary is the tested edge.
 */
export function shouldEmphasizeTomorrow(hour: number): boolean {
  return hour >= 14;
}

export interface WeekDay {
  /** local date at midnight */
  date: Date;
  /** YYYY-MM-DD (local) — the key used for occupancy fetches */
  iso: string;
  /** day-of-month, e.g. 10 */
  dayNumber: number;
  /** short weekday label, e.g. "Mon" */
  dayLabel: string;
  isToday: boolean;
  isWeekend: boolean;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Local YYYY-MM-DD (never UTC — bookings are office-day keyed). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Monday–Friday of the week containing `today`. Today is flagged; the ISO key is what the
 * week strip and map use to fetch that day's occupancy.
 */
export function buildWeekDays(today: Date): WeekDay[] {
  const todayIso = toISODate(today);
  // Back up to Monday (getDay(): 0=Sun … 6=Sat).
  const monday = new Date(today);
  const dow = monday.getDay();
  const deltaToMonday = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + deltaToMonday);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 5 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const iso = toISODate(date);
    return {
      date,
      iso,
      dayNumber: date.getDate(),
      dayLabel: WEEKDAY_LABELS[date.getDay()],
      isToday: iso === todayIso,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

export interface Point {
  x: number;
  y: number;
}

export interface OccupantPoint extends Point {
  deskId: number;
  layoutObjectId: number | null;
  userId: number | null;
  userName: string;
  isMine: boolean;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The `max` occupants nearest `origin`, closest first, EXCLUDING the viewer's own desk.
 * Ties break by desk id for stable ordering. This is the "near you" ranking.
 */
export function rankNearest(
  occupants: OccupantPoint[],
  origin: Point,
  max: number
): OccupantPoint[] {
  return occupants
    .filter((o) => !o.isMine)
    .map((o) => ({ o, d: distance(o, origin) }))
    .sort((p, q) => p.d - q.d || p.o.deskId - q.o.deskId)
    .slice(0, Math.max(0, max))
    .map((p) => p.o);
}

/**
 * The origin point for "near you" ranking, in priority order:
 * 1. the viewer's booking on the selected day, else
 * 2. the viewer's usual desk, else
 * 3. the geometric centre of all occupied desks (fallback), else {0,0}.
 */
export function resolveOrigin(
  myOccupant: Point | null,
  usualDeskPoint: Point | null,
  occupants: OccupantPoint[]
): Point {
  if (myOccupant) return { x: myOccupant.x, y: myOccupant.y };
  if (usualDeskPoint) return { x: usualDeskPoint.x, y: usualDeskPoint.y };
  if (occupants.length > 0) {
    const sum = occupants.reduce((acc, o) => ({ x: acc.x + o.x, y: acc.y + o.y }), { x: 0, y: 0 });
    return { x: sum.x / occupants.length, y: sum.y / occupants.length };
  }
  return { x: 0, y: 0 };
}

/**
 * Scale factor to fit a natural content width into a container width (never upscale past
 * 1). Pure helper behind the phone "map scales to fit, no sideways scroll" requirement.
 */
export function scaleToFit(contentWidth: number, containerWidth: number): number {
  if (contentWidth <= 0 || containerWidth <= 0) return 1;
  return Math.min(1, containerWidth / contentWidth);
}
