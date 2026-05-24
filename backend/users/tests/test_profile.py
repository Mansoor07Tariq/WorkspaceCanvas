import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

ME_URL = "/api/auth/me/"


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="test@example.com",
        email="test@example.com",
        password="Testpass1!",
        full_name="",
        is_profile_completed=False,
    )


@pytest.fixture
def completed_user(db):
    return User.objects.create_user(
        username="done@example.com",
        email="done@example.com",
        password="Testpass1!",
        full_name="Jane Smith",
        is_profile_completed=True,
    )


@pytest.fixture
def auth_client(client, user):
    token = RefreshToken.for_user(user)
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {str(token.access_token)}"
    return client


@pytest.fixture
def completed_auth_client(client, completed_user):
    token = RefreshToken.for_user(completed_user)
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {str(token.access_token)}"
    return client


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_patch_profile_requires_auth(client):
    resp = client.patch(ME_URL, {"full_name": "Jane"}, content_type="application/json")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# full_name validation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_profile_empty_full_name_returns_400(auth_client):
    resp = auth_client.patch(ME_URL, {"full_name": ""}, content_type="application/json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_patch_profile_whitespace_only_full_name_returns_400(auth_client):
    resp = auth_client.patch(
        ME_URL, {"full_name": "   "}, content_type="application/json"
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Successful full profile update
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_profile_updates_full_name(auth_client, user):
    auth_client.patch(
        ME_URL, {"full_name": "Jane Smith"}, content_type="application/json"
    )
    user.refresh_from_db()
    assert user.full_name == "Jane Smith"


@pytest.mark.django_db
def test_patch_profile_sets_is_profile_completed(auth_client, user):
    auth_client.patch(
        ME_URL, {"full_name": "Jane Smith"}, content_type="application/json"
    )
    user.refresh_from_db()
    assert user.is_profile_completed is True


@pytest.mark.django_db
def test_patch_profile_trims_whitespace_from_full_name(auth_client, user):
    auth_client.patch(
        ME_URL, {"full_name": "  Jane Smith  "}, content_type="application/json"
    )
    user.refresh_from_db()
    assert user.full_name == "Jane Smith"


@pytest.mark.django_db
def test_patch_profile_returns_updated_user_serialized(auth_client):
    resp = auth_client.patch(
        ME_URL, {"full_name": "Jane"}, content_type="application/json"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Jane"
    assert data["is_profile_completed"] is True
    assert "email" in data
    assert "memberships" in data


@pytest.mark.django_db
def test_patch_profile_updates_optional_fields(auth_client, user):
    resp = auth_client.patch(
        ME_URL,
        {
            "full_name": "Jane",
            "job_title": "Engineer",
            "phone_number": "+1234567890",
            "timezone": "America/New_York",
            "locale": "en-US",
        },
        content_type="application/json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.job_title == "Engineer"
    assert user.phone_number == "+1234567890"
    assert user.timezone == "America/New_York"
    assert user.locale == "en-US"


@pytest.mark.django_db
def test_patch_profile_partial_does_not_clear_unmentioned_fields(auth_client, user):
    user.job_title = "Manager"
    user.save()
    auth_client.patch(ME_URL, {"full_name": "Jane"}, content_type="application/json")
    user.refresh_from_db()
    assert user.job_title == "Manager"


@pytest.mark.django_db
def test_patch_profile_trims_job_title(auth_client, user):
    auth_client.patch(
        ME_URL,
        {"full_name": "Jane", "job_title": "  Engineer  "},
        content_type="application/json",
    )
    user.refresh_from_db()
    assert user.job_title == "Engineer"


# ---------------------------------------------------------------------------
# phone_number — trimming and format
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_profile_trims_phone_number(auth_client, user):
    auth_client.patch(
        ME_URL,
        {"full_name": "Jane", "phone_number": "  0871234567  "},
        content_type="application/json",
    )
    user.refresh_from_db()
    assert user.phone_number == "0871234567"


@pytest.mark.django_db
def test_patch_profile_accepts_valid_phone_number(auth_client):
    for phone in [
        "0871234567",
        "+353 87 123 4567",
        "(087) 123-4567",
        "+1-800-555-0100",
    ]:
        resp = auth_client.patch(
            ME_URL,
            {"full_name": "Jane", "phone_number": phone},
            content_type="application/json",
        )
        assert resp.status_code == 200, (
            f"Expected 200 for phone '{phone}', got {resp.status_code}"
        )


@pytest.mark.django_db
def test_patch_profile_rejects_invalid_phone_number(auth_client):
    for phone in ["087hello", "abcdef", "<script>alert(1)</script>"]:
        resp = auth_client.patch(
            ME_URL,
            {"full_name": "Jane", "phone_number": phone},
            content_type="application/json",
        )
        assert resp.status_code == 400, (
            f"Expected 400 for phone '{phone}', got {resp.status_code}"
        )


@pytest.mark.django_db
def test_patch_profile_allows_empty_phone_number(auth_client):
    resp = auth_client.patch(
        ME_URL,
        {"full_name": "Jane", "phone_number": ""},
        content_type="application/json",
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Optional-only update on a completed profile
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_optional_fields_only_on_completed_profile(
    completed_auth_client, completed_user
):
    resp = completed_auth_client.patch(
        ME_URL,
        {"job_title": "Senior Engineer"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    completed_user.refresh_from_db()
    assert completed_user.job_title == "Senior Engineer"
    assert completed_user.full_name == "Jane Smith"
    assert completed_user.is_profile_completed is True


# ---------------------------------------------------------------------------
# timezone validation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_profile_accepts_valid_timezone(auth_client):
    for tz in ["UTC", "Europe/Dublin", "America/New_York", "Asia/Karachi"]:
        resp = auth_client.patch(
            ME_URL,
            {"full_name": "Jane", "timezone": tz},
            content_type="application/json",
        )
        assert resp.status_code == 200, f"Expected 200 for timezone '{tz}'"


@pytest.mark.django_db
def test_patch_profile_rejects_invalid_timezone(auth_client):
    for tz in ["not-a-timezone", "Europe/Fake", "UTC+5", "random"]:
        resp = auth_client.patch(
            ME_URL,
            {"full_name": "Jane", "timezone": tz},
            content_type="application/json",
        )
        assert resp.status_code == 400, f"Expected 400 for timezone '{tz}'"


# ---------------------------------------------------------------------------
# locale validation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_profile_accepts_valid_locale(auth_client):
    for locale in ["en", "en-IE", "en-GB", "en-US"]:
        resp = auth_client.patch(
            ME_URL,
            {"full_name": "Jane", "locale": locale},
            content_type="application/json",
        )
        assert resp.status_code == 200, f"Expected 200 for locale '{locale}'"


@pytest.mark.django_db
def test_patch_profile_rejects_invalid_locale(auth_client):
    for locale in ["random-locale", "abc", "<script>", "fr", "de"]:
        resp = auth_client.patch(
            ME_URL,
            {"full_name": "Jane", "locale": locale},
            content_type="application/json",
        )
        assert resp.status_code == 400, f"Expected 400 for locale '{locale}'"
