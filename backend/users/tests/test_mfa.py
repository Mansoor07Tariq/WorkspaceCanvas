"""
MFA foundation tests — five sections:

1. Status endpoint
2. Setup endpoint
3. Confirm endpoint (with recovery code generation)
4. Recovery code behaviour
5. Disable endpoint
6. Regenerate recovery codes
7. Social re-auth — disable
8. Social re-auth — regenerate
9. General / cross-cutting
"""

import pyotp
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership, Organization
from users.models import RecoveryCode, User, UserMFADevice

STATUS_URL = "/api/auth/mfa/status/"
SETUP_URL = "/api/auth/mfa/setup/"
CONFIRM_URL = "/api/auth/mfa/confirm/"
DISABLE_URL = "/api/auth/mfa/disable/"
REGEN_URL = "/api/auth/mfa/recovery-codes/regenerate/"
ME_URL = "/api/auth/me/"

PASSWORD = "SuperSecret99!"
SOCIAL_EMAIL = "bob@example.com"
GOOGLE_REAUTH_IDENTITY = {
    "email": SOCIAL_EMAIL,
    "email_verified": True,
    "sub": "google-uid-123",
}
MICROSOFT_REAUTH_IDENTITY = {
    "email": SOCIAL_EMAIL,
    "email_verified": True,
    "sub": "ms-uid-456",
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password=PASSWORD,
        email_verified=True,
        preferred_auth_provider=User.AuthProvider.EMAIL,
    )


