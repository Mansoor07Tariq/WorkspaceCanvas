import type { CurrentUser, MembershipInline } from "@/features/auth/types/auth.types";

export function hasActiveMembership(user: CurrentUser | null): boolean {
  if (!user) return false;
  return user.memberships.some((m) => m.has_active_access);
}

export function getFirstActiveMembership(user: CurrentUser | null) {
  if (!user) return null;
  return user.memberships.find((m) => m.has_active_access) ?? null;
}

/** Returns true if the given role can create, edit, and delete workspace content. */
export function canManageWorkspaceContent(role?: string): boolean {
  return role === "owner" || role === "admin";
}

/** Returns true if the given role can manage office and floor setup (create/edit offices and floors). */
export function canManageOfficeSetup(role?: string): boolean {
  return canManageWorkspaceContent(role);
}

/** Returns true if the given role can build and edit floor layouts (create/move/delete layout objects). */
export function canManageFloorLayout(role?: string): boolean {
  return canManageWorkspaceContent(role);
}

/** Returns true if the given role can invite members and cancel pending invitations. */
export function canInviteMembers(role?: string): boolean {
  return canManageWorkspaceContent(role);
}

/** Returns true if the membership grants active access to book desks. */
export function canBookDesk(membership: MembershipInline | null | undefined): boolean {
  return membership?.has_active_access === true;
}

/** Returns true if the membership is currently active (has_active_access). */
export function isActiveMembership(membership: MembershipInline | null | undefined): boolean {
  return membership?.has_active_access === true;
}
