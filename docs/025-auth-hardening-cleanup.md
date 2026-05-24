# 025 — Auth Hardening and Cleanup

## Summary

This PR addresses the security, configuration, and dead-code findings from the full auth audit (PR 024 report). No new features are added. Changes are limited to hardening what already exists.

---

## Changes

### 1. django-allauth removed

**Decision: removed.**

`django-allauth` was in `INSTALLED_APPS`, `MIDDLEWARE`, and `requirements.txt`, but zero lines of project code referenced it. The project uses a fully custom social auth implementation (`users/social_auth.py`). Allauth's `AccountMiddleware` was running on every HTTP request for no benefit.

**What was removed:**
- `django.contrib.sites`, `allauth`, `allauth.account`, `allauth.socialaccount`, `allauth.socialaccount.providers.google`, `allauth.socialaccount.providers.microsoft` from `INSTALLED_APPS`
- `SITE_ID = 1` from settings
- `allauth.account.middleware.AccountMiddleware` from `MIDDLEWARE`
- All `ACCOUNT_*` and `SOCIALACCOUNT_*` settings
- `django-allauth==65.16.1` from `requirements.txt`

**Database note:** If an existing database was created while allauth was installed, Django will have created allauth's migration tables (`account_emailaddress`, `socialaccount_socialaccount`, etc.). Removing allauth from `INSTALLED_APPS` does not drop these tables — they remain as orphaned tables that Django no longer manages. This is harmless. For a clean production database, those tables can be dropped manually after confirming they contain no data.

---

### 2. SECRET_KEY hardening

**Before:** `SECRET_KEY` had a hardcoded fallback that silently ran in any environment.

**After:**
- If `DJANGO_SECRET_KEY` is not set and `DEBUG=True`: uses an insecure dev fallback and emits a `warnings.warn` message.
- If `DJANGO_SECRET_KEY` is not set and `DEBUG=False`: raises `ImproperlyConfigured` immediately, preventing the server from starting.

Production deployments are now hard-blocked from starting without a proper secret key.

---

### 3. CORS configured via environment variable

**Before:** `CORS_ALLOWED_ORIGINS` was a hardcoded list of localhost origins.

**After:** Reads from `DJANGO_CORS_ALLOWED_ORIGINS` as a comma-separated string.

```
# .env
DJANGO_CORS_ALLOWED_ORIGINS=https://app.workspacecanvas.com
```

Dev default remains `http://localhost:5173,http://127.0.0.1:5173`.

---

### 4. MFA setup — raw TOTP secret removed from API response

**Before:** `MFASetupView` returned `{"secret": "<base32>", ...}` when `settings.DEBUG=True`.

**After:** The response only ever contains `provisioning_uri` and `detail`. The raw secret is never sent over the wire in any environment.

The provisioning URI (`otpauth://...`) already encodes the secret for authenticator apps to scan. There is no legitimate need to expose it via the API.

Test added: `test_setup_never_returns_raw_secret` in `users/tests/test_mfa.py`.

---

### 5. Rate limiting on public auth endpoints

DRF's built-in `ScopedRateThrottle` is now applied to all public auth endpoints.

| Endpoint | Scope | Default rate |
|----------|-------|-------------|
| `POST /api/auth/token/` | `auth_login` | 5/min |
| `POST /api/auth/signup/` | `auth_signup` | 5/min |
| `POST /api/auth/resend-verification/` | `auth_resend` | 3/min |
| `POST /api/auth/mfa/challenge/verify/` | `auth_mfa_challenge` | 5/min |
| `POST /api/auth/social/` | `auth_social` | 10/min |

Rates are configurable via environment variables (see `.env.example`). Throttling is per client IP. When the limit is exceeded the API returns HTTP 429 with a `Retry-After` header.

Tests added: `users/tests/test_throttling.py` — covers login, resend, MFA challenge, signup, and scope isolation.

---

### 6. .env.example updated

- `DJANGO_SUPERUSER_PASSWORD` changed from `admin123` to `Change-Me-Before-Running!` with a comment.
- Console email backend retained with an explicit comment explaining console vs. dummy vs. SMTP.
- `DJANGO_CORS_ALLOWED_ORIGINS` added.
- Throttle rate env vars added with comments.
- `DJANGO_SECRET_KEY` comment updated to explain it is required in production.

---

### 7. X-Forwarded-For — documented (not changed)

`_get_client_ip` in `users/serializers.py` and `MFALoginChallenge.create_for_user` in `users/models.py` both trust `X-Forwarded-For` without validating it against a trusted proxy list. A `TODO(security)` comment was added to both locations.

Impact: audit trail only (`last_login_ip`, `ip_address` on `MFALoginChallenge`). This does not affect authentication decisions. Fix via `django-ipware` or proxy configuration when the app is deployed behind a load balancer.

---

### 8. token/verify endpoint — kept

`POST /api/auth/token/verify/` is kept. The frontend does not use it, but it is tested (`test_auth.py::test_valid_access_token_verifies`) and is a standard SimpleJWT endpoint. A comment was added in `users/urls.py` explaining the decision.

---

### 9. DRY fix (from audit)

`_get_client_ip` duplicate static method on `EmailTokenObtainPairSerializer` was removed in the audit PR and is already in the codebase.

`VerifyEmailView` error message inconsistency was also fixed in the audit PR.

---

## Files changed

| File | Change |
|------|--------|
| `backend/config/settings.py` | SECRET_KEY hardening, allauth removal, CORS env var, rate limiting config |
| `backend/users/mfa_views.py` | Remove `settings.DEBUG` secret exposure; add `throttle_scope` to `MFALoginChallengeVerifyView` |
| `backend/users/views.py` | Add `throttle_scope` to login, signup, resend, social views |
| `backend/users/models.py` | Add TODO comment for X-Forwarded-For |
| `backend/users/serializers.py` | Add TODO comment for X-Forwarded-For |
| `backend/users/urls.py` | Add comment on token/verify decision |
| `backend/requirements.txt` | Remove `django-allauth` |
| `backend/.env.example` | Multiple documentation/value updates |
| `backend/conftest.py` | New: autouse cache-clearing fixture for test isolation |
| `backend/users/tests/test_mfa.py` | Add `test_setup_never_returns_raw_secret` |
| `backend/users/tests/test_throttling.py` | New: throttling test suite |
| `docs/025-auth-hardening-cleanup.md` | This file |

---

## Public/private endpoint behaviour

Endpoints without `throttle_scope` (e.g., `GET /api/auth/me/`, `POST /api/auth/logout/`, all authenticated MFA management endpoints) are **not throttled** by `ScopedRateThrottle`. Only the public unauthenticated endpoints listed above are rate-limited.

---

## Remaining recommendations

These were noted in the audit but are out of scope for this PR:

- Production HTTPS/HSTS settings (`SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`)
- Trusted proxy validation for `X-Forwarded-For` via `django-ipware`
- Frontend `Content-Security-Policy` headers
- Lazy-loading auth pages to reduce bundle size
