# 029 — httpOnly Cookie Auth Migration

## Overview

Replaces the previous localStorage-based refresh token storage with the
OWASP-recommended SPA session architecture: the **refresh token lives exclusively
in an `HttpOnly` cookie** set by the backend; the **access token lives in memory
only** on the frontend. Neither token is ever accessible to JavaScript running
in the page.

This change was introduced alongside PR 028 and applies to all auth flows:
email/password login, social auth (Google/Microsoft), and MFA challenge verify.

---

## Why

| Threat | Old behaviour | New behaviour |
|---|---|---|
| XSS token theft | Refresh token in `localStorage` — readable by any injected script | Refresh token in `HttpOnly` cookie — invisible to JavaScript |
| Token leakage via response body | `refresh` returned in JSON body | `refresh` never appears in any response body |
| Access token exposure | Access token in `localStorage` — persists across sessions | Access token in memory — gone on page reload |

---

## Refresh Token Cookie

The cookie is named `wsc_rt` and is configured in `backend/config/settings.py`:

```python
AUTH_COOKIE_NAME     = "wsc_rt"
AUTH_COOKIE_SECURE   = not DEBUG   # HTTPS-only in production
AUTH_COOKIE_SAMESITE = "Lax"       # Blocks cross-site form POST CSRF
AUTH_COOKIE_PATH     = "/api/auth/"  # Scoped — not sent to /api/user/ etc.
AUTH_COOKIE_MAX_AGE  = 604800      # 7 days, matches JWT refresh lifetime
```

The cookie is **HttpOnly** (always — hardcoded in `auth_cookies.py`).

All cookie writes and clears go through the central module `backend/users/auth_cookies.py`:

```python
def set_refresh_cookie(response, refresh_token):
    response.set_cookie(key=AUTH_COOKIE_NAME, ..., httponly=True)

def clear_refresh_cookie(response):
    response.delete_cookie(key=AUTH_COOKIE_NAME, path=AUTH_COOKIE_PATH, ...)
```

---

## Access Token

The access token (`access`) is returned in the JSON response body and stored
in memory only by the frontend:

```typescript
// frontend/src/lib/tokenStorage.ts
let _accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken() { return _accessToken; },
  setAccessToken(access) { _accessToken = access; },
  clearTokens()   { _accessToken = null; },
};
```

It is never written to `localStorage` or `sessionStorage`. It is lost on page
reload — see **Session Restore** below.

---

## Token-Issuing Endpoints

All three login paths pop `refresh` before building the `Response` and set it
as a cookie instead:

| Endpoint | View | Cookie set |
|---|---|---|
| `POST /api/auth/token/` | `EmailTokenObtainPairView` | Yes |
| `POST /api/auth/social/` | `SocialAuthView` | Yes |
| `POST /api/auth/mfa/challenge/verify/` | `MFALoginChallengeVerifyView` | Yes |

Response bodies contain only `access` (plus any non-token fields like `email`).
The `refresh` key is never present in a response body.

---

## Token Refresh

`POST /api/auth/token/refresh/` is handled by `CookieTokenRefreshView`, which:

1. Reads the `wsc_rt` cookie from `request.COOKIES` (no request body needed).
2. Validates it via `TokenRefreshSerializer`.
3. Returns only `{"access": "..."}` in the body.
4. Rotates the refresh cookie if simplejwt issues a new one.
5. Returns **401** (not 400) on missing or invalid cookie — semantically correct for session failures.
6. **Clears the stale cookie** on validation failure so the browser does not endlessly retry.

---

## Logout

`POST /api/auth/logout/` (`LogoutView`):

1. Reads `wsc_rt` cookie — if present, blacklists it via `RefreshToken.blacklist()`.
2. Always clears the cookie in the response, regardless of whether blacklisting succeeded.
3. Returns 204. No request body is needed.

Blacklisting is best-effort: a `TokenError` is caught and ignored. Local state
is always cleared. The refresh cookie will expire naturally after 7 days even if
blacklisting fails.

---

## Session Restore (Frontend Bootstrap)

Because the access token is in-memory only, it is lost on every page reload.
The `AuthContext` bootstrap always attempts to recover the session:

```typescript
// frontend/src/features/auth/context/AuthContext.tsx
const [state, setState] = useState({ status: "loading", user: null });

useEffect(() => {
  if (bootstrapped.current) return;   // StrictMode guard
  bootstrapped.current = true;
  async function bootstrap() {
    const ok = await refreshStoredTokens();  // POST /api/auth/token/refresh/ — no body
    if (!ok) { setState({ status: "unauthenticated" }); return; }
    const user = await getCurrentUser();
    setState({ status: "authenticated", user });
  }
  void bootstrap();
}, []);
```

