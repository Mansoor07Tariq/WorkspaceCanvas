# PR 041 — Codebase Hardening and Tech Debt Cleanup

## Purpose

This PR is a dedicated debt-reduction sprint targeting the most impactful open
items logged in `docs/TECHNICAL_DEBT.md` after PR 040. No new product features
are introduced. The changes improve security posture, data integrity, test
coverage, frontend code quality, and project documentation.

---

## Why This PR Exists

After 40 PRs of rapid feature delivery the codebase had accumulated a set of
Known debt items that were intentionally deferred to keep individual PRs focused.
The most important items — DRF defaulting to `AllowAny`, missing cookie security
flags, absent DB uniqueness constraints, zero coverage on the booking detail view,
and a deeply stale README — warranted a dedicated cleanup PR rather than being
patched ad-hoc across unrelated feature branches.

---

## Security Guardrails

### DRF Default Permission Class (TD-002)

`DEFAULT_PERMISSION_CLASSES` was not set in `REST_FRAMEWORK` settings. DRF's own
default is `AllowAny`, meaning any future view that omits an explicit
`permission_classes` declaration is silently public.

**Fix:** Set `"DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"]`
in `REST_FRAMEWORK` settings. All existing views already carry explicit
`permission_classes` so this is a zero-change net for current endpoints — it only
guards future additions.

### Auth Cookie SameSite Env Override (TD-001)

`AUTH_COOKIE_SAMESITE` was hardcoded to `"Lax"` in settings. In cross-origin
deployments where the API and frontend live on separate top-level domains, `Lax`
silently blocks cookie delivery on cross-origin requests, making
`CORS_ALLOW_CREDENTIALS` ineffective.

**Fix:** Settings now reads the env var `AUTH_COOKIE_SAMESITE` at startup:

```python
AUTH_COOKIE_SAMESITE: str = os.environ.get("AUTH_COOKIE_SAMESITE", "Lax")
```

The default `"Lax"` is unchanged for local development. Set `AUTH_COOKIE_SAMESITE=None` in production for cross-origin deployments.

### Cookie Deletion Secure Flag (TD-007)

`delete_cookie()` in `auth_cookies.py` did not pass a `secure=` flag. Browsers
can silently ignore deletion requests if the original cookie was `Secure` but
the deletion is not.

**Fix:** `delete_cookie()` now passes `secure=settings.AUTH_COOKIE_SECURE`.

### Cookie Max Age Derivation (TD-008)

`AUTH_COOKIE_MAX_AGE` and `SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]` were separate
integer literals. A change to one would not update the other.

**Fix:** `AUTH_COOKIE_MAX_AGE` is now derived:

```python
AUTH_COOKIE_MAX_AGE = int(SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
```

---

## Data Integrity

### Desk.code DB-Level Uniqueness (TD-004)

Desk code uniqueness per office was enforced only at the application layer. Two
concurrent creation requests with the same code and office could both pass the
application check before either committed.

**Fix:** Added a partial unique constraint and generated the migration:

```python
UniqueConstraint(
    fields=["office", "code"],
    condition=Q(is_active=True),
    name="unique_active_desk_code_per_office",
)
```

Only active desks are constrained; a deactivated desk's code can be reused.

---

## Backend Test Coverage

### DeskBookingDetailView Tests (TD-012)

`DeskBookingDetailView` (GET `/bookings/:id/`) had zero test coverage.

**Added:** `test_desk_booking_detail.py` covering:
- Happy path — authenticated member retrieves own booking
- Unauthenticated request returns 401
- Booking on wrong floor returns 404
- Cross-org booking returns 404
- Admin retrieves another user's booking with full identity
- Member retrieves another user's booking with masked identity
- Cancelled booking is not returned from active-only queryset

### Admin/Owner Identity Visibility Tests (TD-013)

The `_can_see_identity` path for org admins was never exercised in tests.

**Added (initial pass):** Test asserting status_code 200 for admin booking list path.

**Strengthened (final cleanup):** Added `test_admin_sees_full_identity_for_others`
which asserts `user_name != "Reserved"` and `user == member_user.id` in the
admin booking list response body. Full field-level assertion is now complete.

### cancelled_by Privacy Tests (TD-014)

The `to_representation` logic that strips `cancelled_by` for unprivileged viewers
was never verified in any test.

**Added (initial pass):** Test asserting a regular member receives `null` for
`cancelled_by` in a booking list response.

