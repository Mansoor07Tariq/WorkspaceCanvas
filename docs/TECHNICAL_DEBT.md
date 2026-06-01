# WorkspaceCanvas Technical Debt Register

## Purpose

This document is a long-lived register of known engineering debt, product risk, architecture limitations, and deferred cleanup for WorkspaceCanvas. It is not a one-off report — it must be maintained across every PR.

## How to Use This Document

- Every PR **must** update this file if it introduces, resolves, or intentionally defers debt
- Do not use this file to hide blockers — blockers belong in PR descriptions too
- Any security or data-integrity item must have an owner and priority
- Resolved items move to the Resolved section with a PR reference
- Review this document before every milestone and before merging any PR that touches auth, permissions, tenant isolation, bookings, or data models
- IDs are assigned sequentially; never reuse a retired ID

## Severity Definitions

| Severity | Meaning |
|----------|---------|
| **Blocker** | Cannot ship to real users; must fix before merge or before production |
| **Important** | Should fix before real users; risk of data loss, security issue, or user-facing bug |
| **Minor** | Fix before MVP demo; notable UX, correctness, or maintainability issue |
| **Nit** | Code quality, style, or minor devex improvement |

## Categories

- **Security** — auth, permissions, CSRF, XSS, injection, secrets
- **Privacy** — user data exposure, identity leakage
- **Data-integrity** — race conditions, constraints, soft-delete, lifecycle
- **Backend** — architecture, models, views, serializers, admin
- **Frontend** — components, routing, state, hooks, types
- **Testing** — coverage gaps, false-green tests, missing critical tests
- **Documentation** — stale docs, missing docs, misleading docs
- **Performance** — slow queries, bundle size, rendering
- **Accessibility** — WCAG compliance, keyboard, screen reader
- **DevEx** — local setup, CI, Makefile, tooling
- **Product-limitation** — intentionally incomplete features, known UX gaps

---

## Current Open Debt

