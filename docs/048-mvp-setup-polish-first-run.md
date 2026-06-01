# PR 048 — MVP Setup Polish and First-Run Guidance

## Purpose

Polish the first-run setup journey so a new admin can move smoothly from "empty account" to "bookable office", and a member joining an unfinished workspace sees helpful guidance instead of dead ends.

## Why This PR Exists

After PR 047, all major product features existed but the first-run experience had gaps:

- `AppPlaceholderPage` was orphaned (not routed anywhere) and had a 25-test file still active.
- The dashboard `desks` checklist item always linked to the office-detail page even when a floor already existed — forcing an extra navigation step.
- Members with an org but no bookable desks saw the booking hero unchanged ("Book your next office day"), with no explanation that setup was incomplete.
- The Desk Booking page had no role-aware empty states — when no offices existed the selectors just appeared empty and broken.
- The floor map canvas said "Add objects from the library" to read-only members who cannot add anything.
- The admin dashboard quick actions had no "Invite people" button, even though the People page and invite flow were live since PR 047.

---

## Changes

### Removed: AppPlaceholderPage

`AppPlaceholderPage` had no route registered in `AppRouter.tsx`. It was a legacy stub replaced by `DashboardPage` in PR 046. Both the page file and its 25-test file are removed.

- `frontend/src/app/pages/AppPlaceholderPage.tsx` — **deleted**
- `frontend/src/app/__tests__/AppPlaceholderPage.test.tsx` — **deleted**

### Admin Checklist — Smarter Desks Routing

`getSetupChecklist` previously linked the "Add bookable desks" item to `officeDetailPath(firstOfficeId)` in all cases. It now links directly to `floorLayoutPath(firstOfficeId, firstFloorId)` when a floor exists, putting admins one click away from the floor builder.

```
No office      → no link
Office, no floor → /app/offices/:officeId   (create a floor first)
Office + floor   → /app/offices/:officeId/floors/:floorId/layout  ← NEW
```

### New: `getWorkspaceSetupState` Helper

`dashboardState.ts` now exports `getWorkspaceSetupState` which returns one of:

| State | Meaning |
|---|---|
| `noOrg` | User has no active membership |
| `noOffice` | Org exists but no offices |
| `noFloor` | Offices exist but no floors (first-office only, documented as TD-035) |
| `noBookableDesks` | Floors exist but no desk resources |
| `ready` | Offices + floors + desks all present |

This state drives both the member dashboard message and the booking page empty states.

### Member Dashboard — Workspace Not Ready State

When a member user's workspace setup state is not `ready`:

- `DashboardHero` now shows "Your workspace is being set up" instead of "Book your next office day".
- A new `MemberWorkspaceStatus` info-alert renders below the hero explaining that desks will be available once the admin completes setup.
- Admin users are never affected — the status alert only renders for `!isOwnerOrAdmin && !isWorkspaceReady`.

### Admin Dashboard — Invite People Quick Action

`DashboardQuickActions` now includes an **Invite people** button for owner/admin users that links to `/app/people`. Previously there was no quick-action path to the People page from the dashboard.

### Desk Booking Page — Role-Aware Empty States

`DeskBookingPage` was role-agnostic. It now calls `useAuth` and checks `canManageWorkspaceContent` to render:

| Condition | Admin sees | Member sees |
|---|---|---|
| No offices | "No offices yet" + Manage offices button | "No offices available" (read-only) |
| Office selected, no floors | "No floors yet" + Manage floors button | "No floors available" (read-only) |
| Floor selected, no desks | "No bookable desks" + Build floor map button | "No desks are available" (read-only) |

The selectors remain rendered so users can change selection.
Booking summary cards, desk list, and floor map only render when desks exist (`items.length > 0`).

### Floor Map Canvas — Member vs Admin Empty State

`FloorMapCanvas` now branches the "nothing on this floor" overlay on `canManageLayout`:

- **Admin / owner** (`canManageLayout=true`): "Nothing on this floor yet — Add objects from the library to start building the layout." (unchanged)
- **Member** (`canManageLayout=false`): "Floor map not set up yet — This floor has no layout objects. Your admin hasn't built the map for this floor yet."

---

## Admin First-Run Path

1. Sign up → complete profile carousel
2. Dashboard shows setup checklist with progress bar
3. "Create workspace" → `/app/offices` → org setup flow
4. "Add office" checklist item → `/app/offices` → office creation flow
5. "Manage floors" checklist item → `/app/offices/:officeId` → floor creation
6. "Build floor map" checklist item → `/app/offices/:officeId/floors/:floorId/layout`
7. **"Add bookable desks" now links directly to floor layout** (not office detail) when floor exists
8. "Invite people" checklist item + quick action → `/app/people`

---

## Member First-Run Path

### Workspace ready (desks exist)
- Hero: "Book your next office day"
- Quick actions: Book a desk, My bookings
- Booking page: full desk selection UI

### Workspace not ready (no desks yet)
- Hero: "Your workspace is being set up"
- Info alert: "Your admin is still configuring the workspace..."
- Quick actions: Book a desk, My bookings (still navigable)
- Booking page shows role-aware empty state explaining no offices/desks available yet