- Always starts as `loading` — never assumes a token exists.
- Always calls `refreshStoredTokens()` on mount.
- The cookie is sent automatically by the browser (`credentials: "include"`).
- On first load after logout the refresh returns 401, state transitions to `unauthenticated`.

---

## `credentials: "include"`

Every `fetch` call from the frontend includes `credentials: "include"` so the
browser transmits the `HttpOnly` cookie cross-origin:

```typescript
// frontend/src/lib/api/rawRequest.ts
const response = await fetch(`${API_BASE_URL}${path}`, {
  ...init,
  credentials: "include",
});
```

This requires `CORS_ALLOW_CREDENTIALS = True` on the backend. This is safe
because `CORS_ALLOWED_ORIGINS` uses **specific origins**, never `*`.

---

## CORS Configuration

```python
# backend/config/settings.py
CORS_ALLOWED_ORIGINS = ["http://localhost:5173", ...]
CORS_ALLOW_CREDENTIALS = True
```

`CORS_ALLOW_CREDENTIALS` with a wildcard origin is rejected by browsers. The
specific-origin requirement is therefore a prerequisite, not an addition.

---

## apiClient Retry Logic

`frontend/src/lib/api/apiClient.ts` retries authenticated requests that return
401 by calling `refreshStoredTokens()` once. The retry is blocked on a
`NO_REFRESH_PATHS` set that prevents:

- The refresh endpoint itself (avoids infinite loops)
- Login, signup, social auth, MFA challenge verify (credential failures, not expiry)
- Logout (best-effort; no retry)

---

## Deployment Notes

### Environment variables

No new environment variables are required. Cookie settings can be tuned in
`settings.py` or overridden per-environment:

| Setting | Default | Override env var |
|---|---|---|
| `AUTH_COOKIE_SECURE` | `not DEBUG` | Set `DEBUG=False` in production |
| `AUTH_COOKIE_SAMESITE` | `"Lax"` | n/a |
| `AUTH_COOKIE_PATH` | `"/api/auth/"` | n/a |
| `AUTH_COOKIE_MAX_AGE` | `604800` (7 days) | n/a |

### HTTPS requirement

`AUTH_COOKIE_SECURE = not DEBUG` means the cookie is only transmitted over
HTTPS in production. Deployments must terminate TLS before reaching Django.
Without HTTPS the browser will not send the cookie to the server.

### Reverse proxy / load balancer

If the frontend and backend are on different subdomains (e.g. `app.example.com`
vs `api.example.com`), the `SameSite=Lax` cookie will be a **cross-site** cookie.
Browsers block cross-site cookies unless `SameSite=None; Secure` is set.
For same-origin deployments (e.g. both served from `example.com`) the current
`Lax` setting is correct.

### Token blacklist

`rest_framework_simplejwt.token_blacklist` must be in `INSTALLED_APPS` and
the blacklist migration must be applied for logout to blacklist tokens.
Without it, logout clears the cookie but the token remains technically valid
until expiry.

---

## Manual Test Checklist

### After login

- [ ] Response body contains `access` but **not** `refresh`
- [ ] Browser DevTools → Application → Cookies → `wsc_rt` is present with `HttpOnly=true`
- [ ] `document.cookie` in console does **not** include `wsc_rt`

### Session restore

- [ ] Refresh the page while logged in → user remains authenticated
- [ ] A loading state is briefly visible during bootstrap

### Access token expiry

- [ ] Wait 15 min (access token lifetime), make an API request
- [ ] Network tab shows: 401 on original request → POST to `/api/auth/token/refresh/` → original request retried with new access token

### Logout

- [ ] POST to `/api/auth/logout/` returns 204
- [ ] `wsc_rt` cookie is cleared (check Application → Cookies → cookie gone)
- [ ] Refresh the page after logout → redirected to login

### Tampered cookie

- [ ] Manually edit `wsc_rt` value in DevTools to any invalid string
- [ ] POST to `/api/auth/token/refresh/` → 401
- [ ] `wsc_rt` cookie cleared in response (not retried endlessly)

### Social auth

- [ ] Google login: no `refresh` in response body, `wsc_rt` cookie set
- [ ] Microsoft login: same

### MFA flow

- [ ] MFA login challenge verify: no `refresh` in response body, `wsc_rt` cookie set

### CORS (dev setup: frontend on :5173, backend on :8000)

- [ ] Response header includes `Access-Control-Allow-Credentials: true`
- [ ] Response header includes `Access-Control-Allow-Origin: http://localhost:5173` (not `*`)
- [ ] Cookies are transmitted successfully cross-origin
