import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";
import { ApiError } from "@/lib/api/apiError";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { invalidateCache } from "@/lib/api/requestCache";

/**
 * Org-scoped GET caches that must be dropped after joining a new org so the
 * invited organization's dashboard loads fresh (and no previously-selected
 * org's data bleeds through). See requestCache key shapes in each api module.
 */
export const ORG_SCOPED_CACHE_NAMESPACES = [
  "offices:",
  "summary:",
  "floors:",
  "desks:",
  "deskBookings:",
  "myBookings:",
] as const;

export function invalidateOrgScopedCaches(): void {
  ORG_SCOPED_CACHE_NAMESPACES.forEach((ns) => invalidateCache(ns));
}

/**
 * The backend rejects an accept whose authenticated email differs from the
 * invited email with a 403. We never expose the invited email to the holder of
 * the link, so we surface a clear, actionable message only after the attempt.
 */
export const EMAIL_MISMATCH_MESSAGE =
  "This invitation was sent to another email address. Please sign out and sign in with the invited email.";

export function getAcceptErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return EMAIL_MISMATCH_MESSAGE;
  if (err instanceof ApiError) return getApiErrorMessage(err);
  if (err instanceof Error) return err.message;
  return "Could not accept invitation. Please try again.";
}

/**
 * Find the freshly-joined membership by organization slug. The accept response
 * carries no organization id, so callers match against the slug from the invite
 * (public detail or pending list) once the refreshed user is available.
 */
export function findActiveMembershipBySlug(
  user: CurrentUser | null,
  slug: string | null
): MembershipInline | null {
  if (!user || !slug) return null;
  return user.memberships.find((m) => m.organization_slug === slug && m.has_active_access) ?? null;
}
