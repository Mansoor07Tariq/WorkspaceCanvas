# 024 — Auth State and Protected Routes

## Purpose

Adds frontend auth session state, protects authenticated routes, loads the current user from the backend after login, provides logout support, adds token refresh retry on 401, adds global session expiry handling, and upgrades `/app` from a raw placeholder to a proper authenticated app shell.

---

## What Was Added

- **`AuthStatus` / `AuthState` / `AuthContextValue`** — auth state types at `src/features/auth/types/authState.types.ts`
- **`AuthProvider`** — React context provider that bootstraps auth state from stored tokens at `src/features/auth/context/AuthContext.tsx`
- **`useAuth`** — hook that exposes auth state and actions to any component inside `AuthProvider`
- **`ProtectedRoute`** — route wrapper that blocks unauthenticated access at `src/routes/ProtectedRoute.tsx`
- **`/app` protection** — `AppRouter` wraps `AppPlaceholderPage` with `ProtectedRoute`
- **Current user bootstrap** — `useLoginForm`, `useMfaChallengeForm`, and `useSocialLogin` call `getCurrentUser` after storing tokens and set auth state before navigating to `/app`
- **Logout support** — `logoutUser()` in `AuthProvider` calls the backend logout endpoint (if a refresh token is present), always clears local tokens, and sets unauthenticated state
- **`src/lib/api/rawRequest.ts`** — extracted low-level `apiRequest` function used by both `apiClient` and `sessionRefresh`
- **`src/lib/sessionEvents.ts`** — module-level event emitter for session expiry; `apiClient` emits on refresh failure, `AuthProvider` subscribes
- **`src/features/auth/utils/sessionRefresh.ts`** — `refreshStoredTokens()` helper; reads refresh token, calls the refresh endpoint, stores new tokens
- **`src/lib/api/apiClient.ts` 401 retry** — authenticated requests that receive 401 attempt `refreshStoredTokens()` once and retry; if refresh fails, `sessionEvents.emitSessionExpired()` is called
- **Global session expiry in `AuthProvider`** — subscribes to `sessionEvents.onSessionExpired` on mount; on fire: clears tokens, sets `unauthenticated` with `en.auth.session.sessionExpired` error
- **`src/app/layout/AppShell.tsx`** — authenticated app layout with top AppBar (brand, user email, logout), renders children as main content
- **`AppPlaceholderPage` upgrade** — uses `AppShell`; shows welcome heading, user info card (email, name, profile completed, organizations count), and no-organization empty state
- **`app.shell` / `app.placeholder` strings** — 10 new strings added to `en.ts` under `app.shell` and `app.placeholder`
- **`tokenStorage.setAccessToken`** — new method to update only the access token when a refresh response does not return a new refresh token
- **Tests** — 262 total passing across 20 test files; all new functionality covered

---

## Files Involved

**New files:**

- `src/lib/api/rawRequest.ts`
- `src/lib/sessionEvents.ts`
- `src/features/auth/types/authState.types.ts`
- `src/features/auth/context/AuthContext.tsx`
- `src/features/auth/utils/sessionRefresh.ts`
- `src/routes/ProtectedRoute.tsx`
- `src/app/layout/AppShell.tsx`
- `src/features/auth/__tests__/AuthContext.test.tsx`
- `src/features/auth/__tests__/sessionRefresh.test.ts`
- `src/routes/__tests__/ProtectedRoute.test.tsx`
- `src/app/__tests__/AppPlaceholderPage.test.tsx`
- `src/lib/__tests__/sessionEvents.test.ts`
- `docs/024-auth-state-protected-routes.md`

**Modified files:**

