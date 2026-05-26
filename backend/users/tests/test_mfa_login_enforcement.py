"""
MFA login enforcement tests.

1. Email/password login — MFA gate
2. Social auth login — MFA gate
3. Challenge verification
4. Security / cross-cutting
"""

from datetime import timedelta
from unittest.mock import patch

import pyotp
import pytest
from django.conf import settings as django_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership, Organization
from users.models import MFALoginChallenge, RecoveryCode, User, UserMFADevice

TOKEN_URL = "/api/auth/token/"
SOCIAL_URL = "/api/auth/social/"
CHALLENGE_VERIFY_URL = "/api/auth/mfa/challenge/verify/"
ME_URL = "/api/auth/me/"

PASSWORD = "SuperSecret99!"
SOCIAL_EMAIL = "carol@example.com"
GOOGLE_IDENTITY = {
    "email": SOCIAL_EMAIL,
    "email_verified": True,
    "sub": "google-uid-789",
    "provider": "google",
    "full_name": "Carol Test",
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
def mfa_user(db):
    u = User.objects.create_user(
        username="bob@example.com",
        email="bob@example.com",
        password=PASSWORD,
        email_verified=True,
        preferred_auth_provider=User.AuthProvider.EMAIL,
        mfa_enabled=True,
    )
    secret = pyotp.random_base32()
    device = UserMFADevice.objects.create(
        user=u, secret=secret, confirmed_at=timezone.now()
    )
    u._test_device = device
    return u


@pytest.fixture
def mfa_user_token(mfa_user):
    return mfa_user._test_device.get_totp().now()


@pytest.fixture
def challenge(mfa_user):
    return MFALoginChallenge.create_for_user(mfa_user)


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
def social_mfa_user(db):
    u = User.objects.create_user(
        username=SOCIAL_EMAIL,
        email=SOCIAL_EMAIL,
        password=None,
        email_verified=True,
        preferred_auth_provider=User.AuthProvider.GOOGLE,
        mfa_enabled=True,
    )
    secret = pyotp.random_base32()
    device = UserMFADevice.objects.create(
        user=u, secret=secret, confirmed_at=timezone.now()
    )
    u._test_device = device
    return u


# ---------------------------------------------------------------------------
# 1. Email/password login — MFA gate
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_login_without_mfa_returns_tokens(client, user):
    resp = client.post(
        TOKEN_URL, {"email": user.email, "password": PASSWORD}, format="json"
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert django_settings.AUTH_COOKIE_NAME in resp.cookies
    assert "mfa_required" not in resp.data


@pytest.mark.django_db
def test_login_with_mfa_returns_challenge(client, mfa_user):
    resp = client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": PASSWORD}, format="json"
    )
    assert resp.status_code == 200
    assert resp.data["mfa_required"] is True
    assert "challenge_id" in resp.data
    assert resp.data["detail"] == "MFA verification required."


@pytest.mark.django_db
def test_login_with_mfa_does_not_return_tokens(client, mfa_user):
    resp = client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": PASSWORD}, format="json"
    )
    assert "access" not in resp.data
    assert "refresh" not in resp.data


@pytest.mark.django_db
def test_login_creates_challenge_record(client, mfa_user):
    client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": PASSWORD}, format="json"
    )
    assert MFALoginChallenge.objects.filter(user=mfa_user).exists()


@pytest.mark.django_db
def test_wrong_password_does_not_create_challenge(client, mfa_user):
    client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": "Wrong99!"}, format="json"
    )
    assert not MFALoginChallenge.objects.filter(user=mfa_user).exists()


@pytest.mark.django_db
def test_inactive_user_does_not_create_challenge(client, mfa_user):
    mfa_user.is_active = False
    mfa_user.save(update_fields=["is_active"])
    client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": PASSWORD}, format="json"
    )
    assert not MFALoginChallenge.objects.filter(user=mfa_user).exists()


