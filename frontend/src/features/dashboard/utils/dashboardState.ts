import type { DeskBooking } from "@/features/bookings/types/booking.types";
import type { CurrentUser } from "@/features/auth/types/auth.types";
import { ROUTES, officeDetailPath, floorLayoutPath } from "@/routes/paths";

export type ChecklistItemId = "profile" | "org" | "office" | "floor" | "desks" | "invite";

export interface SetupChecklistItem {
  id: ChecklistItemId;
  completed: boolean;
  to?: string;
  deferred?: boolean;
}

/**
 * Coarse workspace readiness state, used by member dashboard and booking page
 * to decide what to show when prerequisites are missing.
 *
 * Completion is org-wide (TD-035): readiness reflects any office/floor/desk in
 * the organization, not just the first office's first floor.
 */
export type WorkspaceSetupState = "noOrg" | "noOffice" | "noFloor" | "noBookableDesks" | "ready";

interface GetWorkspaceSetupStateInput {
  hasOrg: boolean;
  hasOffices: boolean;
  hasFloors: boolean;
  hasBookableDesks: boolean;
}

export function getWorkspaceSetupState({
  hasOrg,
  hasOffices,
  hasFloors,
  hasBookableDesks,
}: GetWorkspaceSetupStateInput): WorkspaceSetupState {
  if (!hasOrg) return "noOrg";
  if (!hasOffices) return "noOffice";
  if (!hasFloors) return "noFloor";
  if (!hasBookableDesks) return "noBookableDesks";
  return "ready";
}

interface GetChecklistInput {
  user: CurrentUser | null;
  hasOrg: boolean;
  hasOffices: boolean;
  hasFloors: boolean;
  hasBookableDesks: boolean;
  /** First office/floor ids — used only for convenience deep-links, not completion. */
  firstOfficeId?: number | null;
  firstFloorId?: number | null;
  memberCount?: number;
}

export function getSetupChecklist({
  user,
  hasOrg,
  hasOffices,
  hasFloors,
  hasBookableDesks,
  firstOfficeId,
  firstFloorId,
  memberCount,
}: GetChecklistInput): SetupChecklistItem[] {
  // invite is complete when there is at least one other active member (count > 1)
  const hasInvitedMember = memberCount != null ? memberCount > 1 : false;

  return [
    {
      id: "profile",
      completed: user?.is_profile_completed ?? false,
    },
    {
      id: "org",
      completed: hasOrg,
    },
    {
      id: "office",
      completed: hasOffices,
      to: ROUTES.offices,
    },
    {
      id: "floor",
      completed: hasFloors,
      to: firstOfficeId != null ? officeDetailPath(firstOfficeId) : undefined,
    },
    {
      id: "desks",
      completed: hasBookableDesks,
      // Go directly to floor layout if a floor exists; otherwise land on office detail
      to:
        firstOfficeId != null
          ? firstFloorId != null
            ? floorLayoutPath(firstOfficeId, firstFloorId)
            : officeDetailPath(firstOfficeId)
          : undefined,
    },
    {
      id: "invite",
      completed: hasInvitedMember,
      to: ROUTES.people,
    },
  ];
}

export function getTodayBooking(bookings: DeskBooking[], today: string): DeskBooking | null {
  return bookings.find((b) => b.booking_date === today && b.status === "active") ?? null;
}

export function getNextBooking(bookings: DeskBooking[], today: string): DeskBooking | null {
  const future = bookings
    .filter((b) => b.booking_date > today && b.status === "active")
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
  return future[0] ?? null;
}

export function getSetupProgress(checklist: SetupChecklistItem[]): number {
  const countable = checklist.filter((item) => !item.deferred);
  if (countable.length === 0) return 0;
  const completed = countable.filter((item) => item.completed).length;
  return Math.round((completed / countable.length) * 100);
}
