# PR 054 — Dashboard Accuracy and Booking/Canvas Test-Debt Cleanup

## Purpose

Resolve the remaining MVP-quality dashboard accuracy and booking/canvas
testing/UX debt before the final architecture cleanup PR (055). This PR closes
four debt items:

- **TD-035** — Dashboard showed first-office/first-floor data only.
- **TD-032** — Canvas availability style test gap.
- **TD-033** — `DeskBookingPage` floor-selection integration test gap.
- **TD-034** — `AvailabilityMapLegend` scroll detachment on narrow viewports.

## Why this PR exists

The dashboard health cards and admin setup checklist were derived from
`useDashboardData`, which only fetched floors for the **first** office and
desks for the **first** floor. A multi-office organization whose floors/desks
lived in a second office saw misleading "incomplete" setup state and partial
counts. PR 054 makes the dashboard org-wide accurate and pays down three
related booking/canvas test/UX nits flagged during the MVP review.

## Dashboard summary endpoint

**`GET /api/offices/summary/`** (`offices.views.OrganizationSummaryView`)

Resolves the organization from the caller's first active membership —
consistent with every other offices endpoint — and returns org-wide aggregate
counts using `count()` queries (no N+1):

```json
{
  "organization": 10,
  "offices_count": 2,
  "floors_count": 4,
  "layout_objects_count": 25,
  "bookable_desks_count": 18,
  "active_members_count": 6,
  "pending_invitations_count": 2,
  "has_offices": true,
  "has_floors": true,
  "has_layout_objects": true,
  "has_bookable_desks": true,
  "setup_complete": true
}
```

Counting rules (active resources only):

- `offices_count` — active offices in the org.
- `floors_count` — active floors on active offices.
- `layout_objects_count` — active layout objects on active floors/offices.
- `bookable_desks_count` — active desk resources on an active floor/office
  (mirrors the desk list endpoint's `is_active=True` filter; decommissioned
  desks and those on archived floors/offices are excluded).
- `active_members_count` — `Membership.status == active`.
- `setup_complete = has_offices and has_floors and has_bookable_desks`.

### Permissions & privacy

- Authenticated **active** member of the org can read the summary
  (owner/admin/member alike).
- No membership → 403; disabled membership → 403; unauthenticated → 401.
- Tenant isolation: counts only ever reflect the caller's own org; another
  org's offices/floors/desks never leak in.
- **Count-only** — no member identities, booking identities, or invitation
  tokens are exposed.
- `pending_invitations_count` is **manager-gated**: owners/admins get the real
  count; regular members always get `0`.

## Dashboard org-wide readiness behaviour (frontend)

- New `features/dashboard/api/dashboardApi.ts` (`getWorkspaceSummary`),
  `features/dashboard/types/dashboard.types.ts` (`WorkspaceSummary`), and
  `features/dashboard/hooks/useWorkspaceSummary.ts` (AbortController-guarded,
  refetches on org change, skips fetch for no-org users).
- `DashboardPage` now drives **health-card counts** and **setup-completion
  booleans** (`has_offices`/`has_floors`/`has_bookable_desks`/`setup_complete`)
  from the summary rather than first-office arrays.
- `getWorkspaceSetupState` and `getSetupChecklist` were refactored to accept
  org-wide booleans (`hasOffices`/`hasFloors`/`hasBookableDesks`). The first
  office/floor ids are still passed but are used **only** for convenience
  deep-links (checklist actions / quick actions), not for completion.
- `useDashboardData` no longer fetches desks; it keeps the first-office floor
  fetch solely to resolve `firstFloor` for navigation, plus offices and the
  user's bookings for the today/upcoming cards.
- Graceful degradation: while the summary loads, the member "workspace being
  set up" banner is suppressed (no flash) and health cards show skeletons; on
  summary error the health cards surface an error alert and readiness defaults
  to incomplete rather than showing misleading "complete" state.

Result: an admin whose floors/desks exist only in a **second** office now sees
correct org-wide counts and a complete setup state, and a member's
workspace-ready state reflects any bookable desk anywhere in the org.

## Canvas style testability improvement (TD-032)

Extracted the canvas node's style decision into a pure, unit-tested selector:

- `features/layoutObjects/utils/layoutObjectNodeStyle.ts` —
  `getLayoutObjectNodeStyle({ objectType, isSelected, isSaving,
  availabilityStatus, isAvailabilitySelected })` returns
  `{ fill, stroke, strokeWidth, opacity, dash }`.
