export const ROUTES = {
  signup: "/signup",
  login: "/login",
  verifyEmail: "/verify-email",
  mfaChallenge: "/mfa-challenge",
  app: "/app",
  mfaSetup: "/app/mfa/setup",
  offices: "/app/offices",
  officeDetail: "/app/offices/:officeId",
  bookings: "/app/bookings",
  events: "/app/events",
  people: "/app/people",
} as const;

export function officeDetailPath(officeId: number): string {
  return `/app/offices/${officeId}`;
}
