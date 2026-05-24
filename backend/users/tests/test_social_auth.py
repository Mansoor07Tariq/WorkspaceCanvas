"""
Social auth tests — three layers:

1. View-level (mock verify_google_token / verify_microsoft_token at serializer import)
2. Google service unit tests (mock _get_json in social_auth)
3. Microsoft ID token unit tests (real RSA key pair + mocked OIDC/JWKS)
"""

import base64
import io
import time
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import Membership, Organization
from users.models import User
from users.social_auth import (
    SocialAuthError,
    _verify_microsoft_id_token,
    verify_google_token,
)

SOCIAL_URL = "/api/auth/social/"
ME_URL = "/api/auth/me/"

GOOGLE_IDENTITY = {
    "provider": "google",
    "provider_user_id": "google-uid-123",
    "email": "alice@example.com",
    "email_verified": True,
    "full_name": "Alice Smith",
    "first_name": "Alice",
    "last_name": "Smith",
    "locale": "en-US",
    "job_title": "",
    "avatar_bytes": None,
    "tenant_id": None,
}

MICROSOFT_IDENTITY = {
    "provider": "microsoft",
    "provider_user_id": "ms-oid-456",
    "email": "bob@example.com",
    "email_verified": True,
    "full_name": "Bob Jones",
    "first_name": "Bob",
    "last_name": "Jones",
    "locale": "en-GB",
    "job_title": "Senior Engineer",
    "avatar_bytes": None,
    "tenant_id": "tenant-abc",
}


def _make_jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


# ---------------------------------------------------------------------------
# RSA helpers for Microsoft ID token unit tests
# ---------------------------------------------------------------------------


def _int_to_base64url(n: int) -> str:
    n_bytes = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(n_bytes).rstrip(b"=").decode()


@pytest.fixture(scope="module")
def rsa_key_pair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


@pytest.fixture(scope="module")
def test_jwk(rsa_key_pair):
    _, pub = rsa_key_pair
    nums = pub.public_numbers()
    return {
        "kty": "RSA",
        "kid": "test-kid",
        "use": "sig",
        "alg": "RS256",
        "n": _int_to_base64url(nums.n),
        "e": _int_to_base64url(nums.e),
    }


def _make_ms_id_token(
    private_key,
    *,
    kid: str = "test-kid",
    aud: str = "test-client-id",
    iss: str = "https://login.microsoftonline.com/test-tid/v2.0",
    tid: str = "test-tid",
    email: str = "carol@example.com",
    name: str = "Carol Test",
    exp_offset: int = 3600,
):
    now = int(time.time())
    payload = {
        "oid": "test-oid-999",
        "email": email,
        "name": name,
        "aud": aud,
        "iss": iss,
        "tid": tid,
        "iat": now,
        "nbf": now,
        "exp": now + exp_offset,
    }
    return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": kid})


