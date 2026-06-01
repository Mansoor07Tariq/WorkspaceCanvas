# PR 049 — Role-Based UX and Permission Polish

## Purpose

This PR audits and polishes role-based UX across the WorkspaceCanvas frontend so that owners/admins and members always see the correct actions, navigation items, empty states, and read-only messages.

The backend already enforces permissions via Django REST Framework permission classes. This PR makes the frontend UX align with those permissions so users do not see confusing admin-only actions they cannot complete.

---

## Why This PR Exists

Previous PRs focused on feature delivery — each feature was gated individually with raw role checks scattered across components. PR 049 is a consolidation and polish pass: centralising permission helpers, filling UX gaps (missing My Bookings nav item, missing role-aware offices/floors empty states), hiding the never-implemented Events nav item, and removing dead code.

---

## Role Model

| Role | Description |
|------|-------------|
| **owner** | Created the organization. Full administrative control. |
| **admin** | Delegated admin; same functional permissions as owner. |
| **member** | Standard workspace member. Can view, book desks, manage own bookings. |
| **no active membership** | Not part of any organization, or membership disabled/pending. |

The `has_active_access` boolean on `MembershipInline` is the canonical gate for workspace access. A membership may have a role of `member` but `has_active_access=false` (e.g. disabled), in which case the user should not see active workspace features.

---

## Permission Helpers (frontend/src/features/organizations/utils/membershipUtils.ts)

All frontend role checks use the helpers in `membershipUtils.ts`. The helpers are thin wrappers that delegate to `canManageWorkspaceContent()` — the single source of truth for admin/owner logic.

| Helper | Returns true when |
|--------|-------------------|
| `canManageWorkspaceContent(role)` | role is `owner` or `admin` |
| `canManageOfficeSetup(role)` | role is `owner` or `admin` |
| `canManageFloorLayout(role)` | role is `owner` or `admin` |
| `canInviteMembers(role)` | role is `owner` or `admin` |
| `canBookDesk(membership)` | `membership.has_active_access === true` |
| `isActiveMembership(membership)` | `membership.has_active_access === true` |
| `hasActiveMembership(user)` | user has at least one membership with `has_active_access=true` |

Frontend role logic is for **UX visibility only**. The backend is the source of truth and will return 403 for unauthorized API calls.

---

## Navigation Behaviour

**Before PR 049:**
- Nav: Dashboard, Offices, Desk Booking, Events (→ ComingSoon), People
- No "My Bookings" in nav
- Events was always visible and led to a placeholder page

**After PR 049:**
- Nav: Dashboard, Offices, Desk Booking, My Bookings, People
- Events removed from nav (route still exists at `/app/events` for future use)
- My Bookings added with `BookmarksOutlined` icon
- Profile-completion gating unchanged (all items except Dashboard are locked until profile is complete)
- Nav items are the same for all roles (role-based differences appear at the page level)

---

## Dashboard Behaviour

No changes in this PR. Dashboard role-awareness was introduced in PR 046/048:
- Admin/owner: setup checklist, health cards, admin quick actions
- Member: booking-focused view, workspace-not-ready message if desks not set up
- No-org: create workspace prompt

---

## Offices / Floors Behaviour

**Before PR 049:** All users (including members) saw the "Add office" / "Add floor" buttons and empty-state create actions regardless of role.

**After PR 049:**

| Scenario | Owner/Admin | Member |
|----------|------------|--------|
| No offices | Shows "No offices yet" + Add office button | Shows "No offices available" + contact admin message |
| Offices exist | Shows list + Add office button | Shows list without Add office button |
| No floors | Shows "No floors yet" + Create first floor button | Shows "No floors available" + contact admin message |
| Floors exist | Shows list + Add floor button | Shows list without Add floor button |

Members visiting the Offices or Office Detail pages see read-only lists. The page is accessible (no route guard added) but all creation actions are hidden.

---

## Floor Layout / Canvas Behaviour

**Before PR 049:** Object library was visible to all users (left panel). Create form was already gated.

**After PR 049:**

| UI Element | Owner/Admin | Member |
|-----------|------------|--------|
| Object library (left panel) | Visible | Hidden |
| Create form (left panel) | Visible | Hidden |
| Canvas toolbar (grid/snap) | Full controls | Grid toggle only |
| Canvas drag/resize/rotate | Enabled | Disabled |
| Keyboard movement | Enabled | Disabled |
| Read-only banner | Not shown | Shown (info Alert) |
| Inspector panel | Full details | Full details (view only) |
| Desk resource panel | Create/edit/deactivate | View only |
| Object list | With delete actions | With delete actions (delete gated by `canManageLayout`) |