# ---------------------------------------------------------------------------
# 2. Social auth login — MFA gate
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_social_login_without_mfa_returns_tokens(client, social_user):
    with patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY):
        resp = client.post(
            SOCIAL_URL,
            {"provider": "google", "access_token": "tok"},
            format="json",
        )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert django_settings.AUTH_COOKIE_NAME in resp.cookies
    assert "mfa_required" not in resp.data


@pytest.mark.django_db
def test_social_login_with_mfa_returns_challenge(client, social_mfa_user):
    with patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY):
        resp = client.post(
            SOCIAL_URL,
            {"provider": "google", "access_token": "tok"},
            format="json",
        )
    assert resp.status_code == 200
    assert resp.data["mfa_required"] is True
    assert "challenge_id" in resp.data
    assert resp.data["email"] == SOCIAL_EMAIL


@pytest.mark.django_db
def test_social_login_with_mfa_does_not_return_tokens(client, social_mfa_user):
    with patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY):
        resp = client.post(
            SOCIAL_URL,
            {"provider": "google", "access_token": "tok"},
            format="json",
        )
    assert "access" not in resp.data
    assert "refresh" not in resp.data


@pytest.mark.django_db
def test_social_login_invalid_token_does_not_create_challenge(client, social_mfa_user):
    from users.social_auth import SocialAuthError

    with patch(
        "users.serializers.verify_google_token",
        side_effect=SocialAuthError("bad token", code="invalid_token"),
    ):
        client.post(
            SOCIAL_URL,
            {"provider": "google", "access_token": "bad"},
            format="json",
        )
    assert not MFALoginChallenge.objects.filter(user=social_mfa_user).exists()


@pytest.mark.django_db
def test_social_login_mfa_does_not_create_organization(client, social_mfa_user):
    with patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY):
        client.post(
            SOCIAL_URL,
            {"provider": "google", "access_token": "tok"},
            format="json",
        )
    assert Organization.objects.count() == 0


@pytest.mark.django_db
def test_social_login_mfa_does_not_create_membership(client, social_mfa_user):
    with patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY):
        client.post(
            SOCIAL_URL,
            {"provider": "google", "access_token": "tok"},
            format="json",
        )
    assert Membership.objects.count() == 0


# ---------------------------------------------------------------------------
# 3. Challenge verification
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_challenge_verify_does_not_require_auth(client, challenge, mfa_user_token):
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": mfa_user_token},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_valid_challenge_totp_returns_tokens(client, challenge, mfa_user_token):
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": mfa_user_token},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert django_settings.AUTH_COOKIE_NAME in resp.cookies


@pytest.mark.django_db
def test_valid_challenge_recovery_code_returns_tokens(client, mfa_user, challenge):
    raw_codes = RecoveryCode.generate_codes_for_user(mfa_user, 3)
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "recovery_code": raw_codes[0]},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data


@pytest.mark.django_db
def test_recovery_code_used_during_challenge_is_marked_used(
    client, mfa_user, challenge
):
    raw_codes = RecoveryCode.generate_codes_for_user(mfa_user, 1)
    client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "recovery_code": raw_codes[0]},
        format="json",
    )
    code_obj = RecoveryCode.objects.get(user=mfa_user)
    assert code_obj.is_used


@pytest.mark.django_db
def test_used_recovery_code_cannot_be_reused(client, mfa_user):
    raw_codes = RecoveryCode.generate_codes_for_user(mfa_user, 1)
    challenge1 = MFALoginChallenge.create_for_user(mfa_user)
    client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge1.challenge_id), "recovery_code": raw_codes[0]},
        format="json",
    )
    challenge2 = MFALoginChallenge.create_for_user(mfa_user)
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge2.challenge_id), "recovery_code": raw_codes[0]},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_challenge_is_marked_used_after_success(client, challenge, mfa_user_token):
    client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": mfa_user_token},
        format="json",
    )
    challenge.refresh_from_db()
    assert challenge.is_used


@pytest.mark.django_db
def test_used_challenge_cannot_be_reused(client, mfa_user, mfa_user_token):
    challenge = MFALoginChallenge.create_for_user(mfa_user)
    client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": mfa_user_token},
        format="json",
    )
    new_token = mfa_user._test_device.get_totp().now()
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": new_token},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"][0] == "used_mfa_challenge"


