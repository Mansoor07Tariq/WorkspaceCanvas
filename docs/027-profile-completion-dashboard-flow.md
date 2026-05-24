# 027 — Profile Completion Dashboard Flow

## Purpose

After signing in, an authenticated user with an incomplete profile cannot meaningfully use the application. This PR adds the mandatory profile setup step that gates access to all product navigation.

A user who has not set a `full_name` sees a profile setup card in the main content area. The sidebar is visible but all product navigation items (Offices, Desk Booking, Events, People) are locked with a tooltip. Once the profile is saved, the context updates in-place and the sidebar unlocks without a page reload.

---

## What Was Added

### Backend
- `PATCH /api/auth/me/` endpoint on the existing `CurrentUserView`
- `ProfileUpdateSerializer` — validates and saves profile fields
- `is_profile_completed` is recalculated on every save
- Phone number format validation
- Timezone validation against Python's `zoneinfo.available_timezones()`
- Locale validation against a supported set (`en`, `en-IE`, `en-GB`, `en-US`)
- `auth_profile` throttle scope applied only to `PATCH` (not `GET`)

### Frontend
- `ProfileSetupCard` — form shown when `is_profile_completed === false`
- `useProfileSetupForm` hook — owns all form state and submit logic
- `AppSidebar` — navigation component with locked/unlocked state
- `AppShell` updated to include the sidebar
- Placeholder pages for `/app/offices`, `/app/bookings`, `/app/events`, `/app/people`
- `ComingSoonPage` shared component for placeholder routes
- `features/profile/index.ts` barrel export

---

## User Flow

```
Login → /app
  ├── is_profile_completed === false
  │     → AppShell (navbar + sidebar)
  │     → ProfileSetupCard in main content
  │     → Sidebar: Dashboard enabled, all others disabled with tooltip
  │
  └── is_profile_completed === true
        → AppShell (navbar + sidebar)
        → Dashboard placeholder content
        → Sidebar: all items enabled
```

After completing the form:
1. `PATCH /api/auth/me/` is called with `full_name` (required), and optionally `job_title`, `phone_number`
2. Response returns the full `CurrentUserSerializer` payload
3. `setAuthenticatedUser(updatedUser)` updates `AuthContext` in-place
4. React re-renders — `ProfileSetupCard` disappears, dashboard appears, sidebar unlocks
5. No page reload required

---

## Backend Changes

### `users/serializers.py`
- Added `ProfileUpdateSerializer` (ModelSerializer, `partial=True` in view)
- `validate_full_name` — strips whitespace, rejects blank/empty
- `validate_job_title` — strips whitespace
- `validate_phone_number` — strips whitespace; rejects strings with letters or script content via `^[0-9\s+\(\)\-]+$`
- `validate_timezone` — validates against `zoneinfo.available_timezones()`
- `validate_locale` — validates against `{"en", "en-IE", "en-GB", "en-US"}`
- `update()` — uses `save(update_fields=[...])` for consistency with the rest of the codebase

### `users/views.py`
- `CurrentUserView.get()` — unchanged
- `CurrentUserView.patch()` — new; uses `ProfileUpdateSerializer`; returns `CurrentUserSerializer`
- `CurrentUserView.get_throttles()` — overridden to apply `auth_profile` throttle only to `PATCH`

### `config/settings.py`
- Added `"auth_profile"` to `DEFAULT_THROTTLE_RATES` (default: `30/min`, env-driven via `THROTTLE_AUTH_PROFILE`)

### `.env.example`
- Added `THROTTLE_AUTH_PROFILE=30/min`

---

## Frontend Changes

### New files
| File | Purpose |
|---|---|
| `features/profile/api/profileApi.ts` | `updateProfile()` wraps `PATCH /api/auth/me/` |
| `features/profile/hooks/useProfileSetupForm.ts` | Form state, validation, submit logic |
| `features/profile/components/ProfileSetupCard.tsx` | Form UI using `FormTextField`, `LoadingButton`, `ErrorAlert` |
| `features/profile/index.ts` | Barrel export |
| `app/layout/AppSidebar.tsx` | Sidebar with locked/unlocked nav items |
| `app/pages/ComingSoonPage.tsx` | Shared placeholder page component |

### Updated files
| File | Change |
|---|---|
| `app/layout/AppShell.tsx` | Added `AppSidebar` to layout |
| `app/pages/AppPlaceholderPage.tsx` | Conditionally renders `ProfileSetupCard` or dashboard |
| `app/router/AppRouter.tsx` | Added routes for `/app/offices`, `/app/bookings`, `/app/events`, `/app/people` |
| `routes/paths.ts` | Added `offices`, `bookings`, `events`, `people` constants |
| `i18n/en.ts` | Added `app.sidebar`, `app.profile`, `app.pages`; removed dead `profileCompleted` key |

---

## Validation Rules