**Strengthened (final cleanup):** Added `test_member_cannot_see_cancelled_by_for_others`
which sets `cancelled_by` via ORM `.update()` while keeping status ACTIVE, then
asserts a regular member receives `null` for `cancelled_by` in the list response.
Absence of the field value is now explicitly verified.

---

## Frontend Cleanup

### Refetch Tick Standardization (TD-017)

Three feature hooks used `useState<number>` as a tick counter to trigger
re-fetches; `useFloors` used `useReducer` for its tick. The inconsistency made
the pattern harder to reason about.

**Fix:** `useFloors` tick counter changed from `useReducer((n) => n + 1, 0)` to
`useState(0)` with `setTick((n) => n + 1)`. `useOffices` was verified consistent.
No behavioral change; the main state `useReducer` in both hooks is unchanged.

### GuestOnlyRoute for Public Auth Pages (TD-023)

`VerifyEmailPage` and `MfaChallengePage` had no guard preventing an already-
authenticated user from navigating to them directly. Authenticated users would
see the verification form instead of being redirected.

**Fix:** Added `GuestOnlyRoute` component (`frontend/src/app/router/GuestOnlyRoute.tsx`)
— the inverse of `ProtectedRoute`. While loading, it shows a spinner; when
authenticated, it redirects to `/app`; when unauthenticated, it renders children.
`AppRouter` now wraps `LoginPage`, `SignupPage`, `VerifyEmailPage`, and
`MfaChallengePage` with `GuestOnlyRoute`. Five tests added in
`__tests__/GuestOnlyRoute.test.tsx` covering all three auth states.

---

## CI and DevEx Updates

### Migration Check in CI and Makefile

CI did not run `python manage.py makemigrations --check`. A developer adding
model changes without generating a migration would pass CI — the `migrate` step
would silently be a no-op.

**Fix — CI (`ci.yml`):** Added step between `migrate` and `check`:

```yaml
- run: python manage.py makemigrations --check --dry-run
```

The `--dry-run` flag ensures no files are written; `--check` exits non-zero if
any migration is needed.

**Fix — Makefile:** Added `migration-check` target:

```makefile
migration-check:
	cd backend && $(CURDIR)/$(PYTHON) manage.py makemigrations --check --dry-run
```

The `ci` target now runs `migration-check` between `backend-format-check` and
`backend-check`:

```makefile
ci: backend-lint backend-format-check migration-check backend-check backend-test \
    frontend-lint frontend-format-check frontend-test frontend-build
```

---

## Documentation Updates

### docs/040 Corrections (TD-024, TD-025)

Two factual errors were corrected in
`docs/040-desk-booking-model-and-api-foundation.md`:

- **TD-024:** The `desk` FK `on_delete` was listed as `CASCADE`; the code uses
  `PROTECT`. Corrected in the field table and on_delete summary table.
- **TD-025:** The model ordering was listed as `["-booking_date", "-created_at"]`
  (both descending); the code has `["-booking_date", "created_at"]` (ascending
  `created_at`). Corrected.

### generate_slug Docstrings (TD-029)

`Office.generate_slug` and `Floor.generate_slug` lacked any warning that the
method proposes a candidate slug without guaranteeing uniqueness. A caller not
aware of this could incorrectly trust the return value.

**Fix:** Added docstring to both methods:

> Returns a candidate slug. Uniqueness is not guaranteed; callers must handle
> `IntegrityError` or re-call this method in a retry loop.

### README Overhaul (TD-026, TD-027, TD-028)

The README was significantly stale:

- **TD-026:** "Current Status / Upcoming work" listed profile completion, org
  setup, office map editor, and desk booking as upcoming — all are complete.
  Rewrote both sections to reflect actual state as of PR 040.
- **TD-027:** Documentation table ended at doc 026; 14 shipped docs (027–040)
  were invisible. Added all missing entries including TECHNICAL_DEBT.md.
- **TD-028:** "Project Structure" diagram showed only `docs/001–004` as examples
  and omitted `offices/`, `users/`, and other backend apps. Updated diagram to
  reflect real layout.

Additional README fixes:
- Removed stale "Planned frontend additions" items that are already shipped
  (Konva in particular is in `package.json`).
- Removed stale "Planned backend additions" items that are already implemented
  (JWT auth, DRF APIs).
- Fixed Docker startup instructions: commands are per-service (`backend/` and
  `frontend/`), not from the repo root.
- Removed references to a root-level `docker-compose.yml` which does not exist.

### TECHNICAL_DEBT.md Update

