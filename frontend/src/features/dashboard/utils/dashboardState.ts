import type { DeskBooking } from "@/features/bookings/types/booking.types";
import type { Desk } from "@/features/desks/types/desk.types";
import type { Floor } from "@/features/floors/types/floor.types";
import type { Office } from "@/features/offices/types/office.types";
import type { CurrentUser } from "@/features/auth/types/auth.types";
import { ROUTES, officeDetailPath } from "@/routes/paths";

export type ChecklistItemId = "profile" | "org" | "office" | "floor" | "desks" | "invite";

export interface SetupChecklistItem {
  id: ChecklistItemId;
  completed: boolean;
  to?: string;
  deferred?: boolean;
}

interface GetChecklistInput {
  user: CurrentUser | null;
  hasOrg: boolean;
  offices: Office[];
  floors: Floor[];
  desks: Desk[];
  memberCount?: number;
}

export function getSetupChecklist({
  user,
  hasOrg,
  offices,
  floors,
  desks,
  memberCount,
}: GetChecklistInput): SetupChecklistItem[] {
  const firstOfficeId = offices[0]?.id;
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
      completed: offices.length > 0,
      to: ROUTES.offices,
    },
    {
      id: "floor",
      completed: floors.length > 0,
      to: firstOfficeId != null ? officeDetailPath(firstOfficeId) : undefined,
    },
    {
      id: "desks",
      completed: desks.length > 0,
      to: firstOfficeId != null ? officeDetailPath(firstOfficeId) : undefined,
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
