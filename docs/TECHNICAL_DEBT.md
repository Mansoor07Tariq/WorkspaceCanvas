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
| TD-046 | Minor | Product-limitation | Bookings/Canvas | The "make a desk bookable / publish" UX is rough: a layout object becomes bookable only by linking a Desk resource in the Floor Layout inspector; there is no first-class "publish floor / publish desk" affordance, draft-vs-published state, or guided bookable-desk workflow | Admins can find it non-obvious how to turn a drawn desk into a bookable one; no draft/publish lifecycle for floors/desks | Design a dedicated publish/draft model + UX (floor publish state, clearer "make bookable" flow, copy). **Intentionally deferred out of PR 057** (found during browser QA) | PR 058+ | open |
| TD-048 | Minor | Product-limitation | Canvas | Object→boundary containment (PR 061) clamps the **axis-aligned** bounding box, so a rotated object's visual corners can poke a few px past the wall. The office boundary is also fixed (rectangular, derived from stage size); floor dimensions, non-rectangular shapes, and editable walls are not supported. Pan/zoom is intentionally not persisted. | Rotated objects can visually overhang the wall slightly; one fixed room shape/size | Precise rotated-AABB (or polygon) containment; editable floor dimensions / wall segments; optional saved viewport preference. **Intentionally deferred out of PR 061.** | PR 062+ | open |
| TD-049 | Minor | Product-limitation | Canvas/Enhance | Enhance/Tidy (PR 063) ships with: single-level undo only (last applied run; no full history stack); a **textual** preview (no ghost overlay of proposed positions); heuristic reason codes derived from object type + changed fields rather than per-rule provenance; and no backend bulk-transaction apply (best-effort per-op savepoints, by design). | Admins can't preview the exact visual result before applying, and can only undo the most recent run | Optional ghost-overlay preview; multi-level run history; thread per-rule provenance into `reasonCodes`. **Intentionally deferred out of PR 063.** | PR 064+ | open |

_TD-046 (bookable/publish UX, PR 057), TD-048 (PR 061 best-effort rotated containment + fixed rectangular boundary), and TD-049 (PR 063 Enhance/Tidy preview/undo limitations) are the open items. **PR 063 resolves the prior unsafe behaviour** where the isometric view toggle silently computed and persisted a tidy on every enable — tidy is now an explicit, previewed, best-effort, undoable admin action (`EnhanceRun`); the view toggle is view-only. TD-047 (PR 058 `PendingInvitationsPrompt` build-mode type error) was fixed in PR 059's commit `6e92b7d` — see the Resolved table. See `docs/063-safe-enhance-plan-preview-undo.md`._

---

## Resolved Debt