| Field | Required | Frontend | Backend |
|---|---|---|---|
| `full_name` | Yes | Non-empty after trim; max 255 chars | Non-empty after trim; max 255 chars |
| `job_title` | No | None | Trimmed; max 120 chars |
| `phone_number` | No | `^[0-9\s+\(\)\-]+$` if non-empty | Same regex; trimmed; max 30 chars |
| `timezone` | No | Not in form | Must be valid IANA timezone |
| `locale` | No | Not in form | Must be in `{en, en-IE, en-GB, en-US}` |

---

## Sidebar Locking Behavior

- `AppSidebar` reads `user.is_profile_completed` from `AuthContext` on every render
- Items with `alwaysEnabled: true` (Dashboard only) are never disabled
- All other items are disabled when `!profileComplete`
- Disabled items are wrapped in `<Tooltip title="..."><span>...</span></Tooltip>` — the `span` wrapper is required for MUI Tooltip to function on a disabled button
- When `setAuthenticatedUser(updatedUser)` is called after a successful profile save, the context updates and React re-renders the sidebar — no page reload needed

---

## Files Involved

```
backend/
  users/
    serializers.py          ← ProfileUpdateSerializer
    views.py                ← CurrentUserView.patch(), get_throttles()
    tests/test_profile.py   ← 26 backend tests
  config/
    settings.py             ← auth_profile throttle rate
  .env.example              ← THROTTLE_AUTH_PROFILE

frontend/src/
  app/
    layout/
      AppShell.tsx                              ← sidebar added
      AppSidebar.tsx                            ← new
      __tests__/AppSidebar.test.tsx             ← new
    pages/
      AppPlaceholderPage.tsx                    ← conditional rendering
      ComingSoonPage.tsx                        ← new
    router/AppRouter.tsx                        ← 4 new routes
    __tests__/AppPlaceholderPage.test.tsx       ← updated + unlock test
  features/profile/
    api/profileApi.ts                           ← new
    hooks/useProfileSetupForm.ts                ← new
    components/ProfileSetupCard.tsx             ← new
    index.ts                                    ← new
    __tests__/ProfileSetupCard.test.tsx         ← new
  routes/paths.ts                               ← 4 new route constants
  i18n/en.ts                                    ← new strings, dead key removed
docs/027-profile-completion-dashboard-flow.md   ← this file
```

---

## How to Run / Test

**Backend:**
```bash
# From backend/ with the Docker DB running:
docker compose exec backend pytest users/tests/test_profile.py -v
```

**Frontend:**
```bash
cd frontend
npm run test
```

---

## Important Decisions

**User lands directly at `/app` after login.**
The protected route redirects authenticated users to `/app`. There is no intermediate "welcome" or "onboarding" screen. The profile setup card is embedded in the dashboard shell, not a separate page.

**Incomplete profile is a valid user state.**
`User.full_name` is `blank=True` at the DB level. Users created via social auth may have a `full_name` from their provider, but email-signup users will have an empty name until they complete the setup. No DB migration was needed because the model already supported this.

**Profile completion requires only `full_name`.**
For MVP, `is_profile_completed = bool(full_name.strip())`. Job title, phone, timezone, and locale are accepted and stored but do not gate completion.

**`setAuthenticatedUser()` is used — not `refreshUser()`.**
The PATCH response already returns the full `CurrentUserSerializer` payload. Using `setAuthenticatedUser(updatedUser)` avoids a second network request and gives instant UI feedback.

**PATCH throttle is per-method, not per-view.**
`CurrentUserView.get_throttles()` applies the `auth_profile` scope only when `request.method == "PATCH"`. This leaves `GET /api/auth/me/` unthrottled, which is important since it is called on every protected route entry.

**Timezone validated via `zoneinfo.available_timezones()`, not a hardcoded list.**
This uses Python's standard library and will automatically include all IANA timezone names. No dependency added.

**Locale is a hardcoded allowlist.**
Locales are not auto-detected from a standard library. The supported set (`en`, `en-IE`, `en-GB`, `en-US`) is kept minimal for MVP. Expanding this requires adding to `_SUPPORTED_LOCALES` in `serializers.py`.

---

## Deferred Items

- **Organization/workspace creation** — deferred. The dashboard shows an empty-state "no organization" card. Org creation UI is a separate PR.
- **Invitations** — deferred. Users join organizations via invitation; no invitation flow exists yet.
- **Avatar upload** — deferred. The `User.avatar` field exists on the model but there is no upload UI or endpoint.
- **Billing** — not in scope for this product phase.
- **DB `NOT NULL` constraint on `full_name`** — not added. Until profile completion is enforced at the auth layer, users may have empty names and that is a valid state.
- **Locale/timezone in profile form UI** — fields exist on the API but are not exposed in `ProfileSetupCard`. They can be added in a "Edit Profile" screen in a later PR.
- **Profile completion enforcement on sidebar routes** — `/app/offices` etc. are accessible via direct URL even with an incomplete profile. A profile-completion guard middleware/redirect can be added when those pages have real content.
