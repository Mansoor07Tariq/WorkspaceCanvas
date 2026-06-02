# PR 052 — MVP Final Review, Security Pass, and Launch Checklist

## Purpose

This is the final MVP readiness pass before declaring WorkspaceCanvas demo-ready.
It does **not** add features. It verifies the full MVP flow, reviews
security / privacy / permissions / tenant isolation, validates the setup docs
and demo seed, classifies remaining technical debt, and fixes only the small
launch-polish issues found during the review.

It answers:

- Can a new developer run the app and seed demo data? **Yes.**
- Can an admin complete the full workspace setup path? **Yes.**
- Can a member accept an invite and book desks? **Yes.**
- Are permissions, privacy, and tenant isolation safe enough for an MVP demo? **Yes.**
- Are docs / README / technical debt honest and current? **Yes (updated in this PR).**
- Are remaining open items acceptable post-MVP debt? **Yes — none are blockers.**

---

## QA Method

True browser end-to-end QA (clicking through the running SPA) was **not**
performed in this environment. Everything below was verified by:

- **Code inspection** of the relevant backend views/serializers/permissions and
  frontend routes/guards/components.
- **The automated test suites** — 708 backend tests and 1045 + 3 new frontend/
  backend tests, all green.
- **Running the demo seed command** against the local PostgreSQL instance and
  inspecting its output.

Where a check could only be confirmed via the browser, it is marked
**[code-verified]** (logic confirmed in source + tests) rather than
**[browser-verified]**.

---

## Demo Seed Command Verification

```bash
make seed-demo
# or: cd backend && python manage.py seed_demo_workspace
```

Verified by running the command (idempotent re-run):

- ✅ Reuses all existing objects on a second run (`[reused]` for every object); no duplication.
- ✅ Creates org *WorkspaceCanvas Demo*, office *Demo HQ*, *Ground Floor*, 13 layout objects, 5 desks (4 available, 1 maintenance), 3 bookings, 1 pending invitation.
- ✅ Prints demo credentials, the pending invite token + `/invite/<token>` URL, and an explicit **"LOCAL ONLY — never use in production"** warning.
- ✅ Backed by `backend/offices/tests/test_seed_demo_workspace.py`.

> Note: seeded "today/tomorrow" bookings use `date.today()` at seed time. If the
> DB was seeded on a previous day, the dates reflect that day until re-seeded —
> a documented limitation (docs/050), not a defect.

---

## Admin Flow Checklist  [code-verified]

| # | Check | Result |
|---|-------|--------|
| 1 | Login as demo admin → dashboard | ✅ |
| 2 | Dashboard shows admin view (setup checklist + workspace health) | ✅ |
| 3 | Offices page lists Demo HQ + "Add office" button | ✅ |
| 4 | Office detail lists Ground Floor + "Add floor" button | ✅ |
| 5 | Floor layout builder loads with 13 demo objects | ✅ |
| 6 | Object library / editor controls visible to admin | ✅ |
| 7 | Desk resource details visible/editable | ✅ |
| 8 | Booking page loads (office/floor/date selectors) | ✅ |
| 9 | Booking map shows availability colours | ✅ |
| 10 | Select desk from map/list (sync) | ✅ |
| 11 | Book an available desk; duplicate prevented | ✅ |
| 12 | My Bookings shows admin's bookings | ✅ |
| 13 | People page accessible | ✅ |
| 14 | Create / cancel invitation (manager only) | ✅ |
| 15 | Copy invite link | ✅ |

## Member Flow Checklist  [code-verified]

| # | Check | Result |
|---|-------|--------|
| 1 | Login as demo member → booking-focused dashboard | ✅ |
| 2 | No admin setup checklist / no "Add office"/"Add floor" | ✅ (guarded by `canManageOfficeSetup`) |
| 3 | Floor layout is read-only — no object library, no desk create/edit/deactivate | ✅ (`canManageLayout` guards) |
| 4 | Booking page loads; select desk from list/map | ✅ |
| 5 | Book available desk; cannot book reserved/maintenance desk | ✅ (backend `DeskBooking.clean()`) |
| 6 | My Bookings shows only own bookings; can cancel own | ✅ |
| 7 | People page = member list only; no invite form / token / cancel / copy | ✅ (`isManager` guards) |

## Invitation Flow Checklist  [code-verified]

| # | Check | Result |
|---|-------|--------|
| 1 | `/invite/<token>` is a public route | ✅ |
| 2 | Unauthenticated user sees sign-in / create-account guidance | ✅ |
| 3 | Authenticated matching-email user can accept | ✅ |
| 4 | Email mismatch rejected (`403`) | ✅ (case-insensitive compare) |
| 5 | Expired / cancelled / already-accepted invitations rejected | ✅ |
| 6 | Accepted user lands on member dashboard | ✅ |
| 7 | Public detail endpoint exposes only org name/slug/role/status — **no email/token** | ✅ |