@pytest.fixture
def auth_client(client, user):
    resp = client.post(
        "/api/auth/token/",
        {"email": "alice@example.com", "password": PASSWORD},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


@pytest.fixture
def device(user):
    secret = pyotp.random_base32()
    return UserMFADevice.objects.create(user=user, secret=secret)


@pytest.fixture
def confirmed_device(device, user):
    device.confirm()
    user.refresh_from_db()
    return device


@pytest.fixture
def valid_token(device):
    return device.get_totp().now()


@pytest.fixture
def confirmed_valid_token(confirmed_device):
    return confirmed_device.get_totp().now()


@pytest.fixture
def social_user(db):
    return User.objects.create_user(
        username=SOCIAL_EMAIL,
        email=SOCIAL_EMAIL,
        password=None,
        email_verified=True,
        preferred_auth_provider=User.AuthProvider.GOOGLE,
    )


@pytest.fixture
def social_client(client, social_user):
    token = RefreshToken.for_user(social_user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    return client


@pytest.fixture
def social_confirmed_device(social_user):
    secret = pyotp.random_base32()
    device = UserMFADevice.objects.create(user=social_user, secret=secret)
    device.confirm()
    social_user.refresh_from_db()
    return device


@pytest.fixture
def social_token(social_confirmed_device):
    return social_confirmed_device.get_totp().now()


# ---------------------------------------------------------------------------
# 1. Status endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_status_requires_auth(client):
    resp = client.get(STATUS_URL)
    assert resp.status_code == 401


@pytest.mark.django_db
def test_status_no_mfa_returns_disabled(auth_client):
    resp = auth_client.get(STATUS_URL)
    assert resp.status_code == 200
    assert resp.data["mfa_enabled"] is False
    assert resp.data["has_confirmed_device"] is False
    assert resp.data["recovery_codes_remaining"] == 0


@pytest.mark.django_db
def test_status_enabled_user(auth_client, user, confirmed_device):
    RecoveryCode.generate_codes_for_user(user, 10)
    resp = auth_client.get(STATUS_URL)
    assert resp.status_code == 200
    assert resp.data["mfa_enabled"] is True
    assert resp.data["has_confirmed_device"] is True
    assert resp.data["recovery_codes_remaining"] == 10


@pytest.mark.django_db
def test_status_remaining_count_correct(auth_client, user, confirmed_device):
    RecoveryCode.generate_codes_for_user(user, 3)
    resp = auth_client.get(STATUS_URL)
    assert resp.data["recovery_codes_remaining"] == 3


# ---------------------------------------------------------------------------
# 2. Setup endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_setup_requires_auth(client):
    resp = client.post(SETUP_URL)
    assert resp.status_code == 401


@pytest.mark.django_db
def test_setup_creates_mfa_device(auth_client, user):
    resp = auth_client.post(SETUP_URL)
    assert resp.status_code == 200
    assert UserMFADevice.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_setup_returns_provisioning_uri(auth_client):
    resp = auth_client.post(SETUP_URL)
    assert resp.status_code == 200
    assert "provisioning_uri" in resp.data
    assert "otpauth://" in resp.data["provisioning_uri"]


@pytest.mark.django_db
def test_setup_does_not_enable_mfa_yet(auth_client, user):
    auth_client.post(SETUP_URL)
    user.refresh_from_db()
    assert user.mfa_enabled is False


@pytest.mark.django_db
def test_setup_resets_unconfirmed_device(auth_client, user, device):
    old_secret = device.secret
    resp = auth_client.post(SETUP_URL)
    assert resp.status_code == 200
    new_device = UserMFADevice.objects.get(user=user)
    assert new_device.secret != old_secret
    assert not new_device.is_confirmed


@pytest.mark.django_db
def test_setup_returns_400_if_already_confirmed(auth_client, confirmed_device):
    resp = auth_client.post(SETUP_URL)
    assert resp.status_code == 400
    assert "already enabled" in resp.data["detail"]


# ---------------------------------------------------------------------------
# 3. Confirm endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_confirm_requires_auth(client):
    resp = client.post(CONFIRM_URL, {"token": "123456"}, format="json")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_confirm_valid_token_enables_mfa(auth_client, user, device, valid_token):
    resp = auth_client.post(CONFIRM_URL, {"token": valid_token}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.mfa_enabled is True


@pytest.mark.django_db
def test_confirm_sets_mfa_verified_at(auth_client, user, device, valid_token):
    auth_client.post(CONFIRM_URL, {"token": valid_token}, format="json")
    user.refresh_from_db()
    assert user.mfa_verified_at is not None


@pytest.mark.django_db
def test_confirm_generates_recovery_codes(auth_client, user, device, valid_token):
    auth_client.post(CONFIRM_URL, {"token": valid_token}, format="json")
    assert RecoveryCode.objects.filter(user=user).count() == 10


@pytest.mark.django_db
def test_confirm_returns_raw_recovery_codes_once(auth_client, device, valid_token):
    resp = auth_client.post(CONFIRM_URL, {"token": valid_token}, format="json")
    assert resp.status_code == 200
    assert "recovery_codes" in resp.data
    assert len(resp.data["recovery_codes"]) == 10


@pytest.mark.django_db
def test_confirm_invalid_token_returns_400(auth_client, device):
    resp = auth_client.post(CONFIRM_URL, {"token": "000000"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_confirm_without_setup_returns_400(auth_client):
    resp = auth_client.post(CONFIRM_URL, {"token": "123456"}, format="json")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 4. Recovery code behaviour
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_recovery_codes_are_stored_hashed(user):
    raw_codes = RecoveryCode.generate_codes_for_user(user, 3)
    stored = RecoveryCode.objects.filter(user=user)
    for code in stored:
        assert code.code_hash not in raw_codes


@pytest.mark.django_db
def test_raw_recovery_code_is_not_stored(user):
    raw_codes = RecoveryCode.generate_codes_for_user(user, 3)
    stored = list(
        RecoveryCode.objects.filter(user=user).values_list("code_hash", flat=True)
    )
    for raw in raw_codes:
        assert raw not in stored


@pytest.mark.django_db
def test_recovery_code_check_succeeds(user):
    raw_codes = RecoveryCode.generate_codes_for_user(user, 1)
    code_obj = RecoveryCode.objects.get(user=user)
    assert code_obj.check_code(raw_codes[0]) is True


@pytest.mark.django_db
def test_used_recovery_code_is_rejected(auth_client, user, confirmed_device):
    raw_codes = RecoveryCode.generate_codes_for_user(user, 1)
    code_obj = RecoveryCode.objects.get(user=user)
    code_obj.mark_used()

    resp = auth_client.post(
        DISABLE_URL,
        {"password": PASSWORD, "recovery_code": raw_codes[0]},
        format="json",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 5. Disable endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_disable_requires_auth(client):
    resp = client.post(DISABLE_URL, {}, format="json")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_disable_requires_correct_password(
    auth_client, user, confirmed_device, confirmed_valid_token
):
    resp = auth_client.post(
        DISABLE_URL,
        {"password": "WrongPass99!", "token": confirmed_valid_token},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "identity_verification_failed"


@pytest.mark.django_db
def test_disable_requires_token_or_recovery_code(auth_client, confirmed_device):
    resp = auth_client.post(DISABLE_URL, {"password": PASSWORD}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_disable_invalid_token_returns_400(auth_client, confirmed_device):
    resp = auth_client.post(
        DISABLE_URL,
        {"password": PASSWORD, "token": "000000"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_disable_with_valid_token_disables_mfa(
    auth_client, user, confirmed_device, confirmed_valid_token
):
    resp = auth_client.post(
        DISABLE_URL,
        {"password": PASSWORD, "token": confirmed_valid_token},
        format="json",
    )
    assert resp.status_code == 204
    user.refresh_from_db()
    assert user.mfa_enabled is False
    assert user.mfa_verified_at is None


@pytest.mark.django_db
def test_disable_deletes_device_and_codes(
    auth_client, user, confirmed_device, confirmed_valid_token
):
    RecoveryCode.generate_codes_for_user(user, 3)
    auth_client.post(
        DISABLE_URL,
        {"password": PASSWORD, "token": confirmed_valid_token},
        format="json",
    )
    assert not UserMFADevice.objects.filter(user=user).exists()
    assert not RecoveryCode.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_disable_with_valid_recovery_code(auth_client, user, confirmed_device):
    raw_codes = RecoveryCode.generate_codes_for_user(user, 3)
    resp = auth_client.post(
        DISABLE_URL,
        {"password": PASSWORD, "recovery_code": raw_codes[0]},
        format="json",
    )
    assert resp.status_code == 204
    user.refresh_from_db()
    assert user.mfa_enabled is False


# ---------------------------------------------------------------------------
# 6. Regenerate recovery codes
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_regen_requires_auth(client):
    resp = client.post(REGEN_URL, {}, format="json")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_regen_requires_identity_proof(
    auth_client, confirmed_device, confirmed_valid_token
):
    resp = auth_client.post(REGEN_URL, {"token": confirmed_valid_token}, format="json")
    assert resp.status_code == 400
    assert resp.data["code"] == "identity_verification_failed"


@pytest.mark.django_db
def test_regen_requires_token_or_recovery_code(auth_client, confirmed_device):
    resp = auth_client.post(REGEN_URL, {"password": PASSWORD}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_regen_returns_new_raw_codes(
    auth_client, confirmed_device, confirmed_valid_token
):
    resp = auth_client.post(
        REGEN_URL,
        {"password": PASSWORD, "token": confirmed_valid_token},
        format="json",
    )
    assert resp.status_code == 200
    assert "recovery_codes" in resp.data
    assert len(resp.data["recovery_codes"]) == 10


@pytest.mark.django_db
def test_regen_old_codes_cannot_be_used(auth_client, user, confirmed_device):
    old_raw = RecoveryCode.generate_codes_for_user(user, 3)
    new_token = confirmed_device.get_totp().now()

    auth_client.post(
        REGEN_URL,
        {"password": PASSWORD, "token": new_token},
        format="json",
    )

    # Old recovery codes should be gone — regeneration deleted and replaced them
    # Attempt disable with old code should fail
    user.refresh_from_db()  # mfa still enabled
    resp = auth_client.post(
        DISABLE_URL,
        {"password": PASSWORD, "recovery_code": old_raw[0]},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_regen_with_recovery_code_proof(auth_client, user, confirmed_device):
    raw_codes = RecoveryCode.generate_codes_for_user(user, 3)
    resp = auth_client.post(
        REGEN_URL,
        {"password": PASSWORD, "recovery_code": raw_codes[0]},
        format="json",
    )
    assert resp.status_code == 200
    assert len(resp.data["recovery_codes"]) == 10


# ---------------------------------------------------------------------------
# 7. Social re-auth — disable
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_social_disable_with_google_token(
    social_client, social_user, social_confirmed_device, social_token
):
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: GOOGLE_REAUTH_IDENTITY,
        )
        resp = social_client.post(
            DISABLE_URL,
            {
                "provider": "google",
                "access_token": "goog-access",
                "token": social_token,
            },
            format="json",
        )
    assert resp.status_code == 204
    social_user.refresh_from_db()
    assert social_user.mfa_enabled is False


@pytest.mark.django_db
def test_social_disable_with_microsoft_token(
    social_client, social_user, social_confirmed_device, social_token
):
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_microsoft_token",
            lambda **_: MICROSOFT_REAUTH_IDENTITY,
        )
        resp = social_client.post(
            DISABLE_URL,
            {
                "provider": "microsoft",
                "access_token": "ms-access",
                "token": social_token,
            },
            format="json",
        )
    assert resp.status_code == 204
    social_user.refresh_from_db()
    assert social_user.mfa_enabled is False


@pytest.mark.django_db
def test_social_disable_wrong_email_rejected(
    social_client, social_confirmed_device, social_token
):
    wrong_identity = {**GOOGLE_REAUTH_IDENTITY, "email": "other@example.com"}
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: wrong_identity,
        )
        resp = social_client.post(
            DISABLE_URL,
            {
                "provider": "google",
                "access_token": "goog-access",
                "token": social_token,
            },
            format="json",
        )
    assert resp.status_code == 400
    assert resp.data["code"] == "identity_verification_failed"


@pytest.mark.django_db
def test_social_disable_unverified_email_rejected(
    social_client, social_confirmed_device, social_token
):
    unverified = {**GOOGLE_REAUTH_IDENTITY, "email_verified": False}
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: unverified,
        )
        resp = social_client.post(
            DISABLE_URL,
            {
                "provider": "google",
                "access_token": "goog-access",
                "token": social_token,
            },
            format="json",
        )
    assert resp.status_code == 400
    assert resp.data["code"] == "identity_verification_failed"


@pytest.mark.django_db
def test_social_disable_with_recovery_code(
    social_client, social_user, social_confirmed_device
):
    raw_codes = RecoveryCode.generate_codes_for_user(social_user, 3)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: GOOGLE_REAUTH_IDENTITY,
        )
        resp = social_client.post(
            DISABLE_URL,
            {
                "provider": "google",
                "access_token": "goog-access",
                "recovery_code": raw_codes[0],
            },
            format="json",
        )
    assert resp.status_code == 204
    social_user.refresh_from_db()
    assert social_user.mfa_enabled is False


@pytest.mark.django_db
def test_social_disable_invalid_provider_rejected(
    social_client, social_confirmed_device, social_token
):
    resp = social_client.post(
        DISABLE_URL,
        {"provider": "twitter", "access_token": "tok", "token": social_token},
        format="json",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 8. Social re-auth — regenerate
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_social_regen_with_google_token(
    social_client, social_user, social_confirmed_device, social_token
):
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: GOOGLE_REAUTH_IDENTITY,
        )
        resp = social_client.post(
            REGEN_URL,
            {
                "provider": "google",
                "access_token": "goog-access",
                "token": social_token,
            },
            format="json",
        )
    assert resp.status_code == 200
    assert "recovery_codes" in resp.data
    assert len(resp.data["recovery_codes"]) == 10


@pytest.mark.django_db
def test_social_regen_wrong_email_rejected(
    social_client, social_confirmed_device, social_token
):
    wrong_identity = {**GOOGLE_REAUTH_IDENTITY, "email": "other@example.com"}
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: wrong_identity,
        )
        resp = social_client.post(
            REGEN_URL,
            {
                "provider": "google",
                "access_token": "goog-access",
                "token": social_token,
            },
            format="json",
        )
    assert resp.status_code == 400
    assert resp.data["code"] == "identity_verification_failed"


@pytest.mark.django_db
def test_social_regen_requires_mfa_proof(social_client, social_confirmed_device):
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: GOOGLE_REAUTH_IDENTITY,
        )
        resp = social_client.post(
            REGEN_URL,
            {"provider": "google", "access_token": "goog-access"},
            format="json",
        )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_social_regen_with_recovery_code_proof(
    social_client, social_user, social_confirmed_device
):
    raw_codes = RecoveryCode.generate_codes_for_user(social_user, 3)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "users.reauth.verify_google_token",
            lambda **_: GOOGLE_REAUTH_IDENTITY,
        )
        resp = social_client.post(
            REGEN_URL,
            {
                "provider": "google",
                "access_token": "goog-access",
                "recovery_code": raw_codes[0],
            },
            format="json",
        )
    assert resp.status_code == 200
    assert len(resp.data["recovery_codes"]) == 10


# ---------------------------------------------------------------------------
# 9. General
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_mfa_does_not_create_organization(auth_client, device, valid_token):
    auth_client.post(CONFIRM_URL, {"token": valid_token}, format="json")
    assert Organization.objects.count() == 0


@pytest.mark.django_db
def test_mfa_does_not_create_membership(auth_client, device, valid_token):
    auth_client.post(CONFIRM_URL, {"token": valid_token}, format="json")
    assert Membership.objects.count() == 0


@pytest.mark.django_db
def test_me_reflects_mfa_enabled(auth_client, device, valid_token):
    resp_before = auth_client.get(ME_URL)
    assert resp_before.data["mfa_enabled"] is False

    auth_client.post(CONFIRM_URL, {"token": valid_token}, format="json")

    resp_after = auth_client.get(ME_URL)
    assert resp_after.data["mfa_enabled"] is True