| ID | Summary | Resolved In | Notes |
|----|---------|-------------|-------|
| TD-047 | `PendingInvitationsPrompt.tsx:163` failed build-mode type-check (`tsc -b` → TS2769): `<Typography fontWeight={600} noWrap>` resolved to the `component`-required overload (the `fontWeight` system prop is not on the default overload under MUI v9 + TS 6); `npm run build` was red while `tsc --noEmit` stayed green | PR 059 (commit `6e92b7d`); verified in PR 060 | The fix moves the system prop into `sx`: `<Typography sx={{ fontWeight: 600 }} noWrap>`, so TS picks the default overload and the rendered element (default `body1` → `<p>`) is unchanged. Verified on PR 060 branch: `npm run build` exits 0, `tsc -b --force` exits 0, lint/format clean, 1210 frontend tests pass, `npm audit` 0 high. No further code change was needed |
| TD-044 | Booking hooks (`useDeskBookings`, `useMyBookings`) were not covered by the PR 055 request cache | PR 056 | Added TTL caching: `useDeskBookings` keyed `deskBookings:<office>:<floor>:<date>` (office+floor ids are globally unique → org-safe), `useMyBookings` keyed `myBookings:<status>:<from>:<to>` (per-user, scoped to the user's active orgs by the backend). Synchronous cache-hit (no flicker), `refresh()` force-bypass, AbortController stale-drop preserved, missing-scope empty lists never cached. `createDeskBooking`/`cancelDeskBooking`/`cancelMyBooking` and desk `update`/`delete` (which cancel bookings) call `invalidateBookingCaches()` → clears the whole `deskBookings:`/`myBookings:` namespaces so no stale availability survives a book/cancel. 14 new tests |
| TD-045 | `FloorLayoutPage`/`OfficeDetailPage` UI role gates used the first active membership, not the per-office/selected membership | PR 056 | Backend exposes `organization` on `OfficeResponseSerializer` and `FloorResponseSerializer` (derived from the office FK; `select_related("office")` avoids N+1; no privacy leak — the org id is already known to any member). Frontend resolves the role via `getMembershipForOrganization(activeMemberships, orgId)` using the loaded entity's org (`floors[0].organization` on OfficeDetail, `desks[0].organization` on FloorLayout), falling back to `selectedMembership` before data loads. A multi-org user who is admin in org A but member in org B now sees member (read-only) affordances on B's office/floor even via a direct route while A is selected. Backend still enforces the real permission. 12 new tests (helper + page role gates) |
| TD-019 | `FloorLayoutPage` owned many canvas interaction callbacks inline and was hard to unit-test | PR 055 | Extracted `useCanvasInteractions` (`features/layoutObjects/hooks/`) owning move/drag/transform/keyboard + optimistic rollback + snap/clamp + saving/saved feedback + `e.repeat`/concurrent-save guards. Behaviour-preserving (existing 27 integration + FloorMapCanvas tests unchanged); 17 new hook tests |
| TD-021 | Feature hooks refetched on every mount; no caching between route navigations | PR 055 | Added `lib/api/requestCache.ts` (in-memory TTL, default 30s, hierarchical `invalidateCache`, `clearRequestCache` in test teardown). Applied to `useOffices/useFloors/useDesks/useLayoutObjects/useWorkspaceSummary` with synchronous cache-hit (no loading flicker) and `refresh()` bypass; mutation API functions invalidate affected keys. Org/office/floor ids baked into keys to prevent cross-org bleed. 21 new tests. Booking hooks left uncached (see TD-044) |
| TD-037 | No multi-org support; the app always used the first active membership | PR 055 | Added `SelectedOrganizationProvider` + `useSelectedOrganization` (falls back to first active membership without a provider) + `OrganizationSwitcher` (topbar, shown only for >1 active org; switch navigates to dashboard). Dashboard/Offices/Booking/People follow the selected org. Backend: `?organization=` on offices list + summary (validated via `resolve_membership`) and `get_office_for_user` so nested floor/desk/booking endpoints resolve offices in any active org (also fixes a latent non-first-org 404). Tenant isolation enforced (403 for non-member/disabled). 28 new tests. Per-office role gate on Floor Layout / Office Detail deferred (see TD-045) |
| TD-035 | `useDashboardData` fetched floors/desks for the first office/floor only; health cards and setup checklist reflected first-office data, not org-wide totals | PR 054 | Added `GET /api/offices/summary/` — org-wide aggregate counts (offices/floors/layout objects/bookable desks/active members/pending invitations) resolved from the caller's active membership; count-only, no identity/token leakage; `pending_invitations_count` gated to managers (0 for members). Frontend `useWorkspaceSummary` drives health-card counts and `has_offices/has_floors/has_bookable_desks/setup_complete`. `getWorkspaceSetupState`/`getSetupChecklist` now take org-wide booleans; first office/floor used only for deep-links. Multi-office admins see accurate totals; member readiness reflects any bookable desk in the org |
| TD-034 | `AvailabilityMapLegend` sat below the scrollable canvas; on narrow viewports with horizontal canvas scroll the legend could look detached from the desk map | PR 054 | Legend moved ABOVE the scroll container inside the same map card as a persistent header; `flexWrap` + `rowGap` keep all status labels visible without horizontal overflow; text labels retained (no colour-only reliance); DOM-order and wrap tests added |
| TD-033 | `DeskBookingPage` had no integration test exercising the floor-selection path to verify the map/desk list re-renders for the chosen floor | PR 054 | Added `DeskBookingPage.floorSelection.test.tsx` (4 tests): parameterized floor-keyed hook mocks prove Floor A→B switch swaps the desk list and the map's layout objects, drives `useDeskBookings` with the new floor id, clears the previously selected desk (no stale selection), and preserves the role-aware no-desks empty state after a switch |
| TD-032 | No unit test verified that `LayoutObjectCanvasNode` applied the correct `fill`/`stroke` from `getAvailabilityCanvasStyle`; the Konva mock did not expose rendered prop values | PR 054 | Extracted the style decision into a pure `getLayoutObjectNodeStyle(...)` selector (Option A) that the node now renders verbatim; `layoutObjectNodeStyle.test.ts` asserts availability palette per status, booking/editor selection highlights, editor mode ignoring the booking palette, dash pass-through, and the save-dim opacity floor — comparing against the same source-of-truth helpers |
| TD-038 | Invitation token expiry (`expires_at`) was not surfaced in the admin pending-invitations UI | PR 053 | `PendingInvitationsList` now renders an expiry chip per row ("Expires in N days" / "Expires today/tomorrow" / "Expired") via the dependency-free `formatInvitationExpiry` helper; `expires_at` already present on the manager-scoped serializer |
| TD-039 | No email delivery for invitations; invite links had to be shared manually | PR 053 | Added `accounts/emails.py` (`send_invitation_email`) + plain-text template; invitation create now sends the email inside the same transaction (delivery failure → 503, no orphaned pending invite). Console backend in dev, SMTP via env in production. Invite URL built from `FRONTEND_URL` (no host-header trust). Copy-link flow retained |
| TD-040 | No "Resend invitation" button in the admin UI; admin had to cancel and re-invite | PR 053 | Added `POST /invitations/{id}/resend/` (manager-only, `invite_write` throttle). Resend refreshes token + expiry (Option B): old link is invalidated, new link emailed. Pending-only; accepted/cancelled rejected; expired-pending allowed. Resend button + success/error alert wired in `PeoplePage`/`PendingInvitationsList` |
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
| TD-041b | `LayoutObjectEmptyState` was exported from the `layoutObjects` barrel (`index.ts`) but had no import or call-site anywhere in the app | PR 049 | Component file and barrel export removed; no functionality lost |
| TD-042 | Events route (`/app/events`) still registered in `AppRouter` but led to `ComingSoonPage`; Events removed from sidebar in PR 049 | PR 051 | Route removed; `ROUTES.events` removed from `paths.ts`; `ComingSoonPage` deleted; `AppLayout` layout route added so all protected pages share a single AppShell |
| TD-043 | No demo data or seed command; manual QA required hand-crafting test fixtures each time | PR 050 | `seed_demo_workspace` management command added; idempotent, one-command setup for full demo workspace with admin/member users, org, office, floor, 13 layout objects, 5 desks, 3 bookings, and pending invitation |
| TD-009 | DeskBooking.user on_delete=CASCADE destroys booking history | PR 045 | Changed to SET_NULL null=True blank=True; migration generated; serializer handles null user ("Former user"); booking history preserved on user deletion |
| TD-036 | "Invite team" checklist item always incomplete and marked "Coming soon" | PR 047 | People page implemented; invite checklist item links to `/app/people`; marked complete when memberCount > 1; deferred flag removed |
| TD-041 | `AppPlaceholderPage` was orphaned — not routed anywhere but still had a 25-test file | PR 048 | Page and test file deleted; `DashboardPage` is the only `/app` route; no tests lost (behavior covered by `DashboardPage.test.tsx`) |
| TD-015 | Booking throttle behaviour not tested | PR 045 | Added test_desk_booking_throttle.py with 5 tests covering desk_booking_read and desk_booking_write scopes; override_settings used to set 1/min and 2/min limits; my-bookings endpoints also covered |
| TD-020 | No request deduplication in booking hooks | PR 045 | Added AbortController to useDeskBookings and useMyBookings; stale responses dropped via signal.aborted check; unmount cleanup via controller.abort() |
| TD-003 | No DB/model-level guard preventing bookings against inactive or non-available desks | PR 044 | Added `DeskBooking.clean()` validating `desk.is_active` and `desk.status == AVAILABLE`; `create_booking_for_user` service calls `booking.clean()` before save; 13 new model/service tests |
| — | Invitation endpoints (`create` / `cancel` / `accept` / public `detail`) had no throttle scope; the global `ScopedRateThrottle` is a no-op without a per-view scope | PR 052 | Added `_InviteWriteThrottle` (scope `invite_write`, POST-only) to InvitationListCreate/Cancel/Accept and `_InvitePublicReadThrottle` (scope `invite_read`, per-IP) to the public InvitationDetail lookup; default rates `60/hour` (write) and `120/hour` (read) in settings, env-overridable; 3 tests in `accounts/tests/test_invitation_throttle.py` |
| — | Offices, Floors, and Floor Layout pages rendered their main heading as `variant="h6"` with no semantic `h1`, so those MVP pages had no top-level heading landmark | PR 052 | Added `component="h1"` to the page headings in `OfficesList`, `FloorsList`, and `FloorLayoutPage` (visual style unchanged); all MVP pages now expose a single `h1` |
| TD-005 | `DeskBooking` denormalization had no model-level FK consistency check | PR 044 | `DeskBooking.clean()` asserts `booking.organization/office/floor` match `booking.desk.*`; service derives these from URL scope, not request body |
| TD-006 | No `select_for_update()` in booking creation; wider-than-necessary race window | PR 044 | `create_booking_for_user` in `offices/services/booking_service.py` wraps creation in `transaction.atomic()` with `Desk.objects.select_for_update().get(...)` before pre-checks; `IntegrityError` catch kept as last-resort race guard |
| TD-011 | No signal/model-level cascade when desk is soft-deleted directly (admin, script) | PR 044 | Added `pre_save`/`post_save` signals in `offices/signals.py`; `True→False` transition on `is_active` triggers `cancel_active_bookings_for_desk(desk, cancelled_by=None)`; registered in `OfficesConfig.ready()`; 11 signal tests; bulk queryset update limitation documented |

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

*Last updated: 2026-06-21 — PR 063 safe Enhance plan / preview / best-effort apply / undo. Replaced the unsafe auto-tidy-on-view-toggle with: a pure plan engine (`features/layoutObjects/enhance/computeEnhancePlan`), an explicit admin Tidy action with a preview dialog, a tracked best-effort backend apply (`EnhanceRun`/`EnhanceRunOperation`, migration 0010) with per-operation `applied|failed|skipped` results, idempotency on `plan_id`, undo (applied-only) and retry (failed-only) as linked runs. The isometric view toggle is now view-only. Opened TD-049 (preview/undo limitations). Backend offices suite 454 green; ruff/format/`manage.py check`/`makemigrations --check` clean. Frontend: `tsc -b`, lint, format clean; new engine/adapter/hook/dialog/toolbar tests green. See `docs/063-safe-enhance-plan-preview-undo.md`.*

*Previously: 2026-06-03 — PR 057 Google onboarding / no-workspace / canvas smoothness fixes. Fixed 5 browser-QA issues (Google name + avatar prefill, profile-completion transition overlay, no-workspace route guard, canvas add/delete jerk) — all frontend (the backend already stored the Google name and downloaded the avatar). Opened TD-046 (deferred bookable/publish UX). Frontend suite 1173 green; tsc/lint/format/build clean; `npm audit` 0 high. No backend changes. See `docs/057-google-onboarding-no-workspace-canvas-smoothness.md`.*

*Previously: 2026-06-02 — PR 056 final MVP browser QA + codebase safety review. Resolved TD-044 (booking-hook TTL caching + book/cancel invalidation across `useDeskBookings`/`useMyBookings`) and TD-045 (per-office/selected-org UI role gate on Floor Layout / Office Detail, backed by `organization` on the office/floor serializers). Full codebase security/privacy/tenant-isolation/architecture review found no new debt — the register is now empty of open items. Full backend (765) and frontend (1162) suites green; lint/format/tsc/build clean; `npm audit` 0 high; no migration drift; `seed_demo_workspace` verified. See `docs/056-final-mvp-browser-qa-codebase-safety.md`.*
