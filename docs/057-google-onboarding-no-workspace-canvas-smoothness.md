# PR 057 — Google Onboarding, No-Workspace Flow, and Canvas Smoothness Fixes

**Branch:** `feature/057-google-onboarding-no-workspace-canvas-smoothness`
**Title:** fix(mvp): polish Google onboarding, no-workspace flow, and canvas smoothness

---

## Purpose

Fix the first batch of real browser-QA issues found while clicking through the MVP
(Google login → profile onboarding → workspace routing → canvas editing). Five
issues (Errors 1–5) are fixed. **All fixes are frontend** — investigation
confirmed the backend already stores the Google name and downloads the Google
avatar, so no backend/API/serializer changes were needed.

> **Explicitly deferred:** the "make a desk bookable / publish desk" UX is **not**
> touched in this PR. It is tracked as **TD-046** and deferred to a later PR.

---

## Browser-QA issues found (and fixed)

| # | Issue | Root cause | Layer |
|---|-------|-----------|-------|
| 1 | Google **Full Name** not prefilled on profile completion | Form seeded once at mount; the Google name (in `user.full_name` / `first_name`+`last_name`) wasn't re-applied if the user object wasn't ready / used only `full_name` | Frontend |
| 2 | Google **avatar** not prefilled | `avatarPreview` was never seeded from the already-downloaded `user.avatar` | Frontend |
| 3 | No transition after completing the profile (abrupt jump) | `setAuthenticatedUser` flipped `is_profile_completed` immediately, so `DashboardPage` swapped from the carousel to the app instantly | Frontend |
| 4 | No-org users could reach Offices/Bookings/My Bookings/People as if a workspace existed | No route guard; only `/app` rendered a no-workspace state | Frontend |
| 5 | Canvas **jerks/reloads** on add/delete | create/delete called `useLayoutObjects.refresh()` → `loading:true` → `FloorLayoutPage`'s `if (loading) return <LoadingState/>` swapped the whole page out, remounting the lazy Konva canvas | Frontend |

---

## Error 1 — Google full-name prefill

`useProfileOnboardingForm` now:
- Seeds the name from a `userDisplayName(user)` helper that prefers `full_name`
  and **falls back to `first_name last_name`** (so a Google account that only
  yields given/family names still prefills).
- Re-seeds **once per user id** via an effect (the form can mount before the user
  is fully loaded after a Google redirect), guarded so it never clobbers a value
  the user has typed.

## Error 2 — Google avatar prefill

The same seeding step sets `avatarPreview` from `user.avatar` (the Google picture
the backend already downloaded to `users/avatars/…`) **when the user has not
picked a local file**. `StepAvatar` already renders `avatarPreview` via the MUI
`Avatar`, so the photo now shows during onboarding (previously only `StepDone`
showed it). A manually uploaded file still takes precedence and the existing
upload/remove flow is unchanged.

## Error 3 — Full-screen completion transition

New `components/feedback/FullScreenTransition.tsx` — a MUI `Backdrop` overlay with
a centered spinner and message, exposing `role="status"` + `aria-label`.

`useProfileOnboardingForm.handleFinish` now, on success, sets `completing = true`
and **delays `setAuthenticatedUser` by `PROFILE_COMPLETION_TRANSITION_MS` (2200 ms)**
via a cleared-on-unmount timer. The carousel renders the overlay
("Setting up your workspace…") while `completing`. Only after the delay is the
auth user flipped, at which point `DashboardPage` swaps to the dashboard (or the
no-workspace state). This makes the hand-off feel intentional and gives the
freshly-updated user/memberships time to settle. On API failure no transition is
entered and the error alert is shown.

## Error 4 — No-workspace flow

New `routes/WorkspaceRequiredRoute.tsx` — a layout guard that reads
`useSelectedOrganization().selectedMembership`; with **no active membership** it
`<Navigate to="/app" replace />`, otherwise renders the nested `<Outlet />`.

`AppRouter` wraps the workspace-dependent routes in it:
`OfficeDetail`, `FloorLayout`, `Bookings`, `My Bookings`, `People`.

Intentionally **not** guarded:
- `/app` (DashboardPage) — already renders the "No workspace yet" state (title +
  message with invite guidance + **Create Workspace** CTA).
- `/app/offices` (AppOfficesPage) — hosts the **organization-creation flow** when
  the user has no org; this is how a user gets a workspace, so guarding it would
  trap them in a redirect loop.
- `/app/mfa/setup`.

So a profile-complete user with no org can only reach the dashboard
(no-workspace state) and Offices (create-workspace flow); every other workspace
page redirects to `/app`. Backend permissions are enforced independently.

## Error 5 — Canvas add/delete smoothness

Root cause: create/delete called `useLayoutObjects.refresh()`, which dispatched
`fetch_start` (`loading:true`); `FloorLayoutPage` then hit `if (loading) return
<LoadingState/>`, unmounting the whole 3-panel layout and the lazy `FloorMapCanvas`
(whose `Suspense` fallback flashed on remount) — the visible "jerk".

