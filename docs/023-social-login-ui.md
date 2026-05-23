# 023 — Social Login UI

## Purpose

Adds Google and Microsoft OAuth buttons to the Login and Signup pages. The frontend triggers the provider's SDK flow to obtain a token, passes it to the backend's social auth endpoint, and handles the response identically to email/password login: store tokens and navigate to `/app` on success, or navigate to `/mfa-challenge` if MFA is required.

---

## What Was Added

- **`@react-oauth/google`**, **`@azure/msal-browser`**, **`@azure/msal-react`** — installed
- **`VITE_GOOGLE_CLIENT_ID`**, **`VITE_MICROSOFT_CLIENT_ID`** — added to `.env.example` and `vite-env.d.ts`
- **`GOOGLE_CLIENT_ID`**, **`MICROSOFT_CLIENT_ID`** — exported from `src/config/env.ts`
- **`isGoogleConfigured`**, **`isMicrosoftConfigured`** — exported from `src/features/auth/social/socialConfig.ts`; `true` only when the respective env var is present
- **`auth.social.*` strings** — 10 strings in `en.ts` (see Strings section)
- **`msalInstance`** — `PublicClientApplication` configured in `src/features/auth/social/socialConfig.ts`
- **`AuthProviderSetup`** — wraps the app with `GoogleOAuthProvider` and `MsalProvider` at `src/app/providers/AuthProviderSetup.tsx`
- **`SocialLoginButtons`** — renders the "or" divider, Google button, and Microsoft button with `ErrorAlert` at `src/features/auth/components/SocialLoginButtons.tsx`
- **`useSocialLogin`** — calls `socialAuth()`, handles token storage and navigation at `src/features/auth/hooks/useSocialLogin.ts`
- **`socialButtonsSx`**, **`socialProviderIconSx`** — added to `src/features/auth/styles/auth.styles.ts`
- **SVG brand icons** — `src/assets/icons/google.svg` and `src/assets/icons/microsoft.svg`
- **Tests** — `useSocialLogin.test.ts` (20 tests) and `SocialLoginButtons.test.tsx` (20 tests)
- **`docs/023-social-login-ui.md`** — this file

---

## Files Involved

**New files:**

- `src/assets/icons/google.svg`
- `src/assets/icons/microsoft.svg`
- `src/features/auth/social/socialConfig.ts`
- `src/app/providers/AuthProviderSetup.tsx`
- `src/features/auth/components/SocialLoginButtons.tsx`
- `src/features/auth/hooks/useSocialLogin.ts`
- `src/features/auth/__tests__/useSocialLogin.test.ts`
- `src/features/auth/__tests__/SocialLoginButtons.test.tsx`
- `docs/023-social-login-ui.md`

**Modified files:**

- `frontend/.env.example` — added `VITE_GOOGLE_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_ID`
- `src/vite-env.d.ts` — declared new env vars
- `src/config/env.ts` — exported `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`
- `src/i18n/en.ts` — added `auth.social.*` namespace
- `src/features/auth/styles/auth.styles.ts` — added `socialButtonsSx`, `socialProviderIconSx`
- `src/features/auth/pages/LoginPage.tsx` — integrated `useSocialLogin` + `SocialLoginButtons`
- `src/features/auth/pages/SignupPage.tsx` — integrated `useSocialLogin` + `SocialLoginButtons`
- `src/app/App.tsx` — wrapped with `AuthProviderSetup`
- `src/features/auth/__tests__/LoginPage.test.tsx` — added SDK and socialConfig mocks
- `src/features/auth/__tests__/SignupPage.test.tsx` — added SDK and socialConfig mocks
- `README.md` — added row 023 to docs table

**Deleted files:**

- `src/features/auth/types/socialLogin.types.ts` — removed; contained only `SocialLoginStatus`, which was never used

---

## How It Works