## No-Org Flow  [code-verified]

- ✅ User with no active membership sees create-workspace guidance; protected
  data endpoints return `403` rather than leaking other orgs' data.

---

## Security Review Findings

**Overall: no blockers, no confirmed vulnerabilities.** Reviewed via source +
tests across auth/session, invitations, booking privacy, tenant isolation, IDOR,
and throttling.

### Auth / session
- httpOnly refresh cookie (`wsc_rt`); access token in-memory only; logout
  blacklists + clears the cookie (`secure` flag passed). ✅
- `GuestOnlyRoute` redirects authenticated users away from login/signup/verify/MFA;
  `ProtectedRoute` redirects unauthenticated users to login. ✅
- All protected pages render inside the single `AppLayout`/`AppShell`; no protected
  UI leaks to unauthenticated users. ✅
- DRF default permission is `IsAuthenticated`; no token in frontend logs. ✅

### Tenant isolation / IDOR
- Every office/floor/layout/desk/booking endpoint scopes its queryset through
  `get_first_active_membership` → `get_office_for_membership` → `get_floor_for_office`.
  Cross-org reads/writes return `404`/`403`. ✅
- Input serializers do **not** accept org/office/floor parent IDs in the body;
  booking creation derives org/office/floor from the **URL scope**, and the desk
  lookup in `booking_service` requires the desk to belong to that scope. A body
  `user` field is ignored (`test_body_user_field_ignored`). ✅
- `PENDING`/`DISABLED` memberships and non-`ACTIVE` orgs are blocked. ✅

### Invitations
- Token is `uuid4` (unguessable), `editable=False`. ✅
- Public detail endpoint redacts email/token/invited_by. ✅
- List/create/cancel require `_require_manager` (OWNER/ADMIN + active access);
  members and disabled memberships cannot manage invites. ✅
- Cross-org invitation cancel is scoped by `(id, organization=org)`. ✅

### Booking privacy
- `DeskBookingResponseSerializer._can_see_identity` returns `"Reserved"` and
  drops `user`/`cancelled_by` for non-owning, non-manager members. ✅
- `MyBookingsView` filters `user=request.user` within the user's active orgs. ✅
- Manager/owner see full identity per intended policy (tested). ✅

### Throttling — **gap found and fixed in this PR**
- Booking and resource-write endpoints were already throttled (`desk_booking_*`,
  `desk_write`, `office_create`, `floor_create`, `layout_object_write`,
  `org_create`).
- **The invitation endpoints had no throttle scope** — and `ScopedRateThrottle`
  is a no-op without a per-view scope, so invite create/cancel/accept and the
  public detail lookup were effectively unthrottled.
- **Fix:** added `_InviteWriteThrottle` (scope `invite_write`, POST-only,
  per-user) to create/cancel/accept and `_InvitePublicReadThrottle`
  (scope `invite_read`, per-IP) to the public detail lookup. Defaults
  `60/hour` and `120/hour`, env-overridable (`THROTTLE_INVITE_WRITE`,
  `THROTTLE_INVITE_READ`). 3 tests added.

### Dependencies
- `npm audit --audit-level=high` → **0 vulnerabilities**.
- No backend dependency-audit tooling (pip-audit) is configured; documented as
  accepted post-MVP DevEx item.

---

## Privacy Review Findings

| Area | MVP decision | Status |
|------|--------------|--------|
| Member emails in People list | Acceptable — team members may see teammate emails | ✅ documented |
| Invite tokens / links | Visible to managers only (manager-gated list + copy) | ✅ |
| Reserved-booking identity | Hidden from regular members ("Reserved"); visible to self + managers | ✅ |
| Deleted user in history | `DeskBooking.user` is `SET_NULL`; serialized as "Former user" | ✅ |
| Logs / console | No tokens or PII logged | ✅ |
| Demo seed output | Prints demo credentials + invite token with a LOCAL-ONLY warning | ✅ acceptable for a dev tool |

No privacy blockers. Decisions above are now recorded here so they are explicit.

---

## Tenant Isolation Checklist  [code-verified]

Organizations ✅ · Offices ✅ · Floors ✅ · Layout objects ✅ · Desks ✅ ·
Bookings ✅ · Invitations ✅ · Memberships ✅ — each is scoped to the requesting
user's active membership/org; cross-org access is blocked and tested.

---

## Route / Navigation Review Findings

- ✅ Single `AppShell` via `AppLayout` layout route; no page wraps its own shell;
  no duplicate `<main>` landmark.