Fixes:
- `useLayoutObjects` gained `addObjectLocally(obj)` / `removeObjectLocally(id)`
  (pure `add_object` / `remove_object` reducer actions; add is idempotent).
- `FloorLayoutPage` now applies create/delete to **local state** instead of
  `refresh()`:
  - create → `addObjectLocally(created)` + select it,
  - delete → `removeObjectLocally(id)` + clear selection if it was selected.
  The API layer still `invalidateCache(...)`s the layout-objects + summary keys,
  so a later navigation revalidates from the server.
- `LayoutObjectList.onDeleted` is now `(id) => void` so the page knows which
  object to drop.
- Defense-in-depth: the page's loader is now `if (loading && objects.length === 0)`
  so any future background revalidation keeps the canvas mounted.

The create form was already a button (`onClick`), not a `<form>` submit, so there
was never a real browser navigation/reload — only the loading-state swap.

---

## Tests

New (12):
- `features/profile/__tests__/useProfileOnboardingForm.test.ts` (7): seeds name +
  avatar from the user; seeds when the user loads after mount; blank when no name;
  doesn't overwrite a typed value; uploaded file beats the remote avatar;
  `completing` turns on and `setAuthenticatedUser` is delayed then called; no
  transition on API failure.
- `routes/__tests__/WorkspaceRequiredRoute.test.tsx` (2): renders the page with a
  membership; redirects to `/app` without one.
- `features/layoutObjects/__tests__/useLayoutObjects.optimistic.test.ts` (3):
  add appends without flipping `loading`/refetching; add is idempotent; remove
  drops without flipping `loading`/refetching.

Updated:
- `features/profile/__tests__/ProfileOnboardingCarousel.test.tsx`: the post-finish
  "done screen" assertions became "transition overlay" assertions (role=status +
  message), and the `setAuthenticatedUser` assertion now waits past the delay.

## Tests / checks — exact results

- `vitest run` → **1173 passed (89 files)**
- `tsc --noEmit` → clean
- `eslint .` → clean
- `prettier --check .` → clean
- `vite build` → clean
- `npm audit --audit-level=high` → **0 vulnerabilities**
- Backend: **untouched** (no Django/Ruff/migration runs needed).

---

## Manual QA checklist

**Google onboarding**
1. Log in with Google → land on profile onboarding.
2. Full Name is prefilled from the Google account (or first+last). ✅
3. Avatar step shows the Google picture (not just initials). ✅
4. Uploading a photo manually still overrides it. ✅
5. Click Complete profile → full-screen "Setting up your workspace…" overlay for ~2.2 s. ✅
6. Then land on the dashboard (or No-workspace state). ✅

**No-workspace**
1. Profile-complete user with no org opens `/app` → "No workspace yet" + Create Workspace. ✅
2. `/app/bookings`, `/app/bookings/my`, `/app/people`, an office-detail or floor-layout URL → redirect to `/app`. ✅
3. `/app/offices` → organization-creation flow (intentionally reachable to create a workspace). ✅

**Canvas**
1. Admin opens a floor layout.
2. Add an object → it appears, canvas stays mounted, no page flash. ✅
3. Delete an object → it disappears, canvas stays mounted, no page flash. ✅

> Live browser automation was not run in this environment; verification is by the
> automated suite + source inspection. Use the demo seed + `npm run dev` to click
> through manually (see `docs/050`).

---

## What this PR does NOT include

- **Bookable-desk / publish UX** — deferred (TD-046).
- Floor publish/draft state, new Desk publish fields, "make desk bookable" workflow, bookable-desk copy.
- Booking rules, meeting rooms, analytics, or any new product feature.

---

## Files changed

**Frontend (source):** `features/profile/hooks/useProfileOnboardingForm.ts`,
`features/profile/components/ProfileOnboardingCarousel.tsx`,
`components/feedback/FullScreenTransition.tsx` (new),
`routes/WorkspaceRequiredRoute.tsx` (new), `app/router/AppRouter.tsx`,
`features/layoutObjects/hooks/useLayoutObjects.ts`, `app/pages/FloorLayoutPage.tsx`,
`features/layoutObjects/components/LayoutObjectList.tsx`, `i18n/en.ts`.

**Frontend (tests):** `features/profile/__tests__/useProfileOnboardingForm.test.ts` (new),
`routes/__tests__/WorkspaceRequiredRoute.test.tsx` (new),
`features/layoutObjects/__tests__/useLayoutObjects.optimistic.test.ts` (new),
`features/profile/__tests__/ProfileOnboardingCarousel.test.tsx` (updated).

**Docs:** `docs/057-…md` (new), `docs/TECHNICAL_DEBT.md` (TD-046), `README.md`.

---

## Final verdict

# **READY TO MERGE**

All five browser-QA issues are fixed with targeted, frontend-only changes and new
tests; the full suite (1173) and every check are green; no backend changes; the
only opened debt is the intentionally-deferred bookable/publish UX (TD-046).