def _ms_metadata(tenant: str = "test-tid") -> dict:
    return {
        "issuer": f"https://login.microsoftonline.com/{tenant}/v2.0",
        "jwks_uri": "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    }


# ---------------------------------------------------------------------------
# 1. View-level integration tests (mock at serializer import)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_creates_new_user(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
    )
    assert resp.status_code == 200
    assert User.objects.filter(email="alice@example.com").exists()


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_returns_access_and_refresh_tokens(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert "refresh" in resp.data


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_sets_preferred_auth_provider(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user = User.objects.get(email="alice@example.com")
    assert user.preferred_auth_provider == User.AuthProvider.GOOGLE


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_sets_email_verified_true(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user = User.objects.get(email="alice@example.com")
    assert user.email_verified is True


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_links_existing_user_by_email(mock_verify, client):
    User.objects.create_user(
        username="alice@example.com", email="alice@example.com", password="x" * 10
    )
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    assert User.objects.filter(email="alice@example.com").count() == 1


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_marks_existing_unverified_user_verified(mock_verify, client):
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
        email_verified=False,
    )
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.email_verified is True
    assert user.email_verified_at is not None


@pytest.mark.django_db
@patch(
    "users.serializers.verify_google_token",
    side_effect=SocialAuthError(
        "Google did not return an email address.", code="missing_email"
    ),
)
def test_google_missing_email_returns_code(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "missing_email"


@pytest.mark.django_db
@patch(
    "users.serializers.verify_google_token",
    side_effect=SocialAuthError(
        "Google email address is not verified.", code="unverified_email"
    ),
)
def test_google_unverified_email_returns_code(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "unverified_email"


@pytest.mark.django_db
@patch(
    "users.serializers.verify_google_token",
    side_effect=SocialAuthError(
        "Google token audience is invalid.", code="invalid_audience"
    ),
)
def test_google_invalid_audience_returns_code(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "invalid_audience"


@pytest.mark.django_db
@patch(
    "users.serializers.verify_google_token",
    side_effect=SocialAuthError(
        "Could not reach identity provider.", code="provider_unavailable"
    ),
)
def test_google_provider_unavailable_returns_code(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "provider_unavailable"


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_access_token_creates_user(mock_verify, client):
    resp = client.post(
        SOCIAL_URL,
        {"provider": "microsoft", "access_token": "tok"},
        format="json",
    )
    assert resp.status_code == 200
    assert User.objects.filter(email="bob@example.com").exists()


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_access_token_returns_tokens(mock_verify, client):
    resp = client.post(
        SOCIAL_URL,
        {"provider": "microsoft", "access_token": "tok"},
        format="json",
    )
    assert "access" in resp.data
    assert "refresh" in resp.data


@pytest.mark.django_db
@patch(
    "users.serializers.verify_microsoft_token",
    side_effect=SocialAuthError(
        "Microsoft did not return an email address.", code="missing_email"
    ),
)
def test_microsoft_access_token_missing_email_returns_code(mock_verify, client):
    resp = client.post(
        SOCIAL_URL,
        {"provider": "microsoft", "access_token": "tok"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "missing_email"


@pytest.mark.django_db
@patch(
    "users.serializers.verify_microsoft_token",
    side_effect=SocialAuthError(
        "Could not reach identity provider.", code="provider_unavailable"
    ),
)
def test_microsoft_access_token_provider_unavailable_returns_code(mock_verify, client):
    resp = client.post(
        SOCIAL_URL,
        {"provider": "microsoft", "access_token": "tok"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["code"] == "provider_unavailable"


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_id_token_creates_user(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "microsoft", "id_token": "tok"}, format="json"
    )
    assert resp.status_code == 200
    assert User.objects.filter(email="bob@example.com").exists()


@pytest.mark.django_db
def test_invalid_provider_returns_400(client, db):
    resp = client.post(
        SOCIAL_URL, {"provider": "twitter", "access_token": "tok"}, format="json"
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_missing_token_returns_code(client, db):
    resp = client.post(SOCIAL_URL, {"provider": "google"}, format="json")
    assert resp.status_code == 400
    assert resp.data["code"] == "missing_token"


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_social_login_does_not_create_organization(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    assert Organization.objects.count() == 0


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_social_login_does_not_create_membership(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    assert Membership.objects.count() == 0


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_social_login_updates_last_login_ip(mock_verify, client):
    client.post(
        SOCIAL_URL,
        {"provider": "google", "id_token": "tok"},
        format="json",
        REMOTE_ADDR="10.0.0.1",
    )
    user = User.objects.get(email="alice@example.com")
    assert user.last_login_ip == "10.0.0.1"


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_me_endpoint_works_with_social_login_token(mock_verify, client):
    resp = client.post(
        SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    me_resp = client.get(ME_URL)
    assert me_resp.status_code == 200
    assert me_resp.data["email"] == "alice@example.com"


# ---------------------------------------------------------------------------
# Social name prefill tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_backfills_full_name_for_existing_user_with_blank_name(
    mock_verify, client
):
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
        full_name="",
    )
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.full_name == GOOGLE_IDENTITY["full_name"]


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_preserves_full_name_for_existing_user_with_name(mock_verify, client):
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
        full_name="Existing Name",
    )
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.full_name == "Existing Name"


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_backfills_full_name_for_existing_user_with_blank_name(
    mock_verify, client
):
    user = User.objects.create_user(
        username="bob@example.com",
        email="bob@example.com",
        password="x" * 10,
        full_name="",
    )
    client.post(SOCIAL_URL, {"provider": "microsoft", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.full_name == MICROSOFT_IDENTITY["full_name"]


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_preserves_full_name_for_existing_user_with_name(mock_verify, client):
    user = User.objects.create_user(
        username="bob@example.com",
        email="bob@example.com",
        password="x" * 10,
        full_name="Existing Name",
    )
    client.post(SOCIAL_URL, {"provider": "microsoft", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.full_name == "Existing Name"


# ---------------------------------------------------------------------------
# Social profile field backfill tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_new_user_gets_first_and_last_name(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user = User.objects.get(email="alice@example.com")
    assert user.first_name == GOOGLE_IDENTITY["first_name"]
    assert user.last_name == GOOGLE_IDENTITY["last_name"]


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_new_user_gets_locale(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user = User.objects.get(email="alice@example.com")
    assert user.locale == GOOGLE_IDENTITY["locale"]


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_backfills_first_last_name_for_existing_user_with_blank_names(
    mock_verify, client
):
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
        first_name="",
        last_name="",
    )
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.first_name == GOOGLE_IDENTITY["first_name"]
    assert user.last_name == GOOGLE_IDENTITY["last_name"]


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_google_preserves_first_last_name_for_existing_user(mock_verify, client):
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
        first_name="Alicia",
        last_name="Smythe",
    )
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.first_name == "Alicia"
    assert user.last_name == "Smythe"


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_new_user_gets_job_title(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "microsoft", "id_token": "tok"}, format="json")
    user = User.objects.get(email="bob@example.com")
    assert user.job_title == MICROSOFT_IDENTITY["job_title"]


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_new_user_gets_locale(mock_verify, client):
    client.post(SOCIAL_URL, {"provider": "microsoft", "id_token": "tok"}, format="json")
    user = User.objects.get(email="bob@example.com")
    assert user.locale == MICROSOFT_IDENTITY["locale"]


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_backfills_job_title_for_existing_user_with_blank_job_title(
    mock_verify, client
):
    user = User.objects.create_user(
        username="bob@example.com",
        email="bob@example.com",
        password="x" * 10,
        job_title="",
    )
    client.post(SOCIAL_URL, {"provider": "microsoft", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.job_title == MICROSOFT_IDENTITY["job_title"]


@pytest.mark.django_db
@patch("users.serializers.verify_microsoft_token", return_value=MICROSOFT_IDENTITY)
def test_microsoft_preserves_job_title_for_existing_user(mock_verify, client):
    user = User.objects.create_user(
        username="bob@example.com",
        email="bob@example.com",
        password="x" * 10,
        job_title="Director",
    )
    client.post(SOCIAL_URL, {"provider": "microsoft", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.job_title == "Director"


@pytest.mark.django_db
@patch("users.serializers.verify_google_token", return_value=GOOGLE_IDENTITY)
def test_locale_not_updated_when_user_has_non_default_locale(mock_verify, client):
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
        locale="en-IE",
    )
    client.post(SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json")
    user.refresh_from_db()
    assert user.locale == "en-IE"


# ---------------------------------------------------------------------------
# 2. Google service unit tests (mock _get_json)
# ---------------------------------------------------------------------------


def _google_ok_payload(*, email="alice@example.com", email_verified="true", aud="gid"):
    return {
        "sub": "google-sub-123",
        "email": email,
        "email_verified": email_verified,
        "name": "Alice Smith",
        "given_name": "Alice",
        "family_name": "Smith",
        "locale": "en-US",
        "aud": aud,
    }


@pytest.mark.django_db
@patch(
    "users.social_auth._get_json",
    return_value=_google_ok_payload(),
)
def test_google_service_valid_token_returns_identity(mock_get, settings):
    settings.GOOGLE_CLIENT_ID = ""
    result = verify_google_token(id_token="fake")
    assert result["email"] == "alice@example.com"
    assert result["email_verified"] is True
    assert result["provider"] == "google"
    assert result["first_name"] == "Alice"
    assert result["last_name"] == "Smith"
    assert result["locale"] == "en-US"


@pytest.mark.django_db
@patch(
    "users.social_auth._get_json",
    return_value={**_google_ok_payload(), "error": "invalid_token"},
)
def test_google_service_invalid_token_raises(mock_get, settings):
    settings.GOOGLE_CLIENT_ID = ""
    with pytest.raises(SocialAuthError) as exc_info:
        verify_google_token(id_token="bad")
    assert exc_info.value.code == "invalid_token"


@pytest.mark.django_db
@patch(
    "users.social_auth._get_json",
    return_value={**_google_ok_payload(aud="wrong-client"), "email_verified": "true"},
)
def test_google_service_audience_mismatch_raises(mock_get, settings):
    settings.GOOGLE_CLIENT_ID = "correct-client"
    with pytest.raises(SocialAuthError) as exc_info:
        verify_google_token(id_token="tok")
    assert exc_info.value.code == "invalid_audience"


@pytest.mark.django_db
@patch(
    "users.social_auth._get_json",
    return_value=_google_ok_payload(email_verified="false"),
)
def test_google_service_unverified_email_raises(mock_get, settings):
    settings.GOOGLE_CLIENT_ID = ""
    with pytest.raises(SocialAuthError) as exc_info:
        verify_google_token(id_token="tok")
    assert exc_info.value.code == "unverified_email"


@pytest.mark.django_db
@patch(
    "users.social_auth._get_json",
    return_value={k: v for k, v in _google_ok_payload().items() if k != "email"},
)
def test_google_service_missing_email_raises(mock_get, settings):
    settings.GOOGLE_CLIENT_ID = ""
    with pytest.raises(SocialAuthError) as exc_info:
        verify_google_token(id_token="tok")
    assert exc_info.value.code == "missing_email"


# ---------------------------------------------------------------------------
# 3. Microsoft ID token unit tests (real RSA + mocked OIDC/JWKS)
# ---------------------------------------------------------------------------


@pytest.fixture
def ms_settings(settings):
    settings.MICROSOFT_CLIENT_ID = "test-client-id"
    settings.MICROSOFT_TENANT_ID = "common"
    return settings


@pytest.mark.django_db
def test_microsoft_id_token_valid_creates_identity(rsa_key_pair, test_jwk, ms_settings):
    private_key, _ = rsa_key_pair
    token = _make_ms_id_token(private_key)
    metadata = {
        "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
        "jwks_uri": "https://example.com/jwks",
    }
    jwks = {"keys": [test_jwk]}
    with patch("users.social_auth._get_microsoft_oidc_metadata", return_value=metadata):
        with patch("users.social_auth._get_microsoft_jwks", return_value=jwks):
            result = _verify_microsoft_id_token(token)
    assert result["email"] == "carol@example.com"
    assert result["email_verified"] is True
    assert result["tenant_id"] == "test-tid"
    assert result["provider"] == "microsoft"


@pytest.mark.django_db
def test_microsoft_id_token_validates_audience(rsa_key_pair, test_jwk, ms_settings):
    private_key, _ = rsa_key_pair
    token = _make_ms_id_token(private_key, aud="wrong-audience")
    metadata = {
        "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
        "jwks_uri": "https://example.com/jwks",
    }
    jwks = {"keys": [test_jwk]}
    with patch("users.social_auth._get_microsoft_oidc_metadata", return_value=metadata):
        with patch("users.social_auth._get_microsoft_jwks", return_value=jwks):
            with pytest.raises(SocialAuthError) as exc_info:
                _verify_microsoft_id_token(token)
    assert exc_info.value.code == "invalid_audience"


@pytest.mark.django_db
def test_microsoft_id_token_invalid_issuer_raises(rsa_key_pair, test_jwk, ms_settings):
    private_key, _ = rsa_key_pair
    token = _make_ms_id_token(private_key, iss="https://evil.example.com")
    metadata = {
        "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
        "jwks_uri": "https://example.com/jwks",
    }
    jwks = {"keys": [test_jwk]}
    with patch("users.social_auth._get_microsoft_oidc_metadata", return_value=metadata):
        with patch("users.social_auth._get_microsoft_jwks", return_value=jwks):
            with pytest.raises(SocialAuthError) as exc_info:
                _verify_microsoft_id_token(token)
    assert exc_info.value.code == "invalid_issuer"


@pytest.mark.django_db
def test_microsoft_id_token_expired_raises(rsa_key_pair, test_jwk, ms_settings):
    private_key, _ = rsa_key_pair
    token = _make_ms_id_token(private_key, exp_offset=-3600)
    metadata = {
        "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
        "jwks_uri": "https://example.com/jwks",
    }
    jwks = {"keys": [test_jwk]}
    with patch("users.social_auth._get_microsoft_oidc_metadata", return_value=metadata):
        with patch("users.social_auth._get_microsoft_jwks", return_value=jwks):
            with pytest.raises(SocialAuthError) as exc_info:
                _verify_microsoft_id_token(token)
    assert exc_info.value.code == "expired_token"


@pytest.mark.django_db
def test_microsoft_id_token_missing_email_raises(rsa_key_pair, test_jwk, ms_settings):
    private_key, _ = rsa_key_pair
    metadata = {
        "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
        "jwks_uri": "https://example.com/jwks",
    }
    jwks = {"keys": [test_jwk]}

    # PyJWT will encode an empty string but we need to strip the email key entirely
    # to trigger the missing_email path — rebuild the token without the email claim
    now = int(time.time())
    payload = {
        "oid": "test-oid-999",
        "name": "Carol Test",
        "aud": "test-client-id",
        "iss": "https://login.microsoftonline.com/test-tid/v2.0",
        "tid": "test-tid",
        "iat": now,
        "nbf": now,
        "exp": now + 3600,
    }
    no_email_token = jwt.encode(
        payload, private_key, algorithm="RS256", headers={"kid": "test-kid"}
    )
    with patch("users.social_auth._get_microsoft_oidc_metadata", return_value=metadata):
        with patch("users.social_auth._get_microsoft_jwks", return_value=jwks):
            with pytest.raises(SocialAuthError) as exc_info:
                _verify_microsoft_id_token(no_email_token)
    assert exc_info.value.code == "missing_email"


@pytest.mark.django_db
def test_microsoft_id_token_unknown_kid_raises(rsa_key_pair, test_jwk, ms_settings):
    private_key, _ = rsa_key_pair
    # Sign with our key but JWKS returns a different kid
    token = _make_ms_id_token(private_key, kid="test-kid")
    metadata = {
        "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
        "jwks_uri": "https://example.com/jwks",
    }
    jwks = {"keys": [{**test_jwk, "kid": "different-kid"}]}
    with patch("users.social_auth._get_microsoft_oidc_metadata", return_value=metadata):
        with patch("users.social_auth._get_microsoft_jwks", return_value=jwks):
            with pytest.raises(SocialAuthError) as exc_info:
                _verify_microsoft_id_token(token)
    assert exc_info.value.code == "invalid_token"


# ---------------------------------------------------------------------------
# Social avatar backfill tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_new_user_gets_avatar_when_provider_supplies_bytes(client):
    identity = {**GOOGLE_IDENTITY, "avatar_bytes": _make_jpeg_bytes()}
    with patch("users.serializers.verify_google_token", return_value=identity):
        resp = client.post(
            SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
        )
    assert resp.status_code == 200
    user = User.objects.get(email="alice@example.com")
    assert bool(user.avatar)


@pytest.mark.django_db
def test_existing_user_without_avatar_gets_avatar_backfilled(client):
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
    )
    assert not user.avatar
    identity = {**GOOGLE_IDENTITY, "avatar_bytes": _make_jpeg_bytes()}
    with patch("users.serializers.verify_google_token", return_value=identity):
        client.post(
            SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
        )
    user.refresh_from_db()
    assert bool(user.avatar)


@pytest.mark.django_db
def test_existing_user_with_avatar_is_not_overwritten(client, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    user = User.objects.create_user(
        username="alice@example.com",
        email="alice@example.com",
        password="x" * 10,
    )
    from django.core.files.base import ContentFile

    user.avatar.save("existing.jpg", ContentFile(_make_jpeg_bytes()), save=True)
    original_name = user.avatar.name

    identity = {**GOOGLE_IDENTITY, "avatar_bytes": _make_jpeg_bytes()}
    with patch("users.serializers.verify_google_token", return_value=identity):
        client.post(
            SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
        )
    user.refresh_from_db()
    assert user.avatar.name == original_name


@pytest.mark.django_db
def test_invalid_avatar_bytes_does_not_prevent_user_creation(client):
    identity = {**GOOGLE_IDENTITY, "avatar_bytes": b"not-an-image"}
    with patch("users.serializers.verify_google_token", return_value=identity):
        resp = client.post(
            SOCIAL_URL, {"provider": "google", "id_token": "tok"}, format="json"
        )
    assert resp.status_code == 200
    user = User.objects.get(email="alice@example.com")
    assert not user.avatar
