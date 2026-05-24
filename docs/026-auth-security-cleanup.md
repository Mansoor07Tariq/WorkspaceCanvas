# 026 — Auth Security Cleanup and QR Code

## Summary

This PR bundles the remaining auth security hardening items identified during the PR 024 audit with QR code support for MFA setup. No new user-facing features are added beyond what the audit identified as missing or incorrect.

---

## Changes

### 1. IP extraction consolidated — `users/utils.py`

**Problem:** Two separate IP extraction implementations existed in the codebase, both with TODO comments about using `django-ipware`:

- `_get_client_ip()` module-level function in `serializers.py` — naive `split(",")[0]` on `HTTP_X_FORWARDED_FOR`
- Inline block in `MFALoginChallenge.create_for_user` in `models.py` — same naive approach, plus a security comment acknowledging the problem

**Fix:** Created `users/utils.py` with a single `get_client_ip(request) -> str | None` function backed by `django-ipware 7.0.1`. Both callers updated to use it. Both old implementations deleted. Both TODO comments removed.

**Why ipware:** `django-ipware` correctly handles `REMOTE_ADDR` vs `X-Forwarded-For` and respects the `IPWARE_PRIVATE_IP_PREFIX` setting. The naive `split(",")[0]` approach is susceptible to header spoofing — an attacker can prepend an arbitrary IP to the `X-Forwarded-For` header.

**Note:** IP is recorded for audit logging only (`last_login_ip`, `MFALoginChallenge.ip_address`). It does not gate any auth decision.

---

### 2. `SECRET_KEY` now always required

**Before (PR 025):** Raised `ImproperlyConfigured` only when `DEBUG=False`. Emitted `warnings.warn` in DEBUG mode and used an insecure dev fallback.

**After:** Raises `ImproperlyConfigured` in all environments without exception. The server will not start without `DJANGO_SECRET_KEY` set.

**Rationale:** The warnings approach was fragile — a developer could silence warnings or miss them. Since generating a secret key is a one-time `secrets.token_hex(50)` command, there is no legitimate reason to allow a fallback. Local `.env` files with a proper key are the correct workflow.

`DEBUG` now defaults to `"False"` instead of `"True"`. The `import warnings` statement was removed.

---

### 3. Content Security Policy via `django-csp`

**Added:** `django-csp==3.8` to `requirements.txt`, `"csp"` to `INSTALLED_APPS`, `csp.middleware.CSPMiddleware` to `MIDDLEWARE` (after `SecurityMiddleware`, before `CorsMiddleware`).

**Policy (applies to Django-served pages: admin, API schema):**

```python
CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        "default-src": ("'none'",),
        "script-src": ("'self'",),
        "style-src": ("'self'", "'unsafe-inline'"),
        "img-src": ("'self'", "data:"),
        "font-src": ("'self'",),
        "connect-src": ("'self'",),
        "form-action": ("'self'",),
        "frame-ancestors": ("'none'",),
        "base-uri": ("'none'",),
    }
}
```

**Scope:** This CSP applies only to Django-served responses. The React SPA is served separately and requires equivalent headers from Vite (development) or nginx (production).

**Vite dev CSP:** Added `server.headers["Content-Security-Policy"]` to `vite.config.ts` with a `DEV_CSP` string that mirrors the production policy but relaxes `script-src` (adds `'unsafe-eval'` for Vite HMR) and `connect-src` (adds WebSocket + backend + Google/Microsoft OAuth domains).

---

### 4. QR code generation for MFA setup

**Before:** `MFASetupView` returned only a `provisioning_uri` string. Users had to copy-paste the URI into an authenticator app manually.

**After:** `MFASetupView` also returns `qr_code_base64` — a base64-encoded PNG generated server-side using `qrcode` + `Pillow`. The frontend renders it as `<img src="data:image/png;base64,..." />`.

**Why server-side:** The TOTP secret never leaves the server as a raw string. The QR image is pre-rendered from the `provisioning_uri` and delivered as an opaque blob. This avoids the frontend ever holding the raw secret (which would require additional CSP `img-src` rules for a third-party QR-generation CDN).

**Test:** `test_setup_returns_qr_code_base64` in `test_mfa.py` — verifies the response includes `qr_code_base64` and that it decodes to a valid PNG (PNG magic bytes `\x89PNG\r\n\x1a\n`).

---

### 5. Hardcoded colours replaced with MUI theme tokens

**Before:** Several auth page links used `color: "#2563EB"` (a hard-coded hex that matched the MUI primary colour only by coincidence).

**After:** All auth page links use `sx={{ color: "primary.main" }}` via a `Typography component="span"` wrapper. This means theme changes in `theme.ts` automatically propagate to all link colours.

**Pages updated:** `LoginPage`, `SignupPage`, `MfaChallengePage`, `VerifyEmailPage`.

**Why Typography wrapper instead of `Link component={RouterLink}`:** MUI 9 TypeScript overloads on `Link` reject `fontWeight` as a direct prop when `component` is overridden. The wrapper pattern avoids the overload issue cleanly.

---

### 6. MFA setup page (`/app/mfa/setup`)

**New:** `MfaSetupPage` — a three-step flow:

1. **Loading** — calls `POST /api/auth/mfa/setup/` on mount, shows spinner
2. **Scan** — renders the QR code image, the manual TOTP secret (extracted from `provisioning_uri` via regex), and a 6-digit confirm form
3. **Codes** — renders the recovery codes returned by `POST /api/auth/mfa/confirm/`, with a "I've saved my recovery codes" done button

**Implementation:** `useMfaSetup` hook with a `useRef(false)` StrictMode guard to prevent double API call in React 18.

**Route:** `/app/mfa/setup` — protected, requires `IsAuthenticated` via `ProtectedRoute`.

---

### 7. `MFASetupSerializer` stale field removed

**Before:** `MFASetupSerializer` had `secret = serializers.CharField(read_only=True)` — a remnant from when the setup endpoint considered returning the raw TOTP secret.

**After:** Field replaced with `qr_code_base64 = serializers.CharField(read_only=True)`, matching the actual response shape.

**Note:** The view does not use this serializer for serialization (it builds a response dict directly and uses inline `extend_schema`). The serializer serves as readable documentation of the endpoint contract.

---

### 8. `.env.example` updated

- `DJANGO_SECRET_KEY`: marked "Required in ALL environments — the server will not start without this." Placeholder changed to `REPLACE-THIS-WITH-A-REAL-SECRET-KEY`.
- `DJANGO_DEBUG`: marked "Required. Set True for local development, False in all other environments."

---

## Test additions

| File | Tests added |
|---|---|
| `users/tests/test_mfa.py` | `test_setup_never_returns_raw_secret`, `test_setup_returns_qr_code_base64` |
| `users/tests/test_throttling.py` | 7 new throttle tests |
| `frontend/src/features/auth/__tests__/MfaSetupPage.test.tsx` | 12 new tests (new file) |

**Frontend test count after this PR:** 275 tests across 21 files.

---

## Dependencies added

| Package | Version | Purpose |
|---|---|---|
| `django-csp` | 3.8 | Content-Security-Policy header middleware |
| `django-ipware` | 7.0.1 | Safe IP extraction from request headers |

Both were already referenced in TODO comments in the codebase before this PR.

---

## Production deployment note

Before deploying to production, the nginx (or equivalent) reverse proxy serving the React SPA must add a `Content-Security-Policy` header equivalent to the `DEV_CSP` in `vite.config.ts` (without `'unsafe-eval'` and with the production domain replacing `localhost`). The Vite dev CSP is **not** served in production builds.
