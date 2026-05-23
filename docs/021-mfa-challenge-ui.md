# 021 — MFA Challenge UI

## Purpose

Replaces the `/mfa-challenge` placeholder with a real MFA challenge screen. Users who log in with MFA enabled are routed here to enter either their TOTP authenticator code or a recovery code. On success, tokens are stored and the user navigates to `/app`.

---

## What Was Added

- **`MfaChallengePage`** — real challenge screen with TOTP and recovery code modes, missing-challenge error state, and toggle between modes
- **`useMfaChallengeForm`** — hook managing mode, fields, validation, API call, token storage, and navigation
- **`validateMfaChallengeForm`** — validates TOTP (6-digit numeric) and recovery code (non-empty) modes
- **`MfaChallengeFieldErrors`** and **`MfaChallengeMode`** types — field error shape and mode union
- **`extractMfaChallengeFieldErrors`** — maps DRF-style `token` and `recovery_code` field errors from the API
- **`mfaToggleSx`** — sx style for the mode toggle button container
- **`FormTextField` improvements** — added `inputMode`, `autoFocus`, `maxLength` props (backwards-compatible); used by the TOTP field
- **Missing challenge state** — if `challengeId` is absent from router state, shows an error with a link back to login; no form is rendered
- **Recovery code mode** — toggle switches the field, clears errors, and adjusts the subtitle; `recovery_code` is trimmed before sending
- **Token storage only after success** — tokens are stored via `tokenStorage.setTokens()` only when verification succeeds

---

## Files Involved

**New files:**

- `src/features/auth/pages/MfaChallengePage.tsx`
- `src/features/auth/hooks/useMfaChallengeForm.ts`
- `src/features/auth/types/mfaChallenge.types.ts`
- `src/features/auth/utils/mfaChallengeValidation.ts`
- `src/features/auth/__tests__/mfaChallengeValidation.test.ts`
- `src/features/auth/__tests__/MfaChallengePage.test.tsx`
- `docs/021-mfa-challenge-ui.md`

**Modified files:**

- `src/i18n/en.ts` — added `auth.mfaChallenge.*` strings
- `src/features/auth/utils/authErrorUtils.ts` — added `extractMfaChallengeFieldErrors`
- `src/features/auth/styles/auth.styles.ts` — added `mfaToggleSx`
- `src/components/ui/FormTextField.tsx` — added `inputMode`, `autoFocus`, `maxLength` props
- `src/features/auth/index.ts` — exports `MfaChallengePage` (replaces `MfaChallengePlaceholderPage`)
- `src/app/router/AppRouter.tsx` — wires `ROUTES.mfaChallenge` to `MfaChallengePage`
- `src/features/auth/__tests__/authErrorUtils.test.ts` — added `extractMfaChallengeFieldErrors` tests
- `README.md` — added row 021 to docs table

**Deleted files:**

- `src/features/auth/pages/MfaChallengePlaceholderPage.tsx` — replaced by `MfaChallengePage.tsx`

---

## How It Works

1. User logs in with email and password.
2. Backend returns `mfa_required: true` and `challenge_id`.
3. `LoginPage` stores nothing and navigates to `ROUTES.mfaChallenge` with router state `{ challengeId, email }`.
4. `MfaChallengePage` reads `challengeId` from `useLocation().state`.
5. If `challengeId` is missing, the page shows an error message and a link back to login. No form is rendered.
6. If `challengeId` exists, the page renders `AuthPageShell` with the challenge form.
7. User enters a 6-digit TOTP code (default) or toggles to recovery code mode.
8. On submit, `useMfaChallengeForm` runs `validateMfaChallengeForm`:
   - TOTP: token must be non-empty and exactly 6 numeric digits.
   - Recovery: recovery code must be non-empty after trimming.
9. If valid, calls `verifyMfaChallenge({ challenge_id, token })` or `verifyMfaChallenge({ challenge_id, recovery_code })`.
10. **On success**: `tokenStorage.setTokens(access, refresh)` then `navigate(ROUTES.app)`.
11. **On API field errors**: `extractMfaChallengeFieldErrors` maps `token` or `recovery_code` errors to field error state.
12. **On other API errors**: `getApiErrorMessage` extracts the `detail` string and shows it via `ErrorAlert`.

---

## Security Notes

- Tokens are stored **only after MFA verification succeeds**. A failed TOTP or recovery code attempt stores nothing.
- `challengeId` is required. Missing it forces the user back to login to start a fresh session.
- Recovery codes are sent only to the backend verification endpoint and trimmed of whitespace on the frontend before sending.
- No tokens are stored on validation errors, network errors, or API errors.

---

## What Is Not Included Yet

- MFA setup/manage UI (TOTP device setup, recovery code regeneration)
- Email verification UI
- Google / Microsoft social login buttons
- Protected routes / auth guards
- `AuthContext` or Zustand global auth state
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
