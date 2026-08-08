export function isValidBookingDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const mm = month < 10 ? `0${month}` : `${month}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${mm}-${dd}`;
}

export function isPastBookingDate(dateStr: string): boolean {
  return dateStr < todayLocalDate();
}

/** Local calendar date shifted by `days` (can be negative), as YYYY-MM-DD. */
export function shiftLocalDate(days: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Tomorrow (local), YYYY-MM-DD. */
export function tomorrowLocalDate(): string {
  return shiftLocalDate(1);
}

/**
 * Furthest bookable date — mirrors the backend cap of today + 365 days
 * (`serializers.CreateDeskBookingSerializer.validate_booking_date`). The backend
 * stays the source of truth; this FE mirror just prevents pointless requests.
 */
export const MAX_BOOKING_HORIZON_DAYS = 365;
export function maxBookingDate(): string {
  return shiftLocalDate(MAX_BOOKING_HORIZON_DAYS);
}

/** Why a date is unbookable, or null when it's fine. Copy lives in i18n. */
export type BookingDateError = "invalid" | "past" | "tooFar";

/**
 * Validate a booking date against the same rules the backend enforces: valid
 * calendar date, not in the past, not beyond the 365-day horizon. Pure.
 */
export function validateBookingDate(dateStr: string): BookingDateError | null {
  if (!isValidBookingDate(dateStr)) return "invalid";
  if (isPastBookingDate(dateStr)) return "past";
  if (dateStr > maxBookingDate()) return "tooFar";
  return null;
}

export function formatBookingDate(dateStr: string): string {
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
