# 014 — MFA Foundation

## Purpose

This PR adds authenticator-app TOTP-based MFA (Multi-Factor Authentication) before organization setup. Users can set up, confirm, and disable MFA, and can generate and use recovery codes. This PR does **not** enforce MFA during login — enforcement is the next PR.

## What Was Added

- `UserMFADevice` model — stores the TOTP secret for one device per user; tracks confirmation state
- `RecoveryCode` model — stores hashed recovery codes; tracks used state
- `POST /api/auth/mfa/setup/` — creates or resets an unconfirmed TOTP device, returns provisioning URI
- `POST /api/auth/mfa/confirm/` — verifies a TOTP token, confirms the device, generates recovery codes
- `GET /api/auth/mfa/status/` — returns current MFA state (enabled, confirmed device, remaining codes)
- `POST /api/auth/mfa/disable/` — disables MFA with password + TOTP or recovery code proof
- `POST /api/auth/mfa/recovery-codes/regenerate/` — replaces recovery codes with password + MFA proof
- `users/reauth.py` — `verify_reauth_for_user()` helper used by disable and regenerate to accept either a password or a Google/Microsoft provider token as identity proof
- 47 tests in `users/tests/test_mfa.py` (37 original + 10 social re-auth tests)

## Files Involved

| File | Change |
|---|---|
| `backend/requirements.txt` | Added `pyotp==2.9.0`, `qrcode==8.2` |
| `backend/config/settings.py` | Added `MFA_ISSUER_NAME`, `MFA_TOTP_INTERVAL`, `MFA_TOTP_DIGITS`, `MFA_RECOVERY_CODE_COUNT` |
| `backend/.env.example` | Added MFA env var placeholders |
| `backend/users/models.py` | Added `UserMFADevice` and `RecoveryCode` models |
| `backend/users/admin.py` | Registered `UserMFADevice` and `RecoveryCode` in Django admin |
| `backend/users/mfa_serializers.py` | New — `MFAStatusSerializer`, `MFASetupSerializer`, `MFAConfirmSerializer`, `MFADisableSerializer`, `RecoveryCodeRegenerateSerializer` |
| `backend/users/mfa_views.py` | New — `MFAStatusView`, `MFASetupView`, `MFAConfirmView`, `MFADisableView`, `RecoveryCodeRegenerateView` |
| `backend/users/urls.py` | Added 5 MFA routes |
| `backend/users/migrations/0004_recoverycode_usermfadevice.py` | New migration |
| `backend/users/reauth.py` | New — `verify_reauth_for_user()` — password or social token identity check |
| `backend/users/tests/test_mfa.py` | New — 47 tests (37 original + 10 social re-auth) |
| `docs/014-mfa-foundation.md` | This file |
| `README.md` | Added docs link |

## How It Works