---

## No-Org User Path

Unchanged from PR 046: dashboard shows "No workspace yet" heading with a "Create workspace" CTA linking to `/app/offices` where the org setup flow is embedded.

---

## Setup Checklist Behavior

| Step | Completed when | Action link |
|---|---|---|
| Profile | `is_profile_completed` | (no link — auto-checked) |
| Organization | has active membership | (no link — auto-checked) |
| First office | `offices.length > 0` | `/app/offices` |
| First floor | `floors.length > 0` | `/app/offices/:firstOfficeId` |
| Bookable desks | `desks.length > 0` | `/app/offices/:id/floors/:id/layout` if floor, else `/app/offices/:id` |
| Invite team | `memberCount > 1` | `/app/people` |

**Limitation (TD-035):** floors and desks are fetched for the first office/floor only. A multi-office workspace may show the checklist as incomplete even if another office is fully set up. Documented.

---

## Empty States Improved

| Page | State | Improvement |
|---|---|---|
| Dashboard | Member workspace not ready | New `MemberWorkspaceStatus` alert + hero subtitle |
| Dashboard | Admin quick actions | Added "Invite people" button |
| Desk Booking | No offices (admin) | EmptyState with "Manage offices" CTA |
| Desk Booking | No offices (member) | EmptyState read-only message |
| Desk Booking | No floors (admin) | EmptyState with "Manage floors" CTA |
| Desk Booking | No floors (member) | EmptyState read-only message |
| Desk Booking | No desks (admin) | EmptyState with "Build floor map" CTA |
| Desk Booking | No desks (member) | EmptyState read-only message |
| Floor map canvas | Empty canvas (member) | "Floor map not set up yet" instead of "Add objects from library" |

---

## Route and Action Consistency

All dashboard quick actions and checklist links verified:

- "Create workspace" → `/app/offices` ✓
- "Add office" → `/app/offices` ✓
- "Manage floors" → `/app/offices/:officeId` ✓
- "Build floor map" → `/app/offices/:officeId/floors/:floorId/layout` ✓
- "Add bookable desks" → floor layout if floor exists (NEW), else office detail ✓
- "Invite people" quick action → `/app/people` (NEW) ✓
- "Book a desk" → `/app/bookings` ✓
- "My bookings" → `/app/bookings/my` ✓
- No links point to orphaned pages ✓

---

## Tests

### New test suites

| File | New describes | New tests |
|---|---|---|
| `dashboardState.test.ts` | `getSetupChecklist — desks routing`, `getWorkspaceSetupState` | 8 |
| `DashboardPage.test.tsx` | `admin invite people action`, `member workspace not ready` | 6 |
| `DeskBookingPage.test.tsx` | `no offices (admin)`, `no offices (member)` | 5 |
| `FloorMapCanvas.test.tsx` | (existing suite updated) | +1 (member empty state) |

### Updated tests

- `FloorMapCanvas.test.tsx`: "shows empty state overlay" now passes `canManageLayout={true}` for admin path; new "shows member empty state" test added.
- `DeskBookingPage.test.tsx`: heading and select-prompt assertions updated to use `en.bookings.*` i18n keys; `useOffices` changed from static mock to `vi.fn()` to enable per-test override.

### Totals

- Before: 1001 tests, 69 files
- After: 1003 tests, 70 files (AppPlaceholderPage.test removed, new booking test describe added)

---

## Manual Verification Checklist

- [ ] New admin signs up → completes profile → dashboard shows setup checklist with 0% progress
- [ ] "Add office" checklist action takes admin to offices page showing org setup → office creation
- [ ] "Manage floors" action takes admin to office detail with Create Floor CTA
- [ ] "Add bookable desks" action takes admin to **floor layout** directly when a floor exists
- [ ] "Invite people" quick action button visible on admin dashboard → navigates to People page
- [ ] Member with no org sees "No workspace yet" heading
- [ ] Member with org but no desks sees "Your workspace is being set up" hero subtitle and info alert
- [ ] Member with desks sees "Book your next office day" and no setup alert
- [ ] Booking page with no offices shows admin "No offices yet" + Manage offices button
- [ ] Booking page with no offices shows member "No offices available" (no admin button)
- [ ] Booking page with floor selected but no desks shows admin "No bookable desks" + Build floor map button
- [ ] Floor map canvas with no objects shows "Floor map not set up yet" for members
- [ ] Floor map canvas with no objects shows "Nothing on this floor yet" for admin/owner

---

## What Is Not Included

- Email delivery for invitations (TD-039)
- Resend invitation button (TD-040)
- Invitation expiry display in People page (TD-038)
- Multi-office aggregation for checklist/health cards (TD-035 — documented limitation)
- Multi-org switcher (TD-037)
- Meeting room booking
- Recurring bookings
- Full mobile redesign
- Notification system
- FloorLayoutPage large-file refactor (TD-019)

---

## Deferred Items

See `TECHNICAL_DEBT.md` for TD-019, TD-021, TD-032, TD-033, TD-034, TD-035, TD-037, TD-038, TD-039, TD-040.
