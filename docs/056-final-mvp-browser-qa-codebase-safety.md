# PR 056 — Final MVP Browser QA, Codebase Safety Review, and Demo Fixes

**Branch:** `feature/056-final-mvp-browser-qa-codebase-safety`
**Title:** chore(mvp): run final browser QA and codebase safety review

---

## 1. Purpose

Close the loop before the MVP demo by:

1. Fixing the two remaining PR 055 follow-up items — **TD-044** (booking hooks uncached) and **TD-045** (per-office UI role gate on Floor Layout / Office Detail).
2. Running a full codebase safety/security/privacy/tenant-isolation/architecture/quality review.
3. Producing a deep final MVP readiness report.

No new product features were added. This PR fixes final readiness gaps, verifies the codebase, and documents the final state.

**Verdict: MVP READY.** (See §15.)

---

## 2. What Was Reviewed

- **Docs/debt:** `README.md`, `docs/TECHNICAL_DEBT.md`, `docs/050`, `docs/052`–`docs/055`.
- **Backend:** `config/settings.py`, `accounts` (auth/profile/invitations/throttling/emails), `offices` (models, views, serializers, permissions, services, signals), seed command.
- **Frontend:** AppRouter/AppLayout/AppShell, auth/profile, dashboard, offices/floors, floor layout/canvas/desks, bookings, my bookings, people/invitations, selected-organization provider/switcher, request cache, API clients/hooks, shared components, i18n.

All findings below are based on reading actual code, not assumptions.

---

## 3. TD-044 — Booking Hook Caching

**Problem:** PR 055 added the TTL request cache to offices/floors/desks/layout-objects/summary but intentionally left the booking hooks uncached because date/status keying and book/cancel invalidation are more delicate.

**Fix:** Added safe in-memory TTL caching (same 30s default as `requestCache`) to both booking hooks, with broad-but-safe invalidation so no stale availability survives a book/cancel.

