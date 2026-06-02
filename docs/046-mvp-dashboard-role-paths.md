# PR 046 — MVP Dashboard, Role Paths, and Product Flow Polish

## Purpose

Replace the `AppPlaceholderPage` stub at `/app` with a real, role-aware dashboard that connects the full WorkspaceCanvas product flow. The dashboard answers "what should I do next?" for every user type.

## Why This PR Exists

After PR 045, every major feature (booking, my bookings, office/floor/desk management, floor map canvas) existed but users landed on a placeholder that said "Your workspace dashboard will appear here." This PR wires those features into a coherent first-party experience.

---

## Current Product Paths

### Path A — New admin / owner (no offices yet)

1. User signs up → completes profile onboarding carousel (existing behavior)
2. Dashboard shows setup checklist with progress bar
3. Checklist items link to the relevant management page
4. Quick actions include Manage Offices, Book a Desk, My Bookings
5. Workspace health cards show 0/0/0 counts with skeleton loading

### Path B — Existing admin / owner (setup complete)

1. Dashboard shows greeting with "Your workspace is ready" headline
2. Today booking card (or no-booking CTA)
3. Upcoming next booking card (if one exists)
4. Quick actions: Book a Desk, My Bookings, Manage Offices, Build Floor Map
5. Setup checklist shows all items complete (100%)
6. Workspace health cards show real office/floor/desk counts

### Path C — Invited / normal member

1. Dashboard shows greeting with "Book your next office day" headline
2. Today booking card (or no-booking CTA)
3. Upcoming booking card (if exists)
4. Quick actions: Book a Desk, My Bookings
5. No setup checklist — admin-only section not rendered
6. No workspace health cards

### Path D — User with no active organization

1. Dashboard shows "No workspace yet" heading
2. Short message explaining they can create or be invited
3. Single CTA: Create workspace → links to `/app/offices` (which handles org setup flow)
4. No checklist, no health cards, no booking cards

---

## What the Dashboard Shows Per Role

| Section | Owner/Admin | Member | No Org |
|---|---|---|---|
| Greeting h1 | ✓ | ✓ | ✓ |
| Setup progress bar | ✓ (if < 100%) | — | — |
| Today booking card | ✓ | ✓ | — |
| Upcoming booking card | ✓ | ✓ | — |
| Quick actions | Book desk, My bookings, Manage offices, Build floor map | Book desk, My bookings | Create workspace |
| Admin setup checklist | ✓ | — | — |
| Workspace health cards | ✓ | — | — |
| Create workspace CTA | — | — | ✓ |

---

## Data Sources

| Data | Source | Notes |
|---|---|---|
| User / role | `useAuth()` → `user.memberships[0].role` | Always available post-login |
| Offices | `useOffices()` | Always fetched once org exists |
| Workspace counts & readiness | `useWorkspaceSummary()` → `GET /api/offices/summary/` | **Org-wide** aggregate counts and `has_*`/`setup_complete` booleans (PR 054) |
| First office / first floor | `useDashboardData()` | Resolved only for convenience deep-links (checklist actions / quick actions) |
| Today & upcoming bookings | `useMyBookings({ from: today, status: "active" })` | Filtered to active bookings from today onward |

**Update (PR 054, TD-035)**: Health-card counts and setup-completion are now
org-wide via the `GET /api/offices/summary/` endpoint, not first-office-only.
A multi-office admin sees totals across **all** offices, and member readiness
reflects any bookable desk anywhere in the org. `useDashboardData` no longer
fetches desks; it resolves the first office/floor only for navigation links.

---

## Setup Checklist Logic

The `getSetupChecklist()` pure function in `src/features/dashboard/utils/dashboardState.ts` returns six items:

| Item ID | Completed when | Link target |
|---|---|---|
| `profile` | `user.is_profile_completed === true` | — |
| `org` | `hasOrg === true` | — |
| `office` | `offices.length > 0` | `/app/offices` |
| `floor` | `floors.length > 0` | `/app/offices/:firstOfficeId` |
| `desks` | `desks.length > 0` | `/app/offices/:firstOfficeId` |
| `invite` | Always `false` | — (deferred, marked "Coming soon") |

Progress is computed by `getSetupProgress()`, which excludes the `invite` (deferred) item from the denominator. A fully set-up workspace (profile + org + office + floor + desks) shows 100%.

---

## Booking Summary Logic

`getTodayBooking(bookings, today)` — returns the first active booking whose `booking_date === today`.

`getNextBooking(bookings, today)` — returns the earliest active booking strictly after today, sorted ascending by date.