All PR 041 items moved from Open to Resolved with explanatory notes. 10 open
items targeting PR 042–044 remain in the open table (see final cleanup section
below for the additional items resolved after the first review pass).

---

## Tests Added or Updated

| File | What Was Added |
|---|---|
| `backend/offices/tests/test_desk_booking_detail.py` | 8 scenarios for GET `/bookings/:id/`: happy path, auth, cross-org, wrong-floor (404), cancelled booking, admin full-identity, member masked-identity |
| `backend/offices/tests/test_desk_booking_list.py` | `test_admin_sees_full_identity_for_others` (asserts `user_name` and `user` ID); `test_member_cannot_see_cancelled_by_for_others` (asserts `cancelled_by` hidden from regular members) |
| `backend/offices/tests/test_desk_booking_cancel.py` | `test_cancellation_updates_updated_at`; strengthened `test_owner_can_cancel_any_booking` and `test_admin_can_cancel_any_booking` with `refresh_from_db()` and `cancelled_by` assertions |
| `backend/offices/tests/test_desk_code_uniqueness.py` | `test_patch_code_to_existing_code_rejected` covering `DeskDetailView.patch` IntegrityError path |
| `backend/offices/tests/test_desk_deactivation_cancels_bookings.py` | `test_deactivating_desk_cancels_multiple_bookings` covering 3 bookings on 3 different dates |
| `frontend/src/app/__tests__/NotFoundPage.test.tsx` | 4 tests: heading, descriptive message, Back to App button, `role="main"` container |
| `frontend/src/app/__tests__/GuestOnlyRoute.test.tsx` | 5 tests covering loading, authenticated-redirect, and unauthenticated-render states |

Total frontend test count after final cleanup: 773 tests across 54 files, all passing.

---

## CI Checks

| Check | Result |
|---|---|
| Ruff | Pass |
| Django check | Pass |
| Migration check (`--check --dry-run`) | Pass |
| pytest | Pass |
| vitest | Pass |
| TypeScript | Pass |
| ESLint | Pass |
| Build | Pass |

---

## Manual Checklist

- [ ] `make migration-check` exits 0 on a clean checkout
- [ ] `make ci` completes without errors end-to-end
- [ ] Unauthenticated request to any booking endpoint returns 401 (not 403)
- [ ] Authenticated user navigating to `/verify-email` is redirected to `/app`
- [ ] Authenticated user navigating to `/mfa/challenge` is redirected to `/app`
- [ ] Authenticated user navigating to a non-existent URL (e.g. `/app/does-not-exist`) sees the 404 page, not the login page
- [ ] Creating two desks with the same code in the same office returns 400
  (application layer) or 409/500 in a race scenario (DB constraint)
- [ ] PATCH an existing desk code to the code of another active desk in the same office returns 400 with a `code` field error
- [ ] Cancelling a booking and refreshing from DB shows `updated_at` changed
- [ ] Logout clears the cookie in the browser (check DevTools Application > Cookies)
- [ ] `make backend-check` passes with no warnings about open views

---

## What This PR Does NOT Include

- Booking calendar UI or map-based booking (TD-016 / PR 044)
- `select_for_update()` in booking creation path (TD-006 / PR 042)
- Signal-based cascade-cancel when desk is saved directly with `is_active=False` outside the API (TD-003, TD-011 / PR 042); the existing `DeskDetailView.delete` view-path cancel is tested but a `post_save` signal is still missing
- `DeskBooking` denormalization referential `clean()` (TD-005 / PR 042)
- Throttle tests for booking endpoints (TD-015 / PR 043)
- Request deduplication in feature hooks (TD-020 / PR 043)
- Route caching / TanStack Query migration (TD-021 / PR 044)
- `FloorLayoutPage` extraction into custom hooks (TD-019 / PR 044)
- `DeskBooking.user` on_delete change to SET_NULL (TD-009 / PR 043)

---

## Pre-merge Cleanup

The following items were added in a pre-merge cleanup pass after the initial PR
branch was cut. They are part of PR 041 but applied after the first round of
review.

### First cleanup pass

