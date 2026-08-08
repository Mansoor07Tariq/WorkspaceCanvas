export const ROUTES = {
  signup: "/signup",
  login: "/login",
  verifyEmail: "/verify-email",
  mfaChallenge: "/mfa-challenge",
  app: "/app",
  mfaSetup: "/app/mfa/setup",
  offices: "/app/offices",
  officeDetail: "/app/offices/:officeId",
  floorLayout: "/app/offices/:officeId/floors/:floorId/layout",
  bookings: "/app/bookings",
  myBookings: "/app/bookings/my",
  people: "/app/people",
  inviteAccept: "/invite/:token",
} as const;

export function officeDetailPath(officeId: number): string {
  return `/app/offices/${officeId}`;
}

export function floorLayoutPath(officeId: number, floorId: number): string {
  return `/app/offices/${officeId}/floors/${floorId}/layout`;
}

export function myBookingsPath(): string {
  return "/app/bookings/my";
}

/**
 * Desk-booking page, optionally deep-linked with office/floor/desk/date so the
 * picker auto-selects them (PR 070 "book again"; PR 071 adds date + full
 * deep-linking). Omitted parts are simply not added.
 */
export function deskBookingPath(prefill?: {
  office?: number;
  floor?: number;
  desk?: number;
  date?: string;
}): string {
  if (!prefill) return ROUTES.bookings;
  const params = new URLSearchParams();
  if (prefill.office != null) params.set("office", String(prefill.office));
  if (prefill.floor != null) params.set("floor", String(prefill.floor));
  if (prefill.desk != null) params.set("desk", String(prefill.desk));
  if (prefill.date != null && prefill.date !== "") params.set("date", prefill.date);
  const qs = params.toString();
  return qs ? `${ROUTES.bookings}?${qs}` : ROUTES.bookings;
}

export function inviteAcceptPath(token: string): string {
  return `/invite/${token}`;
}
