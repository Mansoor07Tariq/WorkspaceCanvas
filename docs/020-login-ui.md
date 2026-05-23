# 020 — Login UI

## Purpose

Adds the email/password login UI. Users can sign in, receive JWT tokens on success, or be routed to a placeholder MFA challenge screen when MFA is required. Signup is refactored to share a new `AuthPageShell` component, keeping both pages thin and consistent.

---

## What Was Added

- **`LoginPage`** — email + password form, general error alert, footer link to signup
- **`AuthPageShell`** — shared auth layout composing `CenteredPageLayout`, `AuthCard`, brand name, title, subtitle, and optional footer; used by both `LoginPage` and `SignupPage`
- **`useLoginForm`** — login form logic: validation, API call, token storage on success, MFA routing on challenge
- **`loginValidation.ts`** — `validateLoginForm` using shared `isValidEmail`
- **`LoginFieldErrors`** — field error type for login (email, password)
- **`extractLoginFieldErrors`** — maps DRF-style API errors to `LoginFieldErrors`
- **`authShell.styles.ts`** — `SxProps` objects for `AuthPageShell` (brand, header, footer)
- **`/app` placeholder** — `AppPlaceholderPage` at `ROUTES.app`; temporary post-login destination
- **`/mfa-challenge` placeholder** — `MfaChallengePlaceholderPage` at `ROUTES.mfaChallenge`; shows challenge ID from router state if present, no MFA form yet
- **Token storage on normal login** — `tokenStorage.setTokens(access, refresh)` then `navigate(ROUTES.app)`
- **No token storage on MFA-required login** — navigates directly to `ROUTES.mfaChallenge` with `state: { challengeId, email }`

---

## Files Involved

**New files:**

- `src/features/auth/components/AuthPageShell.tsx`
- `src/features/auth/styles/authShell.styles.ts`
- `src/features/auth/types/login.types.ts`
- `src/features/auth/utils/loginValidation.ts`
- `src/features/auth/hooks/useLoginForm.ts`
- `src/features/auth/pages/LoginPage.tsx`
- `src/features/auth/pages/MfaChallengePlaceholderPage.tsx`
- `src/app/pages/AppPlaceholderPage.tsx`
- `src/features/auth/__tests__/loginValidation.test.ts`
- `src/features/auth/__tests__/LoginPage.test.tsx`

**Modified files:**

- `src/features/auth/utils/authErrorUtils.ts` — added `extractLoginFieldErrors`
- `src/features/auth/styles/auth.styles.ts` — removed shell styles (moved to `authShell.styles.ts`), renamed `signupFormSx` → `authFormSx`
- `src/features/auth/pages/SignupPage.tsx` — uses `AuthPageShell` instead of manually composing layout
- `src/features/auth/index.ts` — exports `LoginPage`, `MfaChallengePlaceholderPage`
- `src/app/router/AppRouter.tsx` — adds all four routes; `"/"` and `"*"` redirect to `ROUTES.login`
- `src/features/auth/__tests__/authErrorUtils.test.ts` — added `extractLoginFieldErrors` tests
- `src/i18n/en.ts` — added `auth.login.*` strings

---

## How It Works

1. User visits `/login` and sees `LoginPage` rendered inside `AuthPageShell`
2. On submit, `useLoginForm` runs `validateLoginForm` — shows field errors if invalid
3. If valid, calls `login({ email, password })` against `POST /api/auth/token/`
4. **Normal success** (`{ access, refresh }`):
   - `tokenStorage.setTokens(access, refresh)` stores both tokens in `localStorage`
   - `navigate(ROUTES.app)` sends the user to the `/app` placeholder
5. **MFA required** (`{ mfa_required: true, challenge_id, detail }`):
   - Tokens are NOT stored
   - `navigate(ROUTES.mfaChallenge, { state: { challengeId, email } })` routes to the placeholder
6. **API error** — `extractLoginFieldErrors` checks for DRF field errors first; if none, `getApiErrorMessage` extracts a general error string and `ErrorAlert` displays it

---

## MFA Behavior

This PR handles the MFA-required branch but does not implement the MFA verification form. When the backend returns `mfa_required: true`, the user is routed to `MfaChallengePlaceholderPage` which displays the title and message strings, and optionally shows the `challenge_id` from router state. The full TOTP form is a separate PR.

---

## What Is Not Included Yet

- Real MFA challenge form (TOTP input, recovery code)
- Email verification UI
- Google / Microsoft login buttons
- Protected routes
- `AuthContext` or Zustand state management
- Real dashboard (replaced by `AppPlaceholderPage`)
- Backend changes

---

## How To Run / Test

```bash
npm run lint
npm run format:check
npm run test
npm run build
```

**98 tests across 9 suites — all passing.**

New test files:

- `loginValidation.test.ts` — 6 tests (required, whitespace, invalid format, both empty, valid)
- `LoginPage.test.tsx` — 13 tests (render, validation, API call, token storage, navigation, MFA branch, error, loading)
- `authErrorUtils.test.ts` — 7 new tests for `extractLoginFieldErrors` added alongside existing signup tests
