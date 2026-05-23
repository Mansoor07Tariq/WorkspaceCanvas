# 022 — Email Verification UI

## Purpose

Adds the frontend page that consumes email verification links. When a user signs up, the backend sends a link containing a token. This PR handles that link: reads the token from the URL, calls the verification endpoint, and shows success or error states. In the error state a resend form allows the user to request a new link.

---

## What Was Added

- **`VerifyEmailPage`** — handles `/verify-email?token=<uuid>`; shows verifying spinner, success state, or error state with resend form
- **`useVerifyEmail`** — reads token, calls `verifyEmail()` once on mount, exposes `status` and `errorMessage`
- **`useResendVerificationForm`** — manages the resend form: email field, validation, API call, success/error state
- **`validateResendVerificationForm`** — pure validation for the resend email field
- **`ResendVerificationFieldErrors`** and **`VerifyEmailStatus`** types
- **`extractResendVerificationFieldErrors`** — maps DRF `email` array errors from the resend API
- **`verifyEmail` ROUTE** — `ROUTES.verifyEmail = "/verify-email"` added to `paths.ts`
- **`auth.verifyEmail.*` strings** — 16 strings added to `en.ts`
- **Styles** — `verifyEmailCenterSx`, `verifyEmailResendSectionSx` added to `auth.styles.ts`
- **Tests** — validation, error utils, and full page integration tests

---

## Files Involved

**New files:**

- `src/features/auth/pages/VerifyEmailPage.tsx`
- `src/features/auth/hooks/useVerifyEmail.ts`
- `src/features/auth/hooks/useResendVerificationForm.ts`
- `src/features/auth/types/emailVerification.types.ts`
- `src/features/auth/utils/emailVerificationValidation.ts`
- `src/features/auth/__tests__/emailVerificationValidation.test.ts`
- `src/features/auth/__tests__/VerifyEmailPage.test.tsx`
- `docs/022-email-verification-ui.md`

**Modified files:**

- `src/routes/paths.ts` — added `verifyEmail: "/verify-email"`
- `src/i18n/en.ts` — added `auth.verifyEmail.*` namespace
- `src/features/auth/utils/authErrorUtils.ts` — added `extractResendVerificationFieldErrors`
- `src/features/auth/styles/auth.styles.ts` — added `verifyEmailCenterSx`, `verifyEmailResendSectionSx`
- `src/features/auth/index.ts` — exports `VerifyEmailPage`
- `src/app/router/AppRouter.tsx` — added `ROUTES.verifyEmail → VerifyEmailPage`
- `src/features/auth/__tests__/authErrorUtils.test.ts` — added `extractResendVerificationFieldErrors` tests
- `README.md` — added row 022 to docs table

---

## How It Works

1. User signs up — backend sends a verification email containing `/verify-email?token=<uuid>`.
2. User clicks the link — browser opens `VerifyEmailPage` with the token in the query string.
3. `useVerifyEmail(token)` initializes with `status = "verifying"` and calls `verifyEmail({ token })` in a `useEffect`.
4. **Success** — `status` becomes `"success"`. Page shows success message and a "Go to login" button. User must click manually — no auto-login.
5. **Error** — `status` becomes `"error"`. Page shows the backend error message (or a generic fallback). A resend form appears below.
6. **Missing token** — if no `token` query param is present, the hook initializes directly to `status = "error"` with `missingTokenMessage`. The API is never called.
7. **Resend form** — user enters their email, `useResendVerificationForm` validates and calls `resendVerification({ email })`. On success, shows the intentionally generic `resendSuccess` message. On error, shows field or general errors.

---

## Security / Auth Notes

- **No tokens are stored** — `tokenStorage` is never called on this page. Email verification only confirms the email address; login is a separate action.
- **No auto-login** — the user must navigate to the login page manually after verification succeeds.
- **Missing token never calls the backend** — the hook detects `token === null` before mounting the API call, so the verification endpoint is not probed without a valid-looking token.
- **Anti-enumeration on resend** — the resend success message is intentionally generic: "If that email is registered and unverified, a new link has been sent." This avoids leaking whether an email address is registered.

---

## What Is Not Included Yet

- Forgot password UI
- Google / Microsoft social login buttons
- Protected routes / auth guards
- `AuthContext` or Zustand global auth state
- Real dashboard (AppPlaceholderPage unchanged)
- Backend changes

---

## How To Run / Test

```bash
npm run lint
npm run format:check
npm run test
npm run build
```
