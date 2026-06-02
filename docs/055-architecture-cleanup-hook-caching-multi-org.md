# PR 055 — Architecture Cleanup: FloorLayoutPage Refactor, Hook Caching, and Multi-Org Switcher

## Purpose

Resolve the final planned pre-MVP architecture/product-debt items before the
final manual MVP demo pass:

- **TD-019** — `FloorLayoutPage` owned many canvas interaction callbacks inline.
- **TD-021** — no caching between route navigations; every mount refetched.
- **TD-037** — no multi-org support; the app always used the first active
  membership.

## Why this PR exists

These were the last accepted-debt items deferred through the MVP build. They
touch architecture (canvas callbacks), shared state (a request cache), and
tenant context (selected organization), so the work was split into three
behaviour-preserving slices, each landed and tested independently.

---

## Slice A — `useCanvasInteractions` (TD-019)

Canvas interaction logic moved out of `FloorLayoutPage` into a dedicated,
unit-tested hook: `features/layoutObjects/hooks/useCanvasInteractions.ts`.

**Inputs:** `{ officeId, floorId, objects, selectedObjectId, canManageLayout,
snapEnabled, gridSize, savingObjectIds, updateObjectLocally, setSaving }`.

**Outputs:** `{ handleObjectMove, handleObjectDragEnd, handleObjectTransform,
handleCanvasKeyDown, layoutSaveError, setLayoutSaveError, savedObjectId }`.

Responsibilities (behaviour identical to before):

- Optimistic move/transform PATCH with rollback of the previous values on
  failure (403 → permission message, else generic).
- Drag-end snap (both axes) → clamp; transform snap (size + position) → clamp;
  keyboard axis-specific snap → clamp.
- `e.repeat` suppression and `savingObjectIds` concurrent-save guard.
- Saving/Saved feedback (`savedObjectId` + 2s flash, cleared on unmount).

`FloorLayoutPage` keeps page-level orchestration and now consumes the hook.
Editor/booking modes, owner/admin/member behaviour, and all existing
`FloorLayoutPageIntegration` and `FloorMapCanvas` tests are unchanged.

**Tests:** `useCanvasInteractions.test.tsx` (17) — member read-only, drag/move
success + rollback, transform success + rollback, snap/grid, clamp, `e.repeat`,
missing-object safety; existing integration tests (27) still pass.

---

## Slice B — request cache (TD-021)

`features/lib/api/requestCache.ts` — a tiny in-memory TTL cache.

API: `getCachedValue`, `setCachedValue`, `isCacheFresh`, `invalidateCache`,
`clearRequestCache`, `getOrFetchCached`.

Design:

- In-memory only (no localStorage); default TTL **30s**; per-key.
- Expired entries pruned lazily on read; only successful responses are cached.
- `invalidateCache(target)` removes the exact key and any hierarchical child
  (`target + ":"`), so `invalidateCache("floors:5")` clears `floors:5` and
  `floors:5:*` but **not** `floors:50`. A trailing-colon target
  (`"offices:"`) is a namespace prefix.
- `clearRequestCache()` runs in test teardown (`src/test/setup.ts`) for
  isolation.

**Applied to** (synchronous cache-hit → no loading flicker; `refresh()` forces a
bypass): `useOffices`, `useFloors`, `useDesks`, `useLayoutObjects`,
`useWorkspaceSummary`.

**Cache keys** (org/office/floor ids baked in to prevent cross-org bleed):

| Hook | Key |
|------|-----|
| `useOffices(orgId?)` | `offices:<orgId|default>` |
| `useWorkspaceSummary(orgId)` | `summary:<orgId>` |
| `useFloors(officeId)` | `floors:<officeId>` |
| `useDesks(officeId, floorId)` | `desks:<officeId>:<floorId>` |
| `useLayoutObjects(officeId, floorId)` | `layoutObjects:<officeId>:<floorId>` |

**Invalidation** lives in the mutation API functions so callers can't forget:

- `createOffice` → `offices:`, `summary:`
- `createFloor` → `floors:<officeId>`, `summary:`
- `createDesk`/`updateDesk`/`deleteDesk` → `desks:<officeId>:<floorId>`, `summary:`
- `createLayoutObject`/`deleteLayoutObject` → `layoutObjects:<officeId>:<floorId>`, `summary:`
- `updateLayoutObject` (move/resize — counts unchanged) → `layoutObjects:<officeId>:<floorId>` only

Booking hooks (`useDeskBookings`, `useMyBookings`) were intentionally left
uncached this PR (date/status keying + book/cancel invalidation deferred);
their `refresh()`-after-mutation behaviour is unchanged.

**Tests:** `requestCache.test.ts` (16) — store/expire/invalidate (incl. the
`floors:5` vs `floors:50` boundary), `getOrFetchCached` force + no-cache-on-
reject; `useOffices.cache.test.tsx` (5) — first-mount fetch, second-mount cache
hit, refresh bypass, mutation invalidation, per-org key separation.

---

## Slice C — selected organization (TD-037)

### Model

`features/organizations/context/SelectedOrganizationProvider.tsx` provides:

- `activeMemberships` (has_active_access only)
- `selectedOrganizationId` / `selectedMembership` / `selectedOrganizationName`
- `setSelectedOrganizationId(id)` (ignored unless `id` is an active membership)
- `hasMultipleOrganizations`

The effective selection is derived during render: the user's stored choice if it
is still an active membership, otherwise the first active membership (or null).
This re-validates automatically when memberships change (e.g. a membership is
disabled) — no stale selection. The choice is persisted to `localStorage`
(`wc.selectedOrganizationId`).