The `canManageLayout = canManageFloorLayout(membership?.role)` variable gates all edit controls. Keyboard arrow-key movement also checks `canManageLayout` to prevent member keyboard mutations.

---

## Desk Resource Behaviour

No new changes in this PR. Desk resource panel (`DeskResourcePanel`) already uses `canManageLayout` prop from `FloorLayoutPage`:
- Admin: create/edit/deactivate buttons visible
- Member: view-only mode

---

## People Page Behaviour

No new changes in this PR. People page already uses `canManageWorkspaceContent`:
- Admin/owner: invite form, pending invitations list, copy link, cancel invite
- Member: members list only (no invite controls, no pending invitation tokens)
- No-org: "No workspace yet" empty state

---

## Booking Behaviour

No new changes in this PR. Booking pages already handle role-aware empty states:
- `DeskBookingPage`: role-specific empty states for no-offices / no-floors / no-desks scenarios
- `MyBookingsPage`: no role-specific checks needed (all active members can view own bookings)
- Both pages require active membership (enforced at backend; frontend shows appropriate empty states)

---

## Dead Code Cleanup

`LayoutObjectEmptyState` was exported from the `layoutObjects` feature barrel (`index.ts`) but was not imported or used anywhere in the application. It was removed in this PR:
- Deleted: `frontend/src/features/layoutObjects/components/LayoutObjectEmptyState.tsx`
- Removed: barrel export in `frontend/src/features/layoutObjects/index.ts`

Note: the member-facing canvas empty state (i18n keys `emptyStateMemberTitle`, `emptyStateMemberSubtitle`) is already wired inside `FloorMapCanvas.tsx` — the canvas switches between admin copy (`canvasEmptyTitle`) and member copy (`emptyStateMemberTitle`) based on the `canManageLayout` prop. This was implemented in a prior PR and confirmed correct.

---

## Tests

### New test files
- `frontend/src/features/offices/__tests__/OfficesEmptyState.test.tsx` — admin/member/default prop variants
- `frontend/src/features/floors/__tests__/FloorsEmptyState.test.tsx` — admin/member/default prop variants

### Updated test files
- `frontend/src/features/organizations/__tests__/membershipUtils.test.ts` — covers all new helpers: `canManageOfficeSetup`, `canManageFloorLayout`, `canInviteMembers`, `canBookDesk`, `isActiveMembership`
- `frontend/src/features/organizations/__tests__/AppOfficesPage.test.tsx` — adds owner/admin/member role scenarios; verifies `canManage` prop propagation
- `frontend/src/app/layout/__tests__/AppSidebar.test.tsx` — verifies My Bookings is present; verifies Events is not present; verifies My Bookings selection state

### Test counts
- **Before PR 049:** 1048 tests
- **After PR 049:** 1049 tests (net: +1 from this PR's additions and the previous count)

All 1049 tests pass. TypeScript clean. ESLint clean. Prettier clean. Build clean. Audit: 0 high vulnerabilities.

---

## Manual Test Checklist

### Admin/owner
- [ ] Dashboard shows setup/manage actions
- [ ] Sidebar shows: Dashboard, Offices, Desk Booking, My Bookings, People (no Events)
- [ ] Offices page shows "Add office" button and create office flow
- [ ] Office Detail page shows "Add floor" button and create floor flow
- [ ] Floor Layout page shows object library + create form in left panel
- [ ] Desk panel shows create/edit/deactivate controls
- [ ] People page shows invite form and pending invitations
- [ ] Book a Desk and My Bookings work

### Member
- [ ] Dashboard shows booking-focused view (no setup checklist)
- [ ] Sidebar shows: Dashboard, Offices, Desk Booking, My Bookings, People (no Events)
- [ ] Offices page: no "Add office" button; member-specific empty state if no offices
- [ ] Office Detail page: no "Add floor" button; member-specific empty state if no floors
- [ ] Floor Layout page: no object library, no create form; read-only banner visible
- [ ] Desk panel: view-only (no create/edit/deactivate)
- [ ] People page: no invite form, no pending invitation tokens
- [ ] Book a Desk and My Bookings work

### No org
- [ ] Dashboard shows create workspace prompt
- [ ] Offices page shows org setup flow

---

## What Is Not Included

- Multi-org switcher
- Role-based route guards (routes are accessible; pages render role-appropriate UX)
- Invitation expiry display in pending list (tracked as TD-038)
- Email delivery for invitations (tracked as TD-039)
- Events page implementation
- Admin analytics or billing

---

## Deferred Items

| Item | Notes |
|------|-------|
| Invitation expiry badge | TD-038 |
| Role-based route guards | Page-level role UX is sufficient for MVP; route guards can be added as a hardening step |
| Events page | Route preserved at `/app/events`; remove route when Events is permanently deferred or implement when ready (TD-042) |