1. **Setup**: User calls `POST /api/auth/mfa/setup/`. Backend creates a `UserMFADevice` with a random base32 TOTP secret and returns a `provisioning_uri` (otpauth:// URL). User scans this URI in their authenticator app (Google Authenticator, Authy, etc.). In `DEBUG` mode the raw secret is also returned.

2. **Confirm**: User calls `POST /api/auth/mfa/confirm/` with a 6-digit code from their app. Backend verifies the code with `valid_window=1` (±30 seconds). On success: the device is confirmed, `user.mfa_enabled` is set to `True`, and 10 recovery codes are generated and returned **once** in plain text.

3. **Status**: `GET /api/auth/mfa/status/` returns `mfa_enabled`, `has_confirmed_device`, and `recovery_codes_remaining` (count of unused codes).

4. **Disable**: `POST /api/auth/mfa/disable/` requires the user's password **and** either a valid TOTP token or a valid unused recovery code. On success the device and all recovery codes are deleted, and `mfa_enabled` is set to `False`.

5. **Regenerate**: `POST /api/auth/mfa/recovery-codes/regenerate/` requires the same proof as disable. On success all old codes are deleted and 10 new codes are returned once.

## API Endpoints

### `GET /api/auth/mfa/status/`

Requires authentication.

**Response:**
```json
{
  "mfa_enabled": true,
  "has_confirmed_device": true,
  "recovery_codes_remaining": 8
}
```

---

### `POST /api/auth/mfa/setup/`

Requires authentication. Returns 400 if MFA is already confirmed.

**Response:**
```json
{
  "provisioning_uri": "otpauth://totp/WorkspaceCanvas:user@example.com?secret=BASE32SECRET&issuer=WorkspaceCanvas",
  "detail": "Scan the provisioning URI in your authenticator app, then confirm with POST /api/auth/mfa/confirm/."
}
```

In `DEBUG=True`, also includes `"secret": "BASE32SECRET"` for development convenience.

---

### `POST /api/auth/mfa/confirm/`

Requires authentication and a prior call to setup.

**Request:**
```json
{ "token": "123456" }
```

**Response:**
```json
{
  "detail": "MFA enabled. Store your recovery codes safely — not shown again.",
  "recovery_codes": ["a1b2c3d4e5f6...", "..."]
}
```

---

### `POST /api/auth/mfa/disable/`

Requires authentication plus identity proof (password **or** provider token) and MFA proof (TOTP **or** recovery code).

**Request — email/password user with TOTP:**
```json
{ "password": "...", "token": "123456" }
```

**Request — email/password user with recovery code:**
```json
{ "password": "...", "recovery_code": "a1b2c3d4e5f6..." }
```

**Request — social user with Google token and TOTP:**
```json
{ "provider": "google", "access_token": "...", "token": "123456" }
```

**Request — social user with Google token and recovery code:**
```json
{ "provider": "google", "id_token": "...", "recovery_code": "a1b2c3d4e5f6..." }
```

**Response:** `204 No Content`

---

### `POST /api/auth/mfa/recovery-codes/regenerate/`

Same input as disable. Returns new codes once.

**Response:**
```json
{
  "detail": "Recovery codes regenerated. Store them safely — not shown again.",
  "recovery_codes": ["...", "..."]
}
```

## Social-Only Users and MFA Management

Users created via Google or Microsoft social login have no usable password (`password=None`). To allow these users to disable MFA or regenerate recovery codes, both endpoints accept a provider token as an alternative identity proof.

**Two valid identity proof paths:**

| User type | Identity proof fields |
|---|---|
| Email/password | `password` |
| Social (Google) | `provider: "google"`, `access_token` and/or `id_token` |
| Social (Microsoft) | `provider: "microsoft"`, `access_token` and/or `id_token` |

**Security rules enforced by `reauth.py`:**

- The provider token is verified against the same Google/Microsoft endpoints used at login.
- The email returned by the provider **must match** the currently authenticated user's email — a token from a different account is rejected.
- The provider must confirm `email_verified: true`.
- No users, organisations, or memberships are created or modified during re-auth.
- `preferred_auth_provider` is not updated during re-auth.

**Error responses:**

- Identity proof fails: `{"detail": "Identity verification failed.", "code": "identity_verification_failed"}` — HTTP 400
- MFA proof (TOTP/recovery code) fails: `{"detail": "Invalid MFA proof.", "code": "invalid_mfa_proof"}` — HTTP 400

**Example: social user disabling MFA via Google token + TOTP:**

```json
POST /api/auth/mfa/disable/
{
  "provider": "google",
  "access_token": "<google-access-token>",
  "token": "123456"
}
```

**Example: social user disabling MFA via Google token + recovery code:**

```json
POST /api/auth/mfa/disable/
{
  "provider": "google",
  "id_token": "<google-id-token>",
  "recovery_code": "a1b2c3d4e5f6..."
}
```

The same pattern applies to `POST /api/auth/mfa/recovery-codes/regenerate/`.

## Security Notes

- **TOTP secret is never returned** after the initial `setup` call — the device stores it server-side only.
- **Recovery codes are stored hashed** using Django's `make_password` (PBKDF2). Raw codes are never stored and cannot be retrieved after the initial generation.
- **Verification uses `check_password`** — constant-time comparison to prevent timing attacks.
- **`valid_window=1`** allows ±1 TOTP period (±30 seconds) to account for clock drift.
- **Double-proof for disable/regenerate**: password alone is insufficient; a second factor (TOTP or recovery code) is always required.
- **Used recovery codes are marked `used_at`** and are never accepted again.
- **MFA is not enforced during login yet** — `user.mfa_enabled=True` is recorded but the login flow does not check it. Enforcement is the next PR.
- No organization or membership is created by any MFA endpoint.

## What Is Not Included Yet

- No login enforcement — MFA verification is not required during `/api/auth/token/` yet
- No frontend QR code screen
- No organization setup or invitations
- No organization-level `require_mfa` policy
- No TOTP backup codes via SMS or email

## How To Run / Test

```bash
make makemigrations
make migrate
make backend-check
make backend-test
make ci
```

## Future Notes

- The next PR will add a `POST /api/auth/mfa/verify/` challenge step to the login flow: after password authentication, users with `mfa_enabled=True` will be required to complete TOTP verification before receiving a full JWT.
- Organization-level `require_mfa` enforcement (all members of an org must have MFA) can be added later once the org management layer is built.
- The frontend will render a QR code by encoding `provisioning_uri` with a QR library — the backend intentionally returns the URI rather than a rendered image.