- `src/lib/api/apiClient.ts` — 401 retry, imports from `rawRequest.ts`
- `src/lib/tokenStorage.ts` — added `setAccessToken`
- `src/lib/__tests__/apiClient.test.ts` — mocks for new imports, 8 new 401 retry tests
- `src/lib/__tests__/tokenStorage.test.ts` — 2 new `setAccessToken` tests
- `src/features/auth/types/auth.types.ts` — `TokenRefreshResponse.refresh` now optional
- `src/features/auth/types/authState.types.ts` — removed `"idle"` from `AuthStatus`
- `src/i18n/en.ts` — added `auth.session.*` (7 strings) and `app.shell.*` / `app.placeholder.*` (10 strings)
- `src/app/App.tsx` — wrapped router with `AuthProvider`
- `src/app/router/AppRouter.tsx` — wrapped `/app` route with `ProtectedRoute`
- `src/app/pages/AppPlaceholderPage.tsx` — uses `AppShell`, full user info card, empty state
- `src/features/auth/hooks/useLoginForm.ts` — calls `getCurrentUser` + `setAuthenticatedUser` on success
- `src/features/auth/hooks/useMfaChallengeForm.ts` — same pattern as `useLoginForm`
- `src/features/auth/hooks/useSocialLogin.ts` — same pattern
- `src/features/auth/index.ts` — exports `AuthProvider`, `useAuth`, auth state types
- `src/features/auth/__tests__/LoginPage.test.tsx` — updated mocks + new `getCurrentUser`/`setAuthenticatedUser` tests
- `src/features/auth/__tests__/MfaChallengePage.test.tsx` — same
- `src/features/auth/__tests__/useSocialLogin.test.ts` — same
- `src/features/auth/__tests__/SignupPage.test.tsx` — added `useAuth` mock
- `src/routes/__tests__/ProtectedRoute.test.tsx` — removed `"idle"` test
- `README.md` — added row 024 to docs table

---

## How It Works

### Bootstrap

`AuthProvider` initialises state synchronously from `tokenStorage.getAccessToken()`:
- No token → `status: "unauthenticated"`. No API call.
- Token exists → `status: "loading"`. `useEffect` fires once (guarded by `useRef` to prevent React StrictMode double-invoke) and calls `getCurrentUser()`.
  - Success → `status: "authenticated"`, `user` set.
  - Failure → tokens cleared, `status: "unauthenticated"`.

### Login / MFA / Social success flow

After storing tokens with `tokenStorage.setTokens`, each success hook:
1. Calls `getCurrentUser()` to load the user from the backend.
2. On success: calls `setAuthenticatedUser(user)` to update the context, then navigates to `/app`.
3. On failure: clears tokens, sets a `generalError` message, and does not navigate.

Auth state is populated before the `/app` route renders — no loading flash.

### Protected route

`ProtectedRoute` reads `status` from `useAuth()`:
- `"loading"` → renders a centered spinner with `en.auth.session.protectedRouteLoading`.
- `"unauthenticated"` → `<Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />`.
- `"authenticated"` → renders `children`.

### Token refresh retry

When an authenticated API request returns 401:
1. `executeWithRetry` in `apiClient.ts` calls `refreshStoredTokens()`.
2. `refreshStoredTokens` reads the refresh token, POSTs to `/api/auth/token/refresh/`, and:
   - If the backend returns a new refresh token: calls `setTokens(access, refresh)`.
   - If not: calls `setAccessToken(access)` only.
   - On failure: calls `clearTokens()` and returns `false`.
3. If refresh succeeds: retries the original request once. `buildHeaders` re-reads `tokenStorage.getAccessToken()` so the retry uses the new token.
4. If refresh fails: calls `sessionEvents.emitSessionExpired()` and throws the original error.
5. If the retry itself returns 401: calls `sessionEvents.emitSessionExpired()` and throws.

**Endpoints excluded from retry** (never trigger refresh):
- `/api/auth/token/` (login)
- `/api/auth/signup/`
- `/api/auth/verify-email/`
- `/api/auth/resend-verification/`
- `/api/auth/token/refresh/` (the refresh endpoint itself — prevents infinite loops)
- `/api/auth/social/`
- `/api/auth/mfa/challenge/verify/`

Also: requests with `auth: false` never trigger refresh.

### Global session expiry

`AuthProvider` subscribes to `sessionEvents.onSessionExpired` in a `useEffect` (separate from the bootstrap effect). The subscription is cleaned up on unmount via the returned unsubscribe function.

On `emitSessionExpired()`:
- `tokenStorage.clearTokens()` is called.
- State is set to `{ status: "unauthenticated", user: null, error: en.auth.session.sessionExpired }`.

### `sessionEvents` module

`src/lib/sessionEvents.ts` is a simple `Set`-based event emitter with no project dependencies. It lives in `src/lib/` so both `apiClient.ts` and `AuthContext.tsx` can import it without crossing architectural boundaries.

### Logout

`logoutUser()` in `AuthProvider`:
1. Gets the refresh token from `tokenStorage`.
2. If present, calls `logout({ refresh })`. Backend errors are swallowed — local logout always proceeds.
3. Calls `tokenStorage.clearTokens()`.
4. Sets `status: "unauthenticated"`, `user: null`.

