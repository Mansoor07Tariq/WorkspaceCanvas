# 015 — MFA Login Enforcement

## Purpose

This PR enforces MFA during login. The MFA foundation (PR 014) recorded `mfa_enabled` on the user but did not gate JWT issuance. This PR makes MFA mandatory: users with MFA enabled must complete a TOTP or recovery-code challenge before receiving JWT tokens.

## What Was Added

- `MFALoginChallenge` model — short-lived, single-use challenge created after primary auth succeeds for an MFA-enabled user
- Challenge creation in `EmailTokenObtainPairSerializer` — after password auth, MFA users receive a challenge instead of tokens
- Challenge creation in `SocialAuthSerializer` — after provider token verification, MFA users receive a challenge instead of tokens
- `MFALoginChallengeVerifySerializer` — validates challenge ID, expiry, and MFA proof (TOTP or recovery code)
- `MFALoginChallengeVerifyView` — `POST /api/auth/mfa/challenge/verify/` (unauthenticated), returns JWT tokens on success
- `build_jwt_response_for_user()` helper — shared token generation used by email login, social login, and challenge verify
- 28 tests in `users/tests/test_mfa_login_enforcement.py`

## Files Involved

| File | Change |
|---|---|
| `backend/config/settings.py` | Added `MFA_CHALLENGE_LIFETIME_MINUTES` |
| `backend/.env.example` | Added `MFA_CHALLENGE_LIFETIME_MINUTES=5` |
| `backend/users/models.py` | Added `MFALoginChallenge` model |
| `backend/users/admin.py` | Registered `MFALoginChallenge` |
| `backend/users/serializers.py` | Added `build_jwt_response_for_user()`; updated `EmailTokenObtainPairSerializer` and `SocialAuthSerializer` to gate JWT on MFA |
| `backend/users/mfa_serializers.py` | Added `MFALoginChallengeVerifySerializer` |
| `backend/users/mfa_views.py` | Added `MFALoginChallengeVerifyView` |
| `backend/users/urls.py` | Added `POST /api/auth/mfa/challenge/verify/` |
| `backend/users/migrations/0005_mfaloginchallenge.py` | New migration |
| `backend/users/tests/test_mfa_login_enforcement.py` | New — 28 tests |
| `docs/015-mfa-login-enforcement.md` | This file |
| `README.md` | Added docs link |

## How It Works

1. **Primary auth** — User submits email/password (`POST /api/auth/token/`) or provider token (`POST /api/auth/social/`).
2. **MFA check** — If `user.mfa_enabled` is `False`, backend returns JWT access + refresh tokens immediately (unchanged behavior).
3. **Challenge issued** — If `user.mfa_enabled` is `True`, backend creates an `MFALoginChallenge` and returns:
   ```json
   { "mfa_required": true, "challenge_id": "<uuid>", "detail": "MFA verification required." }
   ```
   No tokens are returned at this stage.
4. **MFA proof** — User submits TOTP token or recovery code with the challenge ID to `POST /api/auth/mfa/challenge/verify/`.
5. **Token issued** — Backend verifies the proof, marks the challenge used, and returns full JWT tokens.

## API Flow

### Step 1 — Primary login

```
POST /api/auth/token/
{ "email": "user@example.com", "password": "..." }
```

or

```
POST /api/auth/social/
{ "provider": "google", "access_token": "..." }
```

**Response when MFA is disabled (unchanged):**
```json
{ "access": "...", "refresh": "..." }
```

**Response when MFA is enabled:**
```json
{
  "mfa_required": true,
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "detail": "MFA verification required."
}
```

### Step 2 — Complete MFA challenge

```
POST /api/auth/mfa/challenge/verify/
```

**With TOTP token:**
```json
{ "challenge_id": "<uuid>", "token": "123456" }
```

**With recovery code:**
```json
{ "challenge_id": "<uuid>", "recovery_code": "a1b2c3d4e5f6..." }
```

**Success response:**
```json
{ "access": "...", "refresh": "..." }
```

**Error responses:**

| Code | HTTP | Meaning |
|---|---|---|
| `invalid_mfa_challenge` | 400 | Unknown challenge ID |
| `expired_mfa_challenge` | 400 | Challenge older than 5 minutes |
| `used_mfa_challenge` | 400 | Challenge already verified |
| `missing_mfa_proof` | 400 | Neither token nor recovery_code provided |
| `invalid_mfa_proof` | 400 | Wrong TOTP or invalid recovery code |

## Security Notes

- **Full JWT tokens are not returned until MFA is completed.** Primary auth (password check or provider token verification) alone is insufficient.
- **Challenge is short-lived** — expires after `MFA_CHALLENGE_LIFETIME_MINUTES` (default 5 minutes).
- **Challenge is single-use** — `used_at` is set on first successful verification; reuse returns `used_mfa_challenge`.
- **Recovery codes are one-time use** — marked `used_at` on successful challenge verification and rejected on any future attempt.
- **Wrong primary auth does not create a challenge** — challenge is only created after the password or provider token is proven valid.
- **Challenge verify is unauthenticated** (`AllowAny`) because the user does not hold a JWT yet. The challenge UUID + short expiry + required MFA proof together protect the endpoint.
- **No Organization or Membership is created** at any point in this flow.
- Challenge `ip_address` and `user_agent` are recorded for audit purposes (admin-only, read-only).

## What Is Not Included Yet

- No frontend UI
- No remember-device / trusted-device feature
- No organization-level `require_mfa` policy
- No organization setup or invitations
- No profile completion

## How To Run / Test

```bash
make makemigrations
make migrate
make backend-check
make backend-test
make ci
```
