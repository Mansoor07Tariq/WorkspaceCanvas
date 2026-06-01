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

export function inviteAcceptPath(token: string): string {
  return `/invite/${token}`;
}