The calling component (`AppPlaceholderPage` via `AppShell`) navigates to `ROUTES.login` after `logoutUser()` resolves.

Note: the logout endpoint uses `auth: true` by default. If a 401 is returned during logout, the retry logic runs. This is harmless — if the refresh also fails, the session expired handler fires, which also marks the user unauthenticated. The local logout always completes regardless.

### `AppShell` and `AppPlaceholderPage`

`AppShell` renders a top `AppBar` with:
- WorkspaceCanvas brand text (`en.app.shell.brand`)
- Current user email (from `useAuth().user.email`)
- Logout button (`en.app.shell.logout`) — calls `onLogout` prop

`AppPlaceholderPage` wraps content in `AppShell` and shows:
- Welcome heading and subtitle
- User info card: email, full name (conditional), profile completed chip, organizations count
- No-organization empty state card (when `memberships.length === 0`)

---

## Why `"idle"` Was Removed from `AuthStatus`

`AuthProvider` never emits `"idle"`. The initial state is always either `"loading"` (token present) or `"unauthenticated"` (no token). Keeping `"idle"` in the union made the state machine misleading — any component reading `status` would have to handle a state that could never actually occur. `ProtectedRoute` now checks only `"loading"`, not `"loading" || "idle"`.

---

## Route Behavior

| Route | Public / Protected | Notes |
|---|---|---|
| `/login` | Public | Accessible without a token |
| `/signup` | Public | Accessible without a token |
| `/verify-email` | Public | Token verification link from email |
| `/mfa-challenge` | Public | User has no full JWT yet — only a challenge ID |
| `/app` | Protected | Redirects to `/login` if unauthenticated |

`/mfa-challenge` stays public because users completing MFA have not yet received their JWT pair.

---

## Session Strings

All strings in `en.auth.session`:

| Key | Value |
|---|---|
| `loading` | `"Checking your session..."` |
| `sessionExpired` | `"Your session has expired. Please sign in again."` |
| `logout` | `"Log out"` |
| `logoutFailed` | `"We could not log you out. Please try again."` |
| `signedOut` | `"You have been signed out."` |
| `protectedRouteLoading` | `"Loading your workspace..."` |
| `unauthenticatedRedirect` | `"Please sign in to continue."` |

All strings in `en.app`:

| Key | Value |
|---|---|
| `app.shell.brand` | `"WorkspaceCanvas"` |
| `app.shell.logout` | `"Log out"` |
| `app.placeholder.title` | `"Welcome to WorkspaceCanvas"` |
| `app.placeholder.subtitle` | `"Your workspace dashboard will appear here."` |
| `app.placeholder.email` | `"Email"` |
| `app.placeholder.name` | `"Name"` |
| `app.placeholder.profileCompleted` | `"Profile completed"` |
| `app.placeholder.organizations` | `"Organizations"` |
| `app.placeholder.noOrganizationsTitle` | `"No organization yet"` |
| `app.placeholder.noOrganizationsMessage` | `"You are not part of any organization yet. Organization setup and invitations will be added next."` |

---

## Security Notes

- **No user stored in `localStorage`** — `tokenStorage` stores only JWT tokens. User data lives only in React state and is discarded on tab close.
- **Stale or invalid token clears local state** — if `getCurrentUser()` fails during bootstrap, tokens are cleared immediately.
- **`ProtectedRoute` uses authenticated user state, not just token presence** — the route waits until `AuthProvider` has confirmed the user via `getCurrentUser()` before rendering.
- **Logout always clears tokens** — even if the backend logout endpoint fails, `tokenStorage.clearTokens()` is called.
- **Token refresh retry is bounded** — each request retries at most once. The refresh endpoint itself is excluded from retry to prevent infinite loops.
- **Session expiry is handled globally** — `AuthProvider` subscribes to `sessionEvents` and marks the user unauthenticated immediately when a refresh fails anywhere in the app.
- **No backend changes** — all authentication endpoints already exist.

---

## What Is Not Included Yet

- No real dashboard — `AppPlaceholderPage` is still a placeholder
- No organization setup UI
- No profile completion UI
- No forgot-password UI
- No persistence of auth state beyond `localStorage` tokens — refreshing the page re-calls `getCurrentUser()` from the stored token
- No backend changes

---

## How To Run / Test

```bash
npm run lint
npm run format:check
npm run test
npm run build
```
