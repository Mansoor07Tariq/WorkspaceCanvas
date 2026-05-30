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
  events: "/app/events",
  people: "/app/people",
} as const;

export function officeDetailPath(officeId: number): string {
  return `/app/offices/${officeId}`;
}

export function floorLayoutPath(officeId: number, floorId: number): string {
  return `/app/offices/${officeId}/floors/${floorId}/layout`;
}
