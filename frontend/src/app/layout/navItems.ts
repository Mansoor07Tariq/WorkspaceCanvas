import {
  AutoAwesomeOutlined,
  CalendarMonthOutlined,
  MeetingRoomOutlined,
  PeopleOutlined,
  WeekendOutlined,
} from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";

import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

export interface NavItem {
  id: string;
  label: string;
  Icon: SvgIconComponent;
  path: string;
  /** always reachable, even before the profile is complete */
  alwaysEnabled?: boolean;
  /** shown in the phone bottom tab bar (max 4; People lives elsewhere on phone) */
  bottomBar?: boolean;
}

/**
 * The single nav definition (PR 079), shared by the desktop sidebar, the tablet icon
 * rail, and the phone bottom tab bar. Order + labels come straight from the approved
 * prototype: Today · Book a desk · Book a room · My bookings · People.
 *
 * Phone decision (recorded in review/31): the bottom bar carries the 4 primary
 * destinations; **People** is reachable on phone from the Today screen's "+N more in the
 * office" / near-you links and the top-bar People action — it is not a bottom tab, so
 * every tab keeps a ≥44px target at 375px.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "today",
    label: en.app.sidebar.today,
    Icon: AutoAwesomeOutlined,
    path: ROUTES.app,
    alwaysEnabled: true,
    bottomBar: true,
  },
  {
    id: "book-desk",
    label: en.app.sidebar.bookDesk,
    Icon: WeekendOutlined,
    path: ROUTES.bookings,
    bottomBar: true,
  },
  {
    id: "book-room",
    label: en.app.sidebar.bookRoom,
    Icon: MeetingRoomOutlined,
    path: ROUTES.rooms,
    bottomBar: true,
  },
  {
    id: "my-bookings",
    label: en.app.sidebar.myBookingsNav,
    Icon: CalendarMonthOutlined,
    path: ROUTES.myBookings,
    bottomBar: true,
  },
  {
    id: "people",
    label: en.app.sidebar.people,
    Icon: PeopleOutlined,
    path: ROUTES.people,
  },
];

/**
 * Whether a nav item is the active one for the current path. Exact match for Today
 * (`/app`) so it doesn't light up on every `/app/*` sub-route; the booking routes are
 * distinct full paths (`/app/bookings`, `/app/bookings/rooms`, `/app/bookings/my`) so
 * exact match distinguishes them; other items match their path as a prefix segment.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.path === ROUTES.app) return pathname === ROUTES.app;
  if (
    item.path === ROUTES.bookings ||
    item.path === ROUTES.rooms ||
    item.path === ROUTES.myBookings
  ) {
    return pathname === item.path;
  }
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