| ID | Severity | Category | Area | Summary | Impact | Recommended Fix | Suggested PR | Status |
|----|----------|----------|------|---------|--------|-----------------|--------------|--------|
| TD-003 | Important | Data-integrity | Backend / Models | No DB-level constraint preventing bookings against inactive or non-available desks | A desk deactivated after booking creation leaves `status=ACTIVE` bookings orphaned; users appear booked on unreachable desks | On `Desk.is_active` flip to `False`, cascade-cancel active bookings in a pre-save signal or overridden `save()`; add a post-save signal in `offices/signals.py` | PR 044 | open |
| TD-005 | Important | Data-integrity | Backend / Models | `DeskBooking` denormalization (stores `organization`, `office`, `floor` redundantly alongside `desk`) has no DB-level referential check | An admin-panel or management-command booking with inconsistent FK values will cause queries filtering on `floor` or `office` to silently misrepresent data | Add a `clean()` method on `DeskBooking` that asserts `self.office == self.desk.office` etc.; call `full_clean()` in `DeskBookingCreateView` before save | PR 044 | open |
| TD-006 | Important | Data-integrity | Backend / Bookings | No `select_for_update()` in booking creation path; race window between pre-checks and `transaction.atomic()` insert | Two concurrent requests for the same desk+date both pass pre-checks; second fails with `IntegrityError` (caught and returned as 409), so correctness is preserved — but the window is wider than necessary | Add `Desk.objects.select_for_update().get(...)` inside `transaction.atomic()` before pre-checks to serialize concurrent booking attempts for the same desk | PR 044 | open |
| TD-009 | Minor | Data-integrity | Backend / Models | `DeskBooking.user` uses `on_delete=CASCADE`; deleting a user removes all booking history | Audit trail and analytics data is permanently lost on user deletion | Switch to `on_delete=SET_NULL` with `user = models.ForeignKey(..., null=True, blank=True)`; or implement a soft-delete pattern for user accounts and document the tradeoff | PR 045 | open |
| TD-011 | Minor | Data-integrity | Backend / Models | No signal-based cascade when a desk is soft-deleted (`is_active=False`); the existing `DeskDetailView.delete` bulk-cancel path only fires via the PATCH/DELETE API, not on direct model saves | A management-command or admin-panel `is_active=False` save bypasses the view; active bookings remain orphaned | Add a `post_save` signal in `offices/signals.py` or override `Desk.save()` to cancel active bookings on `is_active` transition | PR 044 | open |
| TD-015 | Minor | Testing | Backend | Throttle behaviour for booking endpoints is not tested | Booking creation and cancellation endpoints may be vulnerable to burst abuse; throttle limits are unverified | Add throttle tests analogous to the existing `test_throttling.py` for `DeskBookingCreateView` and `DeskBookingCancelView` | PR 045 | open |
| TD-019 | Minor | Frontend | Architecture | `FloorLayoutPage` is 477 lines and directly imports from 6 feature slices | Approaching the size where a single bug can have unpredictable surface area; callbacks are hard to unit-test in isolation | Extract `handleObjectMove`, `handleObjectDragEnd`, `handleObjectTransform`, and `handleCanvasKeyDown` into a `useCanvasInteractions(...)` custom hook | PR 044 | open |
| TD-020 | Minor | Frontend | State | No request deduplication in per-feature hooks; rapid navigations fire multiple concurrent fetches | Wasted network traffic; if a slow response arrives after a fast one, the `cancelled` guard prevents stale state — but server load is unnecessary | Track in-flight request AbortControllers per hook and cancel the previous fetch before issuing a new one | PR 045 | open |
| TD-021 | Minor | Frontend | State | No caching between route navigations in any feature hook | Every mount unconditionally re-fetches from the server; a user toggling between two floors triggers two full fetches | Add a simple TTL-based cache key in each hook, or adopt a caching library (e.g., SWR, TanStack Query) at the next architectural milestone | PR 044 | open |
| TD-032 | Nit | Testing | Frontend / Canvas | No unit test verifying that `LayoutObjectCanvasNode` passes the correct `fill`/`stroke` from `getAvailabilityCanvasStyle` to Konva shape props; Konva mock does not expose rendered prop values | Style regressions in the node would not be caught at the unit level; caught only if the canvas helper tests change | Extract the style computation into a small testable selector or add Konva snapshot tests when Konva testing utilities mature | PR 044 | open |
| TD-033 | Minor | Testing | Frontend / Bookings | `DeskBookingPage.test.tsx` has no integration test exercising the floor-selection path to verify the map section renders | A regression that breaks `BookingFloorMap` mounting after floor selection would not be caught here; covered only indirectly by `BookingFloorMap.test.tsx` with a mocked canvas | Add a test with userEvent floor-selection interaction, or set up a Playwright/Cypress e2e test for the booking flow | PR 044 | open |
| TD-034 | Nit | UX | Frontend / Bookings | `AvailabilityMapLegend` is positioned below the canvas wrapper; on viewports narrow enough to trigger horizontal canvas scroll, the legend stays in place but the desk objects scroll away, which may look disconnected | Minor visual disconnect on narrow screens; functional fallback (list) is unaffected | Consider sticky positioning for the legend or moving it to a fixed position outside the scroll container | PR 044 | open |

---

## Resolved Debt