Both are pure functions in `dashboardState.ts` operating on the already-fetched `useMyBookings` result. The dashboard does not cancel bookings inline — it links to My Bookings for management.

---

## Role-Based Quick Actions

Admin/Owner:
- Book a desk → `/app/bookings`
- My bookings → `/app/bookings/my`
- Manage offices → `/app/offices`
- Build floor map → `/app/offices/:id/floors/:id/layout` if first floor exists, else `/app/offices`

Member:
- Book a desk → `/app/bookings`
- My bookings → `/app/bookings/my`

No org:
- Create workspace → `/app/offices` (triggers org setup flow)

---

## Error / Loading / Empty States

| Scenario | Behavior |
|---|---|
| Bookings loading | CircularProgress in TodayBookingCard |
| Bookings error | `role="alert"` Alert in TodayBookingCard |
| No booking today | EmptyState with Book a desk CTA |
| No upcoming booking | UpcomingBookingCard not rendered |
| Offices/floors error | Warning Alert (non-fatal, partial render continues) |
| Offices/floors loading | AdminSetupChecklist shows loading spinner; HealthCards show Skeleton |
| No org | Full-page no-org state with create CTA |
| Profile incomplete | ProfileOnboardingCarousel (existing behavior preserved) |

---

## Accessibility

- `AppShell` provides the single `<main>` landmark via `<Box component="main">`
- Dashboard has a visible `h1` (greeting) in all authenticated states
- Setup checklist uses `CheckCircleOutlined` / `RadioButtonUncheckedOutlined` icons with `aria-hidden` — completion is also indicated by text ("✓ Done")
- Progress bar has `aria-label`
- All quick action buttons are `<Link>` elements with accessible text labels
- Loading spinner has `aria-label`
- Error alerts use `role="alert"`

---

## Tests

### `dashboardState.test.ts` (29 tests)
- `getSetupChecklist`: all 6 items, profile/org/office/floor/desks/invite states, null user safety
- `getTodayBooking`: matching date, wrong date, cancelled booking, empty array, multiple bookings
- `getNextBooking`: earliest future booking, no future bookings, today excluded, cancelled excluded
- `getSetupProgress`: 0%, 100%, deferred items excluded from denominator

### `DashboardPage.test.tsx` (28 tests)
- Shell: brand, logout button, logout navigation
- Profile onboarding: carousel shown when incomplete, h1 absent
- No org: h1 title, create CTA, correct link, no checklist
- Admin role: h1 present, checklist visible, manage-offices/build-map/book-desk/my-bookings links
- Member role: no checklist, no manage-offices/build-map, booking actions present
- Booking cards: today card shown, no-booking CTA, next booking card, booking error alert
- Loading: spinner while bookings loading
- Checklist items: office item with action link
- Accessibility: single main landmark, h1 for all states, named links

### Regression (all pre-existing tests pass)
- `AppPlaceholderPage.test.tsx`: 26 tests — component still exists, tests unchanged
- `DeskBookingPage.test.tsx`, `MyBookingsPage.test.tsx`: unchanged, all pass
- Total: **956 tests, 68 test files, 0 failures**

---

## Manual Test Checklist

1. New admin with no office → Dashboard shows setup checklist with "Add office" action linking to `/app/offices`
2. Admin with office but no floor → Checklist shows floor incomplete with link to office detail
3. Admin with floor but no desks → Checklist shows desks incomplete
4. Admin with all setup complete → Progress bar at 100%, checklist all green
5. Member with active org → No checklist, only booking quick actions
6. Member with booking today → Today card shows desk name and floor
7. Member with upcoming booking → Upcoming card renders after today's card
8. User with no organization → No-org heading, create workspace link to `/app/offices`
9. User with profile not complete → Profile onboarding carousel shown (unchanged)
10. API failure for bookings → Alert shown in today booking card without crashing page

---

## What This PR Does Not Include

- Invitation / People flow (deferred — see TECHNICAL_DEBT.md)
- Multi-office dashboard aggregation (MVP shows first office data only)
- Active bookings count in health cards (would require a separate aggregate endpoint)
- Events feature (still ComingSoon)
- Real-time / auto-refresh
- Mobile-specific redesign
- Analytics or admin usage metrics

---

## Deferred Items (TECHNICAL_DEBT.md)

See TECHNICAL_DEBT.md for:
- `DASH-001`: Dashboard health cards show first-office/first-floor data only
- `DASH-002`: Invitation flow and "Invite team" checklist item not implemented
- `DASH-003`: No multi-office aggregate counts without backend endpoint
