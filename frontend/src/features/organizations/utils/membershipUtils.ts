import type { CurrentUser } from "@/features/auth/types/auth.types";

export function hasActiveMembership(user: CurrentUser | null): boolean {
  if (!user) return false;
  return user.memberships.some((m) => m.has_active_access);
}

export function getFirstActiveMembership(user: CurrentUser | null) {
  if (!user) return null;
  return user.memberships.find((m) => m.has_active_access) ?? null;
}