@pytest.mark.django_db
def test_expired_challenge_returns_error(client, mfa_user, mfa_user_token):
    challenge = MFALoginChallenge.create_for_user(mfa_user)
    challenge.expires_at = timezone.now() - timedelta(minutes=1)
    challenge.save(update_fields=["expires_at"])
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": mfa_user_token},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"][0] == "expired_mfa_challenge"


@pytest.mark.django_db
def test_unknown_challenge_returns_error(client):
    import uuid

    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(uuid.uuid4()), "token": "123456"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"][0] == "invalid_mfa_challenge"


@pytest.mark.django_db
def test_missing_mfa_proof_returns_error(client, challenge):
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id)},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"][0] == "missing_mfa_proof"


@pytest.mark.django_db
def test_invalid_totp_returns_error(client, challenge):
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": "000000"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"][0] == "invalid_mfa_proof"


@pytest.mark.django_db
def test_invalid_recovery_code_returns_error(client, mfa_user, challenge):
    RecoveryCode.generate_codes_for_user(mfa_user, 3)
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "recovery_code": "notavalidcode"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"][0] == "invalid_mfa_proof"


@pytest.mark.django_db
def test_me_works_with_token_from_challenge(client, challenge, mfa_user_token):
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": mfa_user_token},
        format="json",
    )
    access = resp.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me_resp = client.get(ME_URL)
    assert me_resp.status_code == 200
    assert me_resp.data["email"] == "bob@example.com"


# ---------------------------------------------------------------------------
# 4. Security / cross-cutting
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_challenge_belongs_to_correct_user(client, mfa_user):
    resp = client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": PASSWORD}, format="json"
    )
    challenge_id = resp.data["challenge_id"]
    challenge = MFALoginChallenge.objects.get(challenge_id=challenge_id)
    assert challenge.user == mfa_user


@pytest.mark.django_db
def test_cannot_use_other_users_totp_for_challenge(client, mfa_user, db):
    other = User.objects.create_user(
        username="other@example.com",
        email="other@example.com",
        password=PASSWORD,
        email_verified=True,
        mfa_enabled=True,
    )
    other_secret = pyotp.random_base32()
    other_device = UserMFADevice.objects.create(
        user=other, secret=other_secret, confirmed_at=timezone.now()
    )
    other_token = other_device.get_totp().now()

    challenge = MFALoginChallenge.create_for_user(mfa_user)
    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "token": other_token},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_cannot_use_other_users_recovery_code_for_challenge(client, challenge):
    user_b = User.objects.create_user(
        username="userb@example.com",
        email="userb@example.com",
        password=PASSWORD,
        email_verified=True,
        mfa_enabled=True,
    )
    raw_codes = RecoveryCode.generate_codes_for_user(user_b, 3)

    resp = client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": str(challenge.challenge_id), "recovery_code": raw_codes[0]},
        format="json",
    )

    assert resp.status_code == 400
    assert resp.data["code"][0] == "invalid_mfa_proof"

    assert not RecoveryCode.objects.filter(user=user_b, used_at__isnull=False).exists()

    challenge.refresh_from_db()
    assert not challenge.is_used


@pytest.mark.django_db
def test_login_enforcement_does_not_create_organization(
    client, mfa_user, mfa_user_token
):
    resp = client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": PASSWORD}, format="json"
    )
    challenge_id = resp.data["challenge_id"]
    client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": challenge_id, "token": mfa_user_token},
        format="json",
    )
    assert Organization.objects.count() == 0


@pytest.mark.django_db
def test_login_enforcement_does_not_create_membership(client, mfa_user, mfa_user_token):
    resp = client.post(
        TOKEN_URL, {"email": mfa_user.email, "password": PASSWORD}, format="json"
    )
    challenge_id = resp.data["challenge_id"]
    client.post(
        CHALLENGE_VERIFY_URL,
        {"challenge_id": challenge_id, "token": mfa_user_token},
        format="json",
    )
    assert Membership.objects.count() == 0
