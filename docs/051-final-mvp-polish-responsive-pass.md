# PR 051 — Final MVP Polish and Responsive Pass

## Purpose

Perform the final MVP UI/UX polish pass before considering WorkspaceCanvas demo-ready. This PR addresses structural inconsistencies discovered during the MVP QA walkthrough from PR 050, plus copy polish and minor UX improvements.

---

## Why This PR Exists

During the PR 050 QA walkthrough using the seed data and the `docs/050-demo-data-and-mvp-qa-checklist.md` checklist, one critical structural issue was found:

**Pages without AppShell**: Only `DashboardPage` and `PeoplePage` wrapped themselves in `AppShell`. All other protected app pages (`DeskBookingPage`, `MyBookingsPage`, `AppOfficesPage`, `OfficeDetailPage`, `FloorLayoutPage`) rendered without the top navigation bar or sidebar when navigated to directly. This caused a broken layout on every page reachable from the sidebar except Dashboard and People.

Additional issues:
- `PeoplePage` used `variant="h5"` for its page heading while all other pages used `variant="h4"`.
- `MyBookingsPage` had all user-visible strings hardcoded rather than using the i18n system.
- The Events route (`/app/events`) still existed in the router and `ROUTES` constants, pointing to a `ComingSoonPage` that was unreachable from the nav. This was TD-042.

---

## Changes

### Critical fix: AppLayout layout route

Added `AppLayout` — a React Router v6 layout route component — to `AppRouter.tsx`. It renders `AppShell` around all protected app pages via `<Outlet>`:

```
<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
  /app              → DashboardPage
  /app/mfa/setup    → MfaSetupPage
  /app/offices      → AppOfficesPage
  /app/offices/:id  → OfficeDetailPage
  /app/.../layout   → FloorLayoutPage
  /app/bookings     → DeskBookingPage
  /app/bookings/my  → MyBookingsPage
  /app/people       → PeoplePage
</Route>
```

`AppLayout` owns the logout handler (`logoutUser` + `navigate(ROUTES.login)`). Individual pages no longer need to manage logout.

### DashboardPage

- Removed `AppShell` wrapper, `logoutUser`, and `handleLogout`.
- Now returns content directly; AppShell is provided by the layout route.

### PeoplePage

- Removed `AppShell` wrapper, `logoutUser`, `handleLogout`, and `useNavigate` at the top-level component.
- Upgraded page heading from `variant="h5"` to `variant="h4"` for visual consistency with all other pages.
- Replaced hardcoded `"No workspace yet"` / `"People"` / `"Pending invitations"` / `"Team members"` strings with i18n references from `en.app.people`.

### Events route removal (resolves TD-042)

- Removed `events: "/app/events"` from `ROUTES` in `routes/paths.ts`.
- Removed the Events route from `AppRouter.tsx`.
- Deleted `ComingSoonPage.tsx` (now dead code; was only used for the Events route).

### MyBookingsPage i18n

Added `myBookings` key to `en.ts`:
```
myBookings.pageTitle      = "My Bookings"
myBookings.bookDeskAction = "Book a desk"
myBookings.emptyTitle     = "No upcoming bookings"
myBookings.emptyDesc      = "You don't have any active desk bookings."
```

`MyBookingsPage` now uses these keys instead of hardcoded strings. The displayed text is identical; the change enables future i18n and makes tests use the i18n string as the source of truth.

Also removed the now-redundant `role="main"` from the inner `Box` (AppShell already provides the `main` landmark).

---

## Pages Reviewed (via QA checklist)

| Page | Status |
|------|--------|
| Dashboard (admin) | Sidebar and topbar now present |
| Dashboard (member) | Sidebar and topbar now present |
| Offices | Sidebar and topbar now present |
| Office detail / floors | Sidebar and topbar now present |
| Floor layout builder | Sidebar and topbar now present |
| Desk Booking | Sidebar and topbar now present |
| My Bookings | Sidebar and topbar now present; i18n wired |
| People | Sidebar and topbar now present; h1 consistent |
| Invite acceptance | Unchanged — public page, no AppShell needed |
| Not Found | Unchanged — handled by catch-all |

---

## Navigation Cleanup

| Item | Resolution |
|------|-----------|
| Events route removed | `ROUTES.events` deleted from `paths.ts` |
| ComingSoonPage deleted | Was only used by the Events route |
| `en.app.sidebar.events` kept | Still used in AppSidebar test to assert Events is absent |
| `AppLayout` added to AppRouter | All protected app pages now share a single AppShell instance |

---

## Accessibility

- `PeoplePage` heading upgraded to `h4` level (matching Dashboard, Bookings, My Bookings).
- `MyBookingsPage` removed redundant `role="main"` inner wrapper (AppShell's `<Box component="main">` already provides the landmark at the layout level).
- All page h1s: Dashboard ✓, Offices ✓, Floor Layout ✓, Desk Booking ✓, My Bookings ✓, People ✓.

---

## Tests

### Modified

- `DashboardPage.test.tsx`: Removed 4 tests that checked for AppShell-specific rendering (logout button, logout click, brand text, `main` landmark). These are now layout-route concerns tested at the AppShell level. All remaining dashboard content tests pass unchanged.

### Test counts

| Metric | Before | After |
|--------|--------|-------|
| Test files | 72 | 72 |
| Tests | 1049 | 1045 |
| Net change | — | −4 (AppShell shell tests moved to router level) |

All 1045 tests pass.

---

## Checks

| Check | Result |
|-------|--------|
| `npm run test -- --run` | ✅ 1045/1045 passed |
| `npx tsc --noEmit` | ✅ Clean |
| `npm run lint` | ✅ Clean |
| `npm run format:check` | ✅ Clean |
| `npm run build` | ✅ Built in 798ms, no chunk warnings |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilities |

---

## What Is Not Included

- Playwright/Cypress end-to-end tests.
- Major canvas refactor (TD-019).
- Hook caching (TD-021).
- First-office-only dashboard data (TD-035).
- Invitation expiry UI (TD-038).
- Email delivery for invitations (TD-039).
- Multi-org switcher (TD-037).
- New booking rules or features.

---

## Deferred Items

| Item | Notes |
|------|-------|
| TD-019 | FloorLayoutPage large-file refactor |
| TD-021 | No TTL caching in feature hooks |
| TD-033 | No floor-selection integration test in DeskBookingPage |
| TD-034 | AvailabilityMapLegend scroll detachment on narrow screens |
| TD-035 | Dashboard fetches first-office only |
| TD-037 | No multi-org switcher |
| TD-038 | Invitation expiry not surfaced in UI |
| TD-039 | No email delivery for invitations |
| TD-040 | No resend invitation button |