`useSelectedOrganization()` works **without** the provider by falling back to the
first active membership (single-org behaviour), so pages render correctly in
isolation (unit tests) and single-org users are entirely unaffected.

The provider is mounted in `AppLayout` (inside `ProtectedRoute`), wrapping
`AppShell` + all protected pages.

### Switcher UX

`OrganizationSwitcher` renders in the `AppShell` topbar **only** when
`hasMultipleOrganizations`. Switching updates the context and navigates to `/app`
(dashboard) so the user is never stranded on an office/floor route from the old
org. Org-scoped hooks then re-fetch under their org-namespaced cache keys, so no
org A data ever shows in org B.

### Page integration

- **Dashboard** — uses `selectedMembership`; `useWorkspaceSummary(orgId)` and
  `useDashboardData(orgId)` → `useOffices(orgId)`.
- **Offices** — `useOffices(selectedOrgId)`; office creation targets the
  selected org.
- **Booking** — `useOffices(selectedOrgId)`; floors/desks flow from the chosen
  office.
- **People** — `useTeamMembers`/`useInvitations` use the selected org id.
- **My Bookings** — unchanged: it is user-scoped across all active orgs
  (documented behaviour).
- **Floor Layout / Office Detail** — still use the first active membership for
  the UI role gate (see Remaining Debt); the backend enforces per-office
  permissions regardless.

### Backend selected-org support

`offices/permissions.py`:

- `get_active_membership_for_org(user, org_id)` — active membership for a
  specific org or None.
- `resolve_membership(user, org_id | None)` — explicit org (validated) else
  first active membership.
- `get_office_for_user(user, office_id) -> (office, membership)` — resolves an
  office in **any** of the user's active orgs and returns that org's membership
  for role checks. Returns `(None, None)` when the office doesn't exist or the
  user isn't an active member (→ 404, no existence leak).

Endpoints:

- `GET /api/offices/summary/?organization=<id>` and
  `GET|POST /api/offices/?organization=<id>` — honour the selected org via
  `resolve_membership`; absent/blank/non-numeric param falls back to first
  active membership (backward compatible). An org the caller isn't an active
  member of → 403.
- Nested floor/layout/desk/booking endpoints now resolve the office via
  `get_office_for_user`, so a multi-org user can work in a non-first org. This
  also fixes a latent bug where such offices returned 404. The no-active-
  membership 403 gate and not-found 404 contract are preserved.

**Security:** the `?organization` id and any office id are always validated
against the caller's **active** memberships; disabled memberships are rejected;
there is no cross-org data leakage or IDOR.

**Tests:** `offices/tests/test_selected_org.py` (12) — summary/offices select an
org, reject non-member (403) and disabled membership (403), invalid-param
fallback, create-in-selected-org, nested floor/layout access for a non-first
org, cross-org 404, and the preserved no-membership 403.

Frontend tests: `SelectedOrganizationProvider.test.tsx` (10),
`OrganizationSwitcher.test.tsx` (3), `DashboardPage.selectedOrg.test.tsx` (3).

---

## Cache + multi-org interaction

Cache keys for org-scoped data include the org id (`offices:<orgId>`,
`summary:<orgId>`); office/floor-scoped keys use globally-unique ids. Switching
org therefore naturally reads/writes different keys — org A's cached data can
never appear in org B. Verified by `useOffices.cache.test.tsx`
("different orgs use separate cache keys").

---

## Tests / checks

- **Frontend:** 1141 tests pass (84 files); `tsc` clean; ESLint clean; Prettier
  clean; `vite build` clean; `npm audit --audit-level=high` → 0.
- **Backend:** full suite green; `ruff check`/`ruff format --check`/
  `manage.py check`/migration check all clean (no model changes → no migration).

---

## Manual checklist

Floor layout: drag / resize / rotate / keyboard-move an object, snap+grid,
failed-save rollback, member read-only — all unchanged.

Caching: open Offices, navigate away and back quickly → no loading flicker;
create/update/delete → next view refetches; wait past TTL or `refresh()` →
refetch.

Multi-org: single-org user sees no switcher; two-org user sees the switcher;
switching updates dashboard / offices / people / booking and navigates to the
dashboard; selection persists across reload; an invalid/removed selection falls
back safely. Selecting an org you don't belong to is impossible from the UI and
rejected (403) by the backend.

If browser testing is unavailable, verification is by the automated suites above.

---

## What this PR does not include

New booking rules, recurring/half-day/meeting-room bookings, analytics, billing,
email-delivery changes, major UI redesign, large backend rewrite, full
enterprise org/account switching, a caching library (SWR/TanStack), booking-hook
caching, or a FloorLayoutPage redesign.

## Remaining debt

Both of the items below were tracked as TD-044 / TD-045 and **resolved in PR 056**
(see `docs/056-final-mvp-browser-qa-codebase-safety.md`):

- ~~Booking hooks (`useDeskBookings`/`useMyBookings`) are not yet cached
  (date/status keying + book/cancel invalidation) — a future enhancement.~~
  **Resolved (TD-044, PR 056):** TTL caching keyed on office/floor/date and
  status/from/to, with `invalidateBookingCaches()` on book/cancel/desk-mutation.
- ~~`FloorLayoutPage`/`OfficeDetailPage` role gates use the first active
  membership rather than the selected/per-office membership.~~
  **Resolved (TD-045, PR 056):** role resolved from the office's org
  (`organization` now on the office/floor serializers) via
  `getMembershipForOrganization`, falling back to the selected membership.
