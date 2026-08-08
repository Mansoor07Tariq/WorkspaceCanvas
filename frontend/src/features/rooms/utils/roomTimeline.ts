/**
 * Pure timeline math for the room booking page (PR 074).
 *
 * The API returns booking times as UTC instants (`start_at`/`end_at`). The UI
 * renders them on an OFFICE-LOCAL day timeline and lets the user pick office-local
 * slots. These helpers convert UTC → office-local minutes-from-midnight, clip to a
 * display window, and answer the client-side conflict pre-check. All pure and
 * timezone-explicit so they can be unit-tested with fixed instants + a fixed tz.
 *
 * The office timezone comes from `office.timezone`; callers pass `office.timezone
 * || "UTC"` (an empty office tz means the backend judged the slot against
 * BOOKING_DEFAULT_TIMEZONE, whose shipped default is UTC — see review/21).
 */
import type { RoomBooking } from "../types/room.types";

/** Business-day display window (office-local minutes). Display-only — NOT a backend rule. */
export const DAY_START_MIN = 6 * 60; // 06:00
export const DAY_END_MIN = 22 * 60; // 22:00
export const SLOT_STEP_MIN = 15;
export const MIN_DURATION_MIN = 15;
export const MAX_DURATION_MIN = 8 * 60;

export interface TimelineWindow {
  dayStartMin: number;
  dayEndMin: number;
}

const DEFAULT_WINDOW: TimelineWindow = {
  dayStartMin: DAY_START_MIN,
  dayEndMin: DAY_END_MIN,
};

/** Office-local minutes-from-midnight for a UTC instant. Falls back to UTC on a
 * bad timezone string rather than throwing. */
export function officeMinutesOfInstant(iso: string, timeZone: string): number {
  const parts = officeTimeParts(iso, timeZone);
  return parts.hour * 60 + parts.minute;
}

/** Office-local "HH:MM" for a UTC instant. */
export function officeTimeLabel(iso: string, timeZone: string): string {
  const { hour, minute } = officeTimeParts(iso, timeZone);
  return `${pad2(hour)}:${pad2(minute)}`;
}

function officeTimeParts(iso: string, timeZone: string): { hour: number; minute: number } {
  const date = new Date(iso);
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
  }
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

export interface TimelineSegment {
  bookingId: number;
  /** Office-local minutes, clipped to the display window. */
  startMin: number;
  endMin: number;
  /** Position within the window, 0–100. */
  leftPct: number;
  widthPct: number;
  status: "mine" | "reserved";
  /** Unclipped office-local labels for a11y / tooltips. */
  startLabel: string;
  endLabel: string;
}

function isActive(b: RoomBooking): boolean {
  return b.status === "active";
}

/**
 * Build the positioned, clipped segments for a room's active bookings, in
 * office-local time, sorted by start. Bookings entirely outside the display
 * window are dropped from the bar (they remain in the text summary derived from
 * the same bookings).
 */
export function buildTimelineSegments(
  bookings: RoomBooking[],
  timeZone: string,
  window: TimelineWindow = DEFAULT_WINDOW
): TimelineSegment[] {
  const { dayStartMin, dayEndMin } = window;
  const span = dayEndMin - dayStartMin;
  if (span <= 0) return [];

  const segments: TimelineSegment[] = [];
  for (const b of bookings) {
    if (!isActive(b)) continue;
    const s = officeMinutesOfInstant(b.start_at, timeZone);
    const e = officeMinutesOfInstant(b.end_at, timeZone);
    if (e <= s) continue;
    const clippedStart = Math.max(s, dayStartMin);
    const clippedEnd = Math.min(e, dayEndMin);
    if (clippedEnd <= clippedStart) continue; // outside the display window
    segments.push({
      bookingId: b.id,
      startMin: clippedStart,
      endMin: clippedEnd,
      leftPct: ((clippedStart - dayStartMin) / span) * 100,
      widthPct: ((clippedEnd - clippedStart) / span) * 100,
      status: b.is_mine ? "mine" : "reserved",
      startLabel: officeTimeLabel(b.start_at, timeZone),
      endLabel: officeTimeLabel(b.end_at, timeZone),
    });
  }
  segments.sort((a, b) => a.startMin - b.startMin);
  return segments;
}

/**
 * Client-side conflict pre-check: does the proposed office-local slot
 * [startMin, endMin) overlap any ACTIVE booking? Half-open, so back-to-back
 * (endA === startB) does NOT conflict. The server exclusion constraint remains
 * the source of truth; this only disables Book early with a reason.
 */
export function slotConflicts(
  bookings: RoomBooking[],
  timeZone: string,
  startMin: number,
  endMin: number
): boolean {
  return bookings.some((b) => {
    if (!isActive(b)) return false;
    const s = officeMinutesOfInstant(b.start_at, timeZone);
    const e = officeMinutesOfInstant(b.end_at, timeZone);
    return startMin < e && endMin > s;
  });
}

// ─── Slot picker option helpers ──────────────────────────────────────────────

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function minutesToTimeLabel(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

export function timeLabelToMinutes(label: string): number {
  const [h, m] = label.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Start-time options within the window, leaving room for at least one min-duration slot. */
export function startTimeOptions(
  window: TimelineWindow = DEFAULT_WINDOW,
  step = SLOT_STEP_MIN,
  minDuration = MIN_DURATION_MIN
): string[] {
  const out: string[] = [];
  for (let m = window.dayStartMin; m <= window.dayEndMin - minDuration; m += step) {
    out.push(minutesToTimeLabel(m));
  }
  return out;
}

/** Duration options (minutes) valid for a start time: min..min(max, window end - start). */
export function durationOptionsFor(
  startMin: number,
  window: TimelineWindow = DEFAULT_WINDOW,
  minDuration = MIN_DURATION_MIN,
  maxDuration = MAX_DURATION_MIN,
  step = SLOT_STEP_MIN
): number[] {
  const cap = Math.min(maxDuration, window.dayEndMin - startMin);
  const out: number[] = [];
  for (let d = minDuration; d <= cap; d += step) out.push(d);
  return out;
}

/** Format a duration in minutes with injected unit labels (i18n from the caller). */
export function formatDuration(min: number, units: { hour: string; minute: string }): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} ${units.minute}`;
  if (m === 0) return `${h} ${units.hour}`;
  return `${h} ${units.hour} ${m} ${units.minute}`;
}

/** The end time "HH:MM" for a start label + duration (for the create payload). */
export function endTimeLabel(startLabel: string, durationMin: number): string {
  return minutesToTimeLabel(timeLabelToMinutes(startLabel) + durationMin);
}

/** Hour tick labels across the window, e.g. ["06:00","07:00",...,"22:00"]. */
export function hourTicks(window: TimelineWindow = DEFAULT_WINDOW): string[] {
  const out: string[] = [];
  const firstHour = Math.ceil(window.dayStartMin / 60);
  const lastHour = Math.floor(window.dayEndMin / 60);
  for (let h = firstHour; h <= lastHour; h++) out.push(minutesToTimeLabel(h * 60));
  return out;
}