| ID | Summary | Resolved In | Notes |
|----|---------|-------------|-------|
| RD-001 | Vite chunk-size warning | PR 036 | Bundle splitting + vendor chunk resolved warning |
| RD-002 | Canvas drag/resize stale state | PR 035 | Optimistic rollback integrated |
| RD-003 | Canvas snap/clamp helper gaps | PR 037 | Clamping and snapping hardened before merge |
| RD-004 | Stale desk form on edit | PR 038 | Reset on open resolved before merge |
| RD-005 | Desk code field clearing bug | PR 039 | Patched before merge |
| TD-031 | Floor map canvas did not colour desk shapes by availability; colour coding was list-only | PR 043 | Added `mode="booking"` to `FloorMapCanvas`; availability colours (`available/reserved/bookedByMe/unavailable`) applied via `getAvailabilityCanvasStyle`; map selection syncs with list and panel; `BookingFloorMap` + `AvailabilityMapLegend` added; privacy: only status (no identity) passes to canvas |
| TD-016 | Entire bookings frontend feature slice had zero production call-sites; `/app/bookings` rendered only `ComingSoonPage` | PR 042 | Resolved in PR 042 — `DeskBookingPage` wired to `/app/bookings`; `useDeskBookings`, `createDeskBooking`, `cancelDeskBooking`, and `bookingApi` all have live call-sites |
| TD-001 | `AUTH_COOKIE_SAMESITE` hardcoded to `"Lax"` with no env-configurable override | PR 041 | Settings now reads `AUTH_COOKIE_SAMESITE` from environment via `os.environ.get("AUTH_COOKIE_SAMESITE", "Lax")`; default unchanged |
| TD-002 | `DEFAULT_PERMISSION_CLASSES` not set in `REST_FRAMEWORK`; DRF defaulted to `AllowAny` | PR 041 | Set `IsAuthenticated` as the default permission class in settings |
| TD-004 | `Desk.code` uniqueness per office is application-level only; no `UniqueConstraint` in the model | PR 041 | Added `UniqueConstraint(fields=["office", "code"], condition=Q(is_active=True))` with migration |
| TD-007 | `delete_cookie()` in `auth_cookies.py` does not pass `secure=` flag; logout may silently fail in production | PR 041 | Passed `secure=settings.AUTH_COOKIE_SECURE` to `delete_cookie()` call |
| TD-008 | `AUTH_COOKIE_MAX_AGE` and `SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]` maintained as separate literals | PR 041 | `AUTH_COOKIE_MAX_AGE` now derived from `SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()` |
| TD-010 | `Office.generate_slug` and `Floor.generate_slug` are not concurrency-safe (TOCTOU loop) | PR 041 | Added docstrings warning callers that the method proposes a candidate slug only |
| TD-012 | `DeskBookingDetailView` (GET `/bookings/:id/`) has zero test coverage | PR 041 (final cleanup) | Added `test_desk_booking_detail.py` covering happy path, auth, cross-org, floor mismatch (wrong-floor returns 404), cancelled booking, admin full-identity, member masked-identity |
| TD-013 | Admin/owner identity visibility in booking list is not tested for the manager path | PR 041 (final cleanup) | Added `test_admin_sees_full_identity_for_others` in `test_desk_booking_list.py`; asserts `user_name != "Reserved"` and `user == member_user.id` in admin booking list response |
| TD-014 | `cancelled_by` field exposure to non-owners/non-admins is not asserted in any test | PR 041 (final cleanup) | Added `test_member_cannot_see_cancelled_by_for_others` in `test_desk_booking_list.py`; sets `cancelled_by` via ORM and asserts a regular member cannot see it in the list response |
| TD-017 | `tick` counter is `useState<number>` in three hooks but `useReducer<number>` in `useFloors` | PR 041 | Standardized all four hooks: `useFloors` tick counter changed from `useReducer` to `useState(0)` with `setTick((n) => n + 1)`; `useOffices` confirmed consistent |
| TD-023 | `VerifyEmailPage` and `MfaChallengePage` have no guard preventing authenticated users from accessing them | PR 041 | Added `GuestOnlyRoute` component (inverse of `ProtectedRoute`); wraps `LoginPage`, `SignupPage`, `VerifyEmailPage`, and `MfaChallengePage` in `AppRouter`; authenticated users are redirected to `/app` |
| TD-024 | `docs/040-...` lists desk FK `on_delete` as `CASCADE`; code uses `PROTECT` | PR 041 | Corrected doc table to reflect `PROTECT` |
| TD-025 | `docs/040-...` states `ordering: ["-booking_date", "-created_at"]`; code has ascending `created_at` | PR 041 | Updated ordering to `["-booking_date", "created_at"]` in doc |
| TD-026 | README "Current Status / Upcoming work" lists already-completed features as upcoming | PR 041 | Rewrote Current Status and Upcoming Work sections to reflect actual project state as of PR 040 |
| TD-027 | README documentation index ends at `026-auth-security-cleanup.md`; docs 027–040 are missing | PR 041 | Appended all entries from docs 027 through 041 in the README documentation table |
| TD-028 | README "Project Structure" diagram is stale; omits `offices/`, `users/`, and other backend apps | PR 041 | Updated diagram to reflect real directory structure including all backend apps and frontend features |
| TD-029 | `generate_slug` methods on `Office` and `Floor` lack docstrings warning they propose a candidate slug | PR 041 | Added docstrings: "Returns a candidate slug. Uniqueness is not guaranteed; callers must handle IntegrityError." |
| TD-018 | Two similarly-named `OfficesEmptyState` components in `features/offices` and `features/organizations` with diverging props and i18n namespaces | PR 041 (final cleanup) | Chose Option A: created shared primitive `components/ui/EmptyState.tsx` accepting `icon`, `title`, `description`, `actionLabel?`, `onAction?`, `actionDisabled?`, `actionDisabledTooltip?`; both `OfficesEmptyState` wrappers now delegate to it; all call sites unchanged |
| TD-022 | Authenticated users hitting an unknown URL are redirected to `/login` rather than a 404 page | PR 041 (final cleanup) | Created `app/pages/NotFoundPage.tsx` with `role="main"`, 404 heading, descriptive message, and "Back to App" button; `AppRouter` catch-all `path="*"` now renders `NotFoundPage` instead of `<Navigate to={ROUTES.login}>`; 4 tests added in `app/__tests__/NotFoundPage.test.tsx` |
| TD-030 | `Desk.status` and `Desk.is_active` are orthogonal fields with no enforced relationship | PR 041 (final cleanup) | Added two-line inline comment above the `status` field in `offices/models.py` explaining the intended invariant and that `is_active=False` is the authoritative soft-delete flag |
| — | `DeskDetailView.patch` did not catch `IntegrityError` from the `unique_active_desk_code_per_office` constraint; a PATCH to an existing code would return an unhandled 500 | PR 041 (final cleanup) | Added `try/except IntegrityError` in `DeskDetailView.patch`; returns `{"code": ["A desk with this code already exists in this office."]}` 400; test `test_patch_code_to_existing_code_rejected` added to `test_desk_code_uniqueness.py` |
| — | `DeskBookingCancelView.post` and the `DeskDetailView.delete` bulk-cancel path did not include `updated_at` in `update_fields`; `updated_at` remained stale after cancellation | PR 041 (final cleanup) | Added `"updated_at"` to `booking.save(update_fields=[...])` in `DeskBookingCancelView.post` and to the bulk `.update()` in `DeskDetailView.delete`; test `test_cancellation_updates_updated_at` added to `test_desk_booking_cancel.py` |
| — | All three booking queryset locations (`DeskBookingListCreateView.get`, `DeskBookingDetailView.get`, `DeskBookingCancelView.post`) were missing `select_related("cancelled_by")`; accessing `cancelled_by` on each booking triggered an extra query per row | PR 041 (final cleanup) | Added `"cancelled_by"` to `select_related(...)` in all three view querysets |
| — | `serializers.py` `_can_see_identity` lacked a comment explaining the `not request` fallback path | PR 041 (final cleanup) | Added two-line comment explaining the fallback is for Django admin shell / admin site usage where no request object exists |
| — | Multi-booking deactivation via `DeskDetailView.delete` was only tested for a single booking; edge case of multiple bookings on different dates was unverified | PR 041 (final cleanup) | Added `test_deactivating_desk_cancels_multiple_bookings` to `test_desk_deactivation_cancels_bookings.py`; creates 3 bookings on 3 different dates, deactivates the desk, asserts all 3 are cancelled with `cancelled_at` set and `cancelled_by == owner_user` |
| — | `test_owner_can_cancel_any_booking` and `test_admin_can_cancel_any_booking` in `test_desk_booking_cancel.py` did not assert `cancelled_by` on the model after the cancel call | PR 041 (final cleanup) | Both tests now call `refresh_from_db()` and assert `status == CANCELLED`, `cancelled_at is not None`, and `cancelled_by == owner_user` / `cancelled_by == admin_user` |