- `LayoutObjectCanvasNode` now renders exactly what the selector returns (no
  behaviour change on the canvas).
- The selector composes the existing source-of-truth helpers
  (`getLayoutObjectRenderConfig`, `getAvailabilityCanvasStyle`,
  `SELECTED_STROKE`), so a constant change is caught by the unit tests without
  depending on a Konva render.

Booking-mode availability is the source of truth when an `availabilityStatus`
is present (editor selection is ignored); editor mode uses the render config +
editor selection highlight.

## Booking floor-selection integration test (TD-033)

`src/app/__tests__/DeskBookingPage.floorSelection.test.tsx` mounts
`DeskBookingPage` with one office and two floors that have distinct
desks/layout objects (floor-keyed hook mocks). It asserts:

- Selecting Floor A renders Floor A's desk and the map's Floor A layout object.
- Switching to Floor B swaps the desk list and map layout objects; Floor A's
  desk no longer renders (proves the map actually changes — not a false green).
- `useDeskBookings` is driven with both floor ids (availability reloads for the
  new floor).
- The previously selected desk is cleared on floor change (no stale selection).
- The role-aware no-desks empty state still renders for a floor without desks.

## Availability legend layout fix (TD-034)

`AvailabilityMapLegend` is now rendered **above** the scrollable canvas inside
the same map card, as a persistent header, so it never detaches when the canvas
scrolls horizontally on narrow viewports. The legend uses `flexWrap` + `rowGap`
so every status label stays visible without horizontal overflow, and retains
full text labels (no colour-only reliance).

## Tests

**Backend** — `offices/tests/test_organization_summary.py` (17 tests):
auth/membership guards (401/403, disabled, owner, member), org-wide counts,
the multi-office "desks only in second office → setup complete" case,
active-only filtering (inactive office, decommissioned desk), tenant isolation,
manager-vs-member pending-invitation visibility, no token leakage, and response
shape.

**Frontend**

- `features/dashboard/__tests__/dashboardState.test.ts` — updated to the
  org-wide boolean API; adds the non-first-office readiness case.
- `app/__tests__/DashboardPage.test.tsx` — mocks `useWorkspaceSummary`; adds
  org-wide totals, non-first-office completion, member readiness from summary,
  summary-error handling, and no-flash-while-loading.
- `features/dashboard/__tests__/useWorkspaceSummary.test.tsx` — no-fetch when
  no org, success, error.
- `features/layoutObjects/__tests__/layoutObjectNodeStyle.test.ts` — selector
  unit tests.
- `app/__tests__/DeskBookingPage.floorSelection.test.tsx` — TD-033 integration
  tests.
- `features/bookings/__tests__/AvailabilityMapLegend.test.tsx` /
  `BookingFloorMap.test.tsx` — legend order + wrap + legend-before-canvas.

## Manual checklist

1. Create an org with two offices; add a floor + bookable desk only to the
   **second** office.
2. Admin dashboard shows `setup_complete` / correct org-wide counts
   (offices = 2, floors ≥ 1, bookable desks ≥ 1).
3. Member dashboard shows "workspace ready" because a bookable desk exists.
4. Booking page floor selector: choose Floor A, then Floor B — the desk
   list/map update to Floor B; no stale selected desk.
5. Availability legend: narrow the viewport so the canvas scrolls horizontally;
   the legend stays above the map, readable, all labels visible.
6. Booking map colours (available/reserved/your booking/unavailable) unchanged.
7. Editor mode: canvas editor styling and drag/resize/rotate unchanged.

## What this PR does not include

- FloorLayoutPage large-file refactor (TD-019).
- Hook caching architecture (TD-021).
- Multi-org switcher (TD-037).
- Email delivery / resend invitation changes, booking-rule changes,
  recurring/half-day/meeting-room bookings, analytics, billing, UI redesign.

## Deferred items (PR 055)

- **TD-019** — extract `FloorLayoutPage` callbacks into `useCanvasInteractions`.
- **TD-021** — TTL/caching between route navigations.
- **TD-037** — multi-org switcher / per-org dashboard navigation.

The summary endpoint resolves the org from the first active membership, so it
is forward-compatible with a future multi-org switcher (which would pass the
selected org explicitly).