### `useDeskBookings(officeId, floorId, date)`
- Cache key `deskBookings:<officeId>:<floorId>:<date>`. Office+floor ids are globally unique, so the key is org-safe without an org segment (same reasoning the existing `useDesks`/`useFloors` keys use).
- Synchronous cache-hit (no loading flicker), mirroring `useDesks`.
- `refresh()` sets a `forceRef` flag that bypasses the cache for exactly one fetch.
- **AbortController stale-drop preserved.**
- **Missing scope never cached:** when `officeId`/`floorId`/`date` is falsy the hook renders an empty list but does **not** write a cache entry (so it can't mask a real result for a valid scope later).
- Only successful responses are cached.

### `useMyBookings(params?)`
- Cache key `myBookings:<status>:<from>:<to>`. My-bookings span all of the user's active orgs (the backend scopes to `request.user`), so only the query filters need to be in the key — no cross-org bleed.
- Same synchronous cache-hit, `refresh()` force-bypass, and stale-drop behaviour.

### Invalidation (`bookingApi.invalidateBookingCaches()`)
Clears the whole `deskBookings:` and `myBookings:` namespaces. Called after:
- `createDeskBooking`, `cancelDeskBooking`, `cancelMyBooking` (only on success — a rejected mutation leaves the cache intact).
- `updateDesk` and `deleteDesk` in `deskApi` — a desk status change or deactivation changes availability / cancels bookings on the backend, so the booking caches must drop too. (Desk deactivation already cancels active bookings server-side via the PR 044 signal.)

`summary:` is **not** invalidated by bookings — the org-wide summary has no booking counts (offices/floors/desks/members/invitations only), so a booking does not change it.

### Tests (14 new)
- `useDeskBookings.test.ts` (+6): first fetch caches; second mount same office/floor/date serves cache (no refetch, no flicker); different date refetches; different floor refetches; `refresh()` bypasses a fresh entry; missing scope is not cached (no poisoned empty).
- `useMyBookings.test.ts` (+3): caches per param context; different status filter refetches; `refresh()` bypasses.
- `bookingApi.test.ts` (+5): create/cancel-desk/cancel-my each clear both booking namespaces while leaving unrelated keys (e.g. `desks:`) intact; a rejected create does not clear the caches.

---

## 4. TD-045 — Per-Office UI Role Gate on Floor Layout / Office Detail

**Problem:** `OfficeDetailPage` and `FloorLayoutPage` gated admin affordances on `getFirstActiveMembership(user)` — the first active membership — not the membership for the org of the office/floor being viewed. A multi-org user who is admin in org A and member in org B could see admin controls on a B office (backend still enforced the real permission, so it was a UI-affordance gap only).

**Fix — derive the role from the actual office/org (preferred option B/D):**

- **Backend:** `OfficeResponseSerializer` and `FloorResponseSerializer` now expose `organization` (the owning org id). On the floor serializer it is derived from `office.organization_id`; the floor-list queryset adds `select_related("office")` so this does not trigger a per-floor query. This is **not a privacy leak** — the org id is already known to any member of that org (it is in their membership list), and these endpoints already require active membership in the office's org.
- **Frontend:**
  - New helper `getMembershipForOrganization(memberships, organizationId)` returns the caller's active membership for a specific org (or `null`).
  - `OfficeDetailPage` resolves role from `floors[0]?.organization` → `getMembershipForOrganization(...)`, falling back to `selectedMembership` (from `SelectedOrganizationProvider`) before floors load / when the office has no floors yet.
  - `FloorLayoutPage` resolves role from `desks[0]?.organization` (desks already carry their org id and are already loaded — no extra fetch), with the same `selectedMembership` fallback. The role computation moved below the `useDesks` call.
  - Both pages now read membership via `useSelectedOrganization()` instead of `useAuth()` directly, so an org switch updates the gates and single-org behaviour is unchanged (the no-provider fallback equals the first active membership).

**Result:** an admin-in-A / member-in-B user sees member (read-only) affordances on B's office/floor — including via a direct route while A is still the selected org — because the role is resolved from the loaded entity's org. Backend enforcement is unchanged.

### Tests (12 new)
- `membershipUtils.test.ts` (+6): `getMembershipForOrganization` returns the matching membership (not just the first), returns `null` for unknown org / disabled membership / null id.
- `OfficeDetailPage.roleGate.test.tsx` (new, 2): Org A office → "Add floor" shown; Org B office (while first-active membership is Org A admin) → hidden.
- `FloorLayoutPage.roleGate.test.tsx` (new, 2): Org A floor → object library (edit mode) shown; Org B floor → hidden (read-only).
- `FloorLayoutPageIntegration.test.tsx`: updated to mock `useAuth` on the context path now used by `useSelectedOrganization` (behaviour-preserving; 27 existing tests still green).

---

## 5. Codebase Safety Scan — Methodology

- Read the full backend (`config`, `accounts`, `users`, `offices`) and the frontend feature slices listed in §2.
- Targeted grep sweeps for: DRF permission classes, throttle scopes, `get_office_for_user`/`resolve_membership` usage on every nested endpoint, cookie flags, secret handling, identity-masking paths, and cache-key construction.
- A dedicated read-only security pass over settings, auth/session, invitation tokens, tenant isolation, and privacy.
- Verified the two fixes do not weaken isolation (cache keys remain office/floor/user scoped; the new serializer field is an already-known org id).

Severity scale: **Blocker / Important / Minor / Nit.**

---

## 6. Security Findings

| # | Severity | Area | Finding |
|---|----------|------|---------|
| — | — | Settings | **Clean.** `DEBUG` defaults False; `SECRET_KEY` required (raises `ImproperlyConfigured` if missing); `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` default to localhost and require prod env override; `POSTGRES_PASSWORD` default is guarded (raises in prod). DRF `DEFAULT_PERMISSION_CLASSES = IsAuthenticated`. |
| — | — | Auth/session | **Clean.** Refresh token in HttpOnly cookie with `secure=not DEBUG` and configurable `SameSite` (default Lax); logout deletes the cookie with matching `secure`; SimpleJWT rotation + blacklist; access token only in body, refresh only in cookie. No secret/token leakage in responses. |
| — | — | Throttling | **Clean.** Scoped rates on login/signup and `invite_write` (60/h) / `invite_read` (120/h); booking read/write scopes covered. |
| — | — | Invitations | **Clean.** Token only in the manager-scoped serializer; the public `/invite/<token>` detail returns a restricted serializer (status/role/org name/slug/expiry) and never the token; resend refreshes token+expiry and invalidates the old link. |
| N1 | Nit | Backend | `MyBookingsView` filters memberships with a literal `status="active"` rather than the `Membership.Status.ACTIVE` constant used elsewhere. Functionally correct; cosmetic only. Not tracked as debt. |

No Blocker or Important security issues found.

---

## 7. Privacy Findings

- **Booking identity masking — clean.** `DeskBookingResponseSerializer._can_see_identity` reveals identity only to the booking owner or a manager (owner/admin); otherwise `user_name` is `"Reserved"` and `user`/`cancelled_by` are removed from the response. Verified the canvas booking mode passes only status (no identity) to Konva.
- **Member list / invitation tokens — clean.** Tokens are manager-only; member-facing endpoints do not expose them.
- **Deleted user — clean.** `DeskBooking.user` is `SET_NULL`; a null user serializes without PII.
- **Demo seed — clean.** Credentials are printed with an explicit "LOCAL ONLY — never use in production" warning.
- **TD-045 serializer change — no leak.** The added `organization` id is already visible to members via their membership list.

---

## 8. Tenant Isolation / IDOR Findings

- **Clean.** Every nested office/floor/desk/booking/layout-object endpoint resolves the office via `get_office_for_user(user, office_id)`, which returns `(None, None)` → 404 when the office does not exist **or** the user has no active membership in its org (no cross-org existence leak). Floors/desks/bookings are further validated down the FK chain (`get_floor_for_office`, desk→floor→office→org).
- **`?organization=` is validated** via `resolve_membership`/`get_active_membership_for_org` — an explicit org id is honoured only when the user has an active membership there.
- **Body IDs cannot override URL scope.** Booking creation derives `organization`/`office`/`floor` from the URL-resolved office inside a locked transaction (`booking_service.create_booking_for_user`), not from request body fields; `DeskBooking.clean()` asserts FK consistency.
- **`MyBookingsView`** filters by `user` AND the user's active org ids — no cross-org bleed.

---

## 9. Frontend Architecture Findings

- **Request cache keying — clean.** All keys bake in org/office/floor/date/user-scope ids; the new booking keys follow the same rule. Invalidation is hierarchical and namespace-safe (`invalidateCache("deskBookings:")` clears only that namespace). The module-level store is cleared in test teardown.
- **Selected-organization context — clean.** Effective selection is re-derived during render (no stale-selection effect); falls back to the first active membership without a provider.
- **Stale-request handling — preserved** in both booking hooks (AbortController + cancelled flag); `setCachedValue` sits inside the not-cancelled guard so a stale response neither updates state nor poisons the cache.
- **Role-based UX — improved** by TD-045 (per-office resolution).
- **Hook complexity — fine.** Booking hooks gained ~10 lines each, matching the established `useDesks` cache pattern.

---

## 10. Backend Architecture Findings

- **Service layer — consistent.** Booking creation centralised in `booking_service` with `transaction.atomic` + `select_for_update`.
- **Querysets — no obvious N+1.** Booking views `select_related` org/office/floor/desk/user/cancelled_by; the TD-045 floor change added `select_related("office")` to keep the new field query-free.
- **Endpoint/error shape — consistent** (`{"detail": ...}` / field-keyed 400s; 404 for cross-org).
- **Migrations — clean.** `makemigrations --check --dry-run` reports no changes (the TD-045 serializer field is read-only and adds no model field).

---

## 11. Canvas Architecture Findings

- **Editor vs booking mode — separated** (`mode="booking"` only colours by availability; editor mode ignores the availability palette).
- **`useCanvasInteractions` (PR 055) — safe.** Optimistic update + rollback, snap/clamp helpers, keyboard guards (`e.repeat`, concurrent-save) all covered by the 27 integration tests, which remain green after the TD-045 auth-mock update.
- **Read-only member mode — intact**, and now correctly per-office (TD-045).

---

## 12. Testing Quality Findings

- New tests assert real behaviour (call counts for cache hit/miss, namespace clearing with an untouched control key, role-prop values per org) rather than passing vacuously.
- Backend tenant/security/privacy paths remain covered (cross-org 404, masked identity, throttle scopes).
- Full suites: backend **765 passed**, frontend **1162 passed**. One earlier full-frontend run showed 2 flaky failures under heavy parallel import load; two subsequent full runs and a 3× isolated re-run of the new files were all green — no deterministic failure attributable to this PR.

---

## 13. Accessibility Findings

- **Clean for MVP.** Each MVP page exposes a single `h1` (Offices/Floors/Floor Layout fixed in PR 052; Bookings/People/My Bookings already compliant). Booking status uses text labels + colour (not colour-only); the booking flow is fully usable from the list without the canvas. Loading/error states use `role="status"`/`role="alert"`. No regressions introduced — TD-045 only changes which role is computed, not the rendered landmarks.

---

## 14. Documentation / Debt Register Findings

- `docs/056` (this file) added; README documentation index + "Current Status" updated; doc count bumped to 056.
- `TECHNICAL_DEBT.md`: TD-044 and TD-045 moved to **Resolved (PR 056)**; the **Current Open Debt** table is now empty; footer updated.
- No stale/misleading docs found in the 050–055 set during the review.

---

## 15. Manual / Browser QA Results

True interactive browser automation was **not run in this environment**; QA was performed by source inspection, the automated suites, the demo seed, and route/API tests, which together exercise every MVP path:

- **Seed:** `python manage.py seed_demo_workspace` runs clean and idempotently — org "WorkspaceCanvas Demo", office "Demo HQ", 1 floor, 13 layout objects, 5 desks (4 available / 1 maintenance), 3 bookings, 1 pending invite. Credentials printed with a local-only warning.
- **Admin/member flows** (offices → floor builder → desk link → booking → my bookings → people/invite) are covered by the page/integration/API test suites (1162 frontend + 765 backend).
- **Invite flow** (create → email/console → accept with matching email → mismatch rejected → resend/cancel) covered by backend invitation tests + frontend AcceptInvitation/People tests.
- **Multi-org:** switcher + `?organization=` scoping covered by `SelectedOrganizationProvider`, `OrganizationSwitcher`, `test_selected_org.py`, and the new TD-045 role-gate tests (role differs by org → UI reflects the correct per-office role).

> To run a live browser pass: `make seed-demo`, start backend + `npm run dev`, and log in as `admin@workspacecanvas.demo` / `member@workspacecanvas.demo` (`DemoPass123!`).

---

## 16. Tests / Checks — Exact Results

**Backend** (Postgres on `localhost`):
- `ruff check .` → **All checks passed!**
- `ruff format --check .` → **92 files already formatted**
- `python manage.py check` → **0 issues**
- `python manage.py makemigrations --check --dry-run` → **No changes detected**
- `pytest` → **765 passed**, 1 warning

**Frontend:**
- `vitest run` → **1162 passed (86 files)**
- `tsc --noEmit` → **clean**
- `eslint .` → **clean**
- `prettier --check .` → **clean**
- `vite build` → **clean**
- `npm audit --audit-level=high` → **0 vulnerabilities**

---

## 17. Files Changed

**Backend (5):** `offices/serializers.py` (+`organization` on office/floor serializers), `offices/views.py` (floor list `select_related("office")`), `offices/tests/test_office_list.py`, `offices/tests/test_floor_list.py`.

**Frontend — TD-044 (6):** `bookings/api/bookingApi.ts`, `bookings/hooks/useDeskBookings.ts`, `bookings/hooks/useMyBookings.ts`, `desks/api/deskApi.ts`, plus tests `bookings/__tests__/{bookingApi,useDeskBookings,useMyBookings}.test.ts`.

**Frontend — TD-045 (6 + 2 new):** `app/pages/OfficeDetailPage.tsx`, `app/pages/FloorLayoutPage.tsx`, `organizations/utils/membershipUtils.ts`, `floors/types/floor.types.ts`, `offices/types/office.types.ts`, `organizations/__tests__/membershipUtils.test.ts`; **new** `app/__tests__/OfficeDetailPage.roleGate.test.tsx`, `app/__tests__/FloorLayoutPage.roleGate.test.tsx`. Type-fixture updates (`+organization`) in 5 existing test files + the integration-test auth mock.

**Docs (3):** `docs/056-...md` (new), `docs/TECHNICAL_DEBT.md`, `README.md`.

---

## 18. Remaining Issues / Deferred Items

- **None tracked.** The Current Open Debt table is empty. The only observation is the cosmetic `MyBookingsView` "active" literal (N1, §6) — too trivial to register; safe to leave or tidy opportunistically.

---

## 19. Final MVP Readiness Verdict

# **MVP READY**

TD-044 and TD-045 are fixed and tested. The full security/privacy/tenant-isolation/architecture/accessibility review surfaced no Blocker or Important issues and opened no new debt. All backend (765) and frontend (1162) tests pass; lint/format/type/build/audit/migration checks are clean; the demo seed works. The codebase is ready for the MVP demo.
