# 028 — Premium Profile Onboarding Carousel + Avatar Upload

## Overview

Replaces the single-page `ProfileSetupCard` with a six-step guided onboarding carousel.
Users see a premium, branded welcome screen and are walked through confirming their name and
email, entering optional work details, and uploading a profile photo before landing on a
completion screen. The backend gains avatar upload with server-side Pillow validation and
social auth now backfills the user's full name from the provider when the existing record has
a blank name.

---

## User flow

| # | Step | Notes |
|---|------|-------|
| 1 | **Welcome** | "Welcome to WorkspaceCanvas" with "Get started" CTA |
| 2 | **Confirm Name** | Required; pre-filled from existing `full_name` |
| 3 | **Confirm Email** | Read-only; shows verified chip if `email_verified` |
| 4 | **Work Details** | Optional; job title + phone number + timezone (combined) |
| 5 | **Avatar** | Optional; JPEG/PNG/WebP ≤ 2 MB; Skip submits without photo |
| 6 | **Done** | Only reachable after a successful backend save |

Both **Skip** on the avatar step and the **Complete profile** button trigger the API
submission. Skip submits without uploading a photo even if one was selected.

---

## Backend changes

### `users/serializers.py`

**`ProfileUpdateSerializer`**

- `avatar = ImageField(required=False, allow_null=True, use_url=True)`
- `remove_avatar = BooleanField(required=False, default=False, write_only=True)`
- `validate_avatar`: size check (≤ 2 MB) → Pillow open + load → format in
  `{"JPEG", "PNG", "WEBP"}`
- `update()`: fixed `update_fields` — `"avatar"` is only added to the field list
  when the avatar was actually changed or removed (previously always included).
- Social auth `_find_or_create_user`: backfills `full_name` from the provider identity
  when the existing user record has a blank name.

### `users/views.py`

- `CurrentUserView` gains `parser_classes = [MultiPartParser, FormParser, JSONParser]`
  so the avatar endpoint accepts `multipart/form-data`.

---

## Frontend changes

### New components

| File | Purpose |
|------|---------|
| `carousel/StepWelcome.tsx` | Welcome screen with brand icon and "Get started" CTA |
| `carousel/StepEmail.tsx` | Read-only email display with optional verified chip |
| `carousel/StepWorkDetails.tsx` | Combined job title, phone, and timezone fields |

### Removed components

- `ProfileSetupCard` and its hook `useProfileSetupForm` — replaced by the carousel
- `StepJobTitle`, `StepPhone`, `StepTimezone` — merged into `StepWorkDetails`

### Updated files

**`hooks/useProfileOnboardingForm.ts`**
- `ONBOARDING_STEPS = ["welcome", "name", "email", "workDetails", "avatar", "done"]`
- Pre-fills `fullName` from `user.full_name`, `timezone` from `user.timezone` →
  `Intl.DateTimeFormat().resolvedOptions().timeZone` → `"UTC"`
- `handleFinish(withAvatar: boolean)` — when called with `false` (avatar Skip), the
  profile is submitted without uploading a photo
- `useEffect` cleanup revokes the blob URL on unmount to prevent memory leaks

**`components/ProfileOnboardingCarousel.tsx`**
- `OPTIONAL_STEPS` constant moved outside the component
- MobileStepper shows dots only for the four middle steps (name/email/workDetails/avatar)
- Skip on the avatar step calls `handleFinish(false)` instead of `goNext()`
- `Fade` transition timeout is set to `0` when `prefers-reduced-motion: reduce` is active

**`api/profileApi.ts`**
- `uploadAvatar(file: File): Promise<CurrentUser>` — sends a `multipart/form-data` PATCH
- `removeAvatar()` — internal; not exported from the barrel until there is a UI for it

**`utils/avatarValidation.ts`** — client-side file type and size guard
**`utils/avatarFallback.ts`** — derives 1-2 initials from a full name for the Avatar fallback

**`lib/api/apiClient.ts`** — detects `body instanceof FormData` and omits `Content-Type`
so the browser sets the boundary automatically

---

## API summary

| Method | Path | Parser | Notes |
|--------|------|--------|-------|
| `PATCH` | `/api/auth/me/` | JSON | Profile fields (name, job title, phone, timezone) |
| `PATCH` | `/api/auth/me/` | multipart | Avatar upload (`avatar` field) |
| `PATCH` | `/api/auth/me/` | JSON | `{"remove_avatar": true}` clears avatar |

The carousel issues two sequential requests only when an avatar file is selected: first
the profile PATCH, then the avatar PATCH. If the profile PATCH succeeds but the avatar
PATCH fails, the error is surfaced in the carousel and the profile data is still saved.

---

## i18n additions (`en.ts` → `en.app.profile.carousel`)

New keys:
- `stepWelcome`, `stepWelcomeTitle`, `stepWelcomeSubtitle`, `stepWelcomeCta`
- `stepEmail`, `stepEmailTitle`, `stepEmailSubtitle`, `stepEmailVerifiedLabel`
- `stepWorkDetails`, `stepWorkDetailsTitle`, `stepWorkDetailsSubtitle`

Removed keys (only used by deleted components):
- `stepJobTitle*`, `stepPhone*`, `stepTimezone*`

---

## Tests added

### Backend

| File | Tests |
|------|-------|
| `test_avatar.py` | JPEG/PNG/WebP upload; avatar URL in response; oversized rejected; non-image rejected; SVG rejected; remove clears field; remove returns null; remove noop when no avatar (10 tests) |
| `test_social_auth.py` | Google backfills blank name; Google preserves existing name; Microsoft backfills blank name; Microsoft preserves existing name (4 tests) |

### Frontend

| File | Tests |
|------|-------|
| `ProfileOnboardingCarousel.test.tsx` | Welcome step, name step, email step, work details step, avatar step, finish submission (26 tests) |
| `avatarValidation.test.ts` | Valid JPEG/PNG/WebP; oversized; wrong MIME type (6 tests) |
| `avatarFallback.test.ts` | Initials extraction edge cases (6 tests) |

---

## Security notes

- Avatar validation runs in two layers: client-side MIME/size check before upload,
  and server-side Pillow format verification (`img.load()` forces full decode).
- The `remove_avatar` flag is `write_only=True` and never returned in responses.
- Avatar files are stored under `users/avatars/` and served via Django's media URL.
- No executable formats (SVG, GIF, BMP) are accepted — only JPEG, PNG, WebP.