1. **App boot** — `AuthProviderSetup` wraps the entire app, providing `GoogleOAuthProvider` (with `GOOGLE_CLIENT_ID`) and `MsalProvider` (with `msalInstance`).
2. **User clicks "Continue with Google"** — if `isGoogleConfigured` is false, a "Google login is not configured." error is shown immediately and no SDK call is made. Otherwise, `useGoogleLogin` from `@react-oauth/google` opens the Google OAuth consent screen. On success, `onSuccess` fires with a `TokenResponse` containing `access_token`.
3. **User clicks "Continue with Microsoft"** — if `isMicrosoftConfigured` is false, a "Microsoft login is not configured." error is shown immediately and no SDK call is made. Otherwise, `useMsal().instance.loginPopup` opens the MSAL popup. On success, `AuthenticationResult.idToken` is extracted.
4. **Backend call** — `useSocialLogin.submitSocialToken` calls `socialAuth({ provider, access_token | id_token })`.
5. **Success** — tokens stored via `tokenStorage.setTokens`, navigate to `/app`.
6. **MFA required** — navigate to `/mfa-challenge` with `{ challengeId, email }` state (same as email/password MFA flow). Tokens are not stored.
7. **Backend error** — `generalError` set from `getApiErrorMessage`; displayed by `SocialLoginButtons` via `ErrorAlert`.
8. **Google SDK error** — all Google SDK failures (including popup closed) call `onError`, which shows "Google sign-in failed. Please try again."
9. **Microsoft popup cancelled** — MSAL throws with `errorCode: "user_cancelled"`; shows "Login was cancelled."
10. **Microsoft popup other error** — any non-cancellation MSAL error shows "Microsoft sign-in failed. Please try again."

Both LoginPage and SignupPage hit the same backend endpoint — the backend handles find-or-create.

---

## Provider-Specific Loading

Loading state is tracked per-provider as `loadingProvider: "google" | "microsoft" | undefined` (not a single boolean). This means:

- Only the active provider's button shows a spinner and loading text.
- Both buttons are disabled whenever either provider is loading.
- The email/password form fields and submit button are also disabled during any active social flow.

`startGoogleFlow()` and `startMicrosoftFlow()` set loading before the SDK popup opens, covering both the popup phase and the subsequent backend call. Loading is cleared in a `finally` block after the backend call resolves or rejects, or immediately by the error handlers if the SDK itself fails before the backend is reached.

---

## Configuration Guards

`isGoogleConfigured` and `isMicrosoftConfigured` are computed at module load in `socialConfig.ts` from the respective env vars. When an env var is absent, the value defaults to `""` and the flag is `false`.

When a flag is `false`, clicking the button shows a friendly error ("Google login is not configured." or "Microsoft login is not configured.") without triggering the SDK or making any network request. The app renders and functions normally with either or both flags unset.

---

## Strings

All user-facing social login strings come from `en.auth.social`:

| Key | Value |
|---|---|
| `orDivider` | `"or"` |
| `continueWithGoogle` | `"Continue with Google"` |
| `continueWithMicrosoft` | `"Continue with Microsoft"` |
| `loadingGoogle` | `"Connecting to Google..."` |
| `loadingMicrosoft` | `"Connecting to Microsoft..."` |
| `googleError` | `"Google sign-in failed. Please try again."` |
| `microsoftError` | `"Microsoft sign-in failed. Please try again."` |
| `googleUnavailable` | `"Google login is not configured."` |
| `microsoftUnavailable` | `"Microsoft login is not configured."` |
| `popupClosed` | `"Login was cancelled."` |

---

## Provider Icons

Each button renders an SVG brand icon imported as a URL asset via Vite's default asset handling. The icons live at `src/assets/icons/google.svg` and `src/assets/icons/microsoft.svg` and are rendered as `<img>` elements inside MUI `Button`'s `startIcon` prop. No raw SVG markup is inline in any component file. When a button is in loading state, the icon is replaced by a `CircularProgress` spinner.

---

## Token Storage

`tokenStorage.setTokens` is called only on a normal `socialAuth` success response. It is not called on MFA-required responses, missing config, SDK errors, popup cancellation, or backend errors.

---

## Security Notes

- **No client secrets on the frontend** — only `VITE_GOOGLE_CLIENT_ID` and `VITE_MICROSOFT_CLIENT_ID` (public OAuth client IDs) are embedded.
- **No token storage before success** — `tokenStorage.setTokens` is only called after the backend confirms the social token is valid.
- **No tokens on MFA branch** — if the backend returns `mfa_required`, navigation proceeds to the MFA challenge without storing any tokens.
- **Backend owns verification** — the frontend passes the raw provider token to the backend; the backend calls Google/Microsoft to verify it. The frontend never trusts the provider token itself.
- **MSAL cache** — `sessionStorage` (cleared on tab close) rather than `localStorage`.

---

## What Is Not Included Yet

- Forgot password UI
- Protected routes / auth guards
- `AuthContext` or Zustand global auth state
- Real dashboard (AppPlaceholderPage unchanged)
- Backend changes

---

## How To Run / Test

```bash
# Add env vars to .env.local (copy from .env.example, fill in client IDs)
npm run lint
npm run format:check
npm run test
npm run build
```