| Item | Description |
|------|-------------|
| `GuestOnlyRoute` component and tests | Added `frontend/src/app/router/GuestOnlyRoute.tsx` and `__tests__/GuestOnlyRoute.test.tsx`; wrapped all four public auth pages in `AppRouter` |
| `useFloors` tick counter | Changed from `useReducer` to `useState(0)` to match the pattern in other hooks |
| `useDeskBookings` loading state on invalid input | Invalid-param guard now dispatches `fetch_success` with `[]` so `loading` becomes `false` immediately |
| `cancelled_by` on booking type | Added `cancelled_by?: number | null` to `booking.types.ts` |
| ErrorBoundary test isolation | `window.location` mock in `ErrorBoundary.test.tsx` now saved/restored to prevent test leakage |
| `generate_slug` docstrings | Added concurrency-warning docstrings to `Office.generate_slug` and `Floor.generate_slug` |
| README Celery/Redis wording | Comma changed to em dash in the Celery + Redis planned-feature note |

### Final cleanup pass (backend)

| Item | Description |
|------|-------------|
| `DeskDetailView.patch` IntegrityError catch | Added `try/except IntegrityError` around `desk.save()` in PATCH handler; returns `{"code": [...]}` 400 on `unique_active_desk_code_per_office` violation; test `test_patch_code_to_existing_code_rejected` added |
| Booking cancel `updated_at` in `update_fields` | Added `"updated_at"` to `booking.save(update_fields=[...])` in `DeskBookingCancelView.post` and to the bulk `.update()` in `DeskDetailView.delete`; test `test_cancellation_updates_updated_at` added |
| `select_related("cancelled_by")` | Added to all three booking queryset locations: `DeskBookingListCreateView.get`, `DeskBookingDetailView.get`, `DeskBookingCancelView.post` — prevents N+1 on `cancelled_by` access |
| Wrong-floor booking detail test | Added `test_member_cannot_access_booking_via_wrong_floor` to `test_desk_booking_detail.py`; sibling floor fixture (same office, level 1) confirms 404 |
| Multi-booking deactivation test | Added `test_deactivating_desk_cancels_multiple_bookings`; creates 3 bookings on 3 separate dates, deactivates desk, asserts all 3 cancelled with `cancelled_at` and `cancelled_by` set |
| Admin/owner cancel `cancelled_by` assertion | Strengthened `test_owner_can_cancel_any_booking` and `test_admin_can_cancel_any_booking`; both now assert `cancelled_by` identity on model after cancel |
| Admin identity visibility assertion | Added `test_admin_sees_full_identity_for_others` to `test_desk_booking_list.py`; asserts `user_name != "Reserved"` and `user == member_user.id` |
| `cancelled_by` privacy assertion | Added `test_member_cannot_see_cancelled_by_for_others` to `test_desk_booking_list.py`; sets `cancelled_by` via ORM while keeping status ACTIVE, asserts regular member cannot see it |
| `_can_see_identity` inline comment | Two-line comment in `serializers.py` explaining `not request` fallback is for Django admin shell / admin site |
| `Desk.status` / `Desk.is_active` invariant comment | Two-line inline comment above `status` field in `models.py` explaining relationship and that `is_active=False` is the authoritative soft-delete flag |
| ruff format `test_desk_code_uniqueness.py` | File reformatted; trailing arguments moved to separate lines, whitespace standardized |

### Final cleanup pass (frontend)

| Item | Description |
|------|-------------|
| `OfficesEmptyState` unification (Option A) | Created `components/ui/EmptyState.tsx` shared primitive; both `OfficesEmptyState` wrappers now delegate to it; all existing call sites are unchanged |
| `NotFoundPage` and 404 routing | Created `app/pages/NotFoundPage.tsx` with `role="main"`, 404 heading, message, and "Back to App" button; `AppRouter` catch-all now renders it instead of redirecting to `/login`; 4 tests added |
| Verified nit fixes (no changes needed) | `GuestOnlyRoute` already correct; tick counters already correct; `cancelled_by` type already present; ErrorBoundary isolation already correct; `useDeskBookings` guard already correct |

---

## Remaining Open Debt After This PR

See [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) for the current open register. The
10 remaining items target PR 042–044:

- PR 042: signal-based cascade-cancel on `Desk.is_active=False` outside the API
  (TD-003, TD-011), `DeskBooking` denormalization `clean()` validation (TD-005),
  `select_for_update()` race hardening in booking creation (TD-006)
- PR 043: `DeskBooking.user` CASCADE → SET_NULL (TD-009), throttle tests for
  booking endpoints (TD-015), request deduplication via AbortController in feature
  hooks (TD-020)
- PR 044: booking UI wire-up (TD-016), `FloorLayoutPage` extraction into custom
  hooks (TD-019), route-level caching / TanStack Query migration (TD-021)