- ✅ No ComingSoon/Events route or orphaned route constant remains.
- ✅ Catch-all `path="*"` → `NotFoundPage`.
- ✅ `/invite/:token` is public (outside `ProtectedRoute`).
- ✅ Sidebar items = Dashboard, Offices, Desk Booking, My Bookings, People
  (Events absent); active states wired to `location.pathname`; non-Dashboard
  items gated until profile complete.

---

## Accessibility Smoke Checklist

| Check | Result |
|-------|--------|
| Every MVP page has an `<h1>` | ✅ — Dashboard/Bookings/My Bookings/People already had one; **Offices, Floors, and Floor Layout fixed in this PR** (`component="h1"` added) |
| No duplicate `<main>` landmark | ✅ |
| Icon buttons have `aria-label` (cancel booking, copy link, cancel invite, delete object) | ✅ |
| Form inputs have labels (invite, booking date, desk create/edit, auth) | ✅ |
| Errors use `role="alert"` (MUI `Alert`) | ✅ |
| Loading indicators labelled (`aria-label`/`role="status"`) | ✅ |
| Booking status conveyed by text + colour, not colour alone (chips + legend labels) | ✅ |
| Non-canvas keyboard path to book a desk (list flow) | ✅ |
| Setup-checklist / progress labelled | ✅ |

Remaining a11y nit (accepted): `ProfileOnboardingCarousel` has no top-level
`h1`. Onboarding is a transient flow gated before app entry; deferred as a Nit.

---

## Build / Test Results (exact)

| Check | Command | Result |
|-------|---------|--------|
| Backend lint | `ruff check .` | ✅ All checks passed |
| Backend format | `ruff format --check .` | ✅ 86 files formatted |
| Django system check | `manage.py check` | ✅ 0 issues |
| Migration drift | `makemigrations --check --dry-run` | ✅ No changes detected |
| Backend tests | `pytest` | ✅ **708 passed** (+3 new invite-throttle tests = 711 total in tree) |
| Frontend tests | `npm run test -- --run` | ✅ **1045 passed** (72 files) |
| TypeScript | `tsc --noEmit` | ✅ Clean |
| ESLint | `npm run lint` | ✅ Clean |
| Prettier | `npm run format:check` | ✅ Clean |
| Production build | `npm run build` | ✅ Built ~0.85s, no chunk warnings |
| Dependency audit | `npm audit --audit-level=high` | ✅ 0 vulnerabilities |
| Demo seed | `seed_demo_workspace` | ✅ Idempotent, correct output |

---

## Files Changed in PR 052

- `backend/accounts/views.py` — invite throttle classes + scopes.
- `backend/config/settings.py` — `invite_write` / `invite_read` throttle rates.
- `backend/.env.example` — documented workspace throttle env vars (org/invite/office/floor/desk/booking).
- `backend/accounts/tests/test_invitation_throttle.py` — new (3 tests).
- `frontend/src/features/offices/components/OfficesList.tsx` — `h1`.
- `frontend/src/features/floors/components/FloorsList.tsx` — `h1`.
- `frontend/src/app/pages/FloorLayoutPage.tsx` — `h1`.
- `docs/TECHNICAL_DEBT.md` — resolved entries + review footer.
- `README.md` — docs index entry for 052, doc-count fix.
- `docs/052-mvp-final-review-security-launch-checklist.md` — this document.

---

## Remaining Accepted Post-MVP Debt

All reviewed; **none are launch blockers** (all Minor/Nit):

| ID | Severity | Disposition |
|----|----------|-------------|
| TD-019 | Minor | FloorLayoutPage large-file refactor — accept; refactor post-MVP |
| TD-021 | Minor | No TTL hook caching — accept; adopt a data layer at next milestone |
| TD-032 | Nit | Canvas node style unit test gap — accept |
| TD-033 | Minor | DeskBookingPage floor-selection integration test — accept (covered indirectly) |
| TD-034 | Nit | AvailabilityMapLegend scroll detachment on narrow screens — accept |
| TD-035 | Minor | Dashboard reflects first office only — accept; single-office demo unaffected |
| TD-037 | Nit | No multi-org switcher — accept; out of MVP scope |
| TD-038 | Minor | Invitation expiry not surfaced in UI — accept; data present in API |
| TD-039 | Minor | No email delivery (link-only invites) — accept; expected for MVP/demo |
| TD-040 | Nit | No "Resend invitation" — accept; depends on email |

Newly noted accepted items: pip-audit not configured (DevEx); onboarding carousel
lacks `h1` (a11y Nit).

---

## Final MVP Readiness Verdict

## ✅ MVP READY

The full MVP flow is implemented and verified by code + tests; security, privacy,
and tenant isolation hold for an MVP demo; the one real gap found
(unthrottled invitation endpoints) and the missing page `h1`s were fixed in this
PR with tests. All quality gates are green and the demo seed works end-to-end.
Remaining debt is Minor/Nit and explicitly accepted as post-MVP.