---

## PR Review Checklist

Use this before every PR merge:

- [ ] Did this PR introduce any known debt? If yes, add it to the Current Open Debt table above
- [ ] Did this PR resolve existing debt? If yes, move items to Resolved
- [ ] Are there any security/privacy/data-integrity issues?
- [ ] Are tests meaningful, or do they pass vacuously (mock too much, assert too little)?
- [ ] Are docs updated and accurate?
- [ ] Did backend DB-touching changes run against a real PostgreSQL instance?
- [ ] Are frontend tests, TypeScript, ESLint, and build all clean?
- [ ] Are backend Ruff, Django system check, and migration check all clean?
- [ ] Does any new endpoint enforce tenant isolation (org scoping)?
- [ ] Does any permission change affect admin/member boundaries correctly?

---

## Ownership and Review Cadence

- Review the full debt register before every MVP milestone
- Review before merging any PR that touches: auth, permissions, tenant isolation, bookings, data models, or canvas state
- The PR author is responsible for updating this document in their PR
- High-severity items (Blocker/Important) should have a named owner and target PR

---

*Last updated: 2026-06-01 — PR 043 canvas availability colouring; TD-031 resolved (floor map now colours desks by availability status and supports map-based desk selection); TD-003/005/006/011 retargeted to PR 044 (backend booking data integrity hardening); TD-009/015/020 retargeted to PR 045 (backend/request hygiene); TD-032/033/034 added (canvas style test gap, floor-selection integration test gap, legend scroll nit)*
