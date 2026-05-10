import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import Membership, Organization

User = get_user_model()

TOKEN_URL = "/api/auth/token/"
REFRESH_URL = "/api/auth/token/refresh/"
VERIFY_URL = "/api/auth/token/verify/"
LOGOUT_URL = "/api/auth/logout/"
ME_URL = "/api/auth/me/"


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def active_user(db):
    return User.objects.create_user(
        username="jane@example.com",
        email="jane@example.com",
        password="strongpass123",
    )


@pytest.fixture
def inactive_user(db):
    return User.objects.create_user(
        username="inactive@example.com",
        email="inactive@example.com",
        password="strongpass123",
        is_active=False,
    )


@pytest.fixture
def tokens(client, active_user):
    response = client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "strongpass123"},
        format="json",
    )
    return response.data


# --- Token login ---


@pytest.mark.django_db
def test_active_user_can_login(client, active_user):
    response = client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "strongpass123"},
        format="json",
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_login_returns_access_token(client, active_user):
    response = client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "strongpass123"},
        format="json",
    )
    assert "access" in response.data


@pytest.mark.django_db
def test_login_returns_refresh_token(client, active_user):
    response = client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "strongpass123"},
        format="json",
    )
    assert "refresh" in response.data


@pytest.mark.django_db
def test_login_wrong_password_fails(client, active_user):
    response = client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "wrongpassword"},
        format="json",
    )
    assert response.status_code in [400, 401]


@pytest.mark.django_db
def test_login_unknown_email_fails(client, db):
    response = client.post(
        TOKEN_URL,
        {"email": "noone@example.com", "password": "pass"},
        format="json",
    )
    assert response.status_code in [400, 401]


@pytest.mark.django_db
def test_inactive_user_cannot_login(client, inactive_user):
    response = client.post(
        TOKEN_URL,
        {"email": "inactive@example.com", "password": "strongpass123"},
        format="json",
    )
    assert response.status_code in [400, 401]


@pytest.mark.django_db
def test_login_sets_preferred_auth_provider_if_blank(client, active_user):
    assert active_user.preferred_auth_provider == ""
    client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "strongpass123"},
        format="json",
    )
    active_user.refresh_from_db()
    assert active_user.preferred_auth_provider == "email"


@pytest.mark.django_db
def test_login_does_not_overwrite_preferred_auth_provider(client, active_user):
    active_user.preferred_auth_provider = "google"
    active_user.save(update_fields=["preferred_auth_provider"])

    client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "strongpass123"},
        format="json",
    )
    active_user.refresh_from_db()
    assert active_user.preferred_auth_provider == "google"


@pytest.mark.django_db
def test_login_updates_last_login_ip(client, active_user):
    client.post(
        TOKEN_URL,
        {"email": "jane@example.com", "password": "strongpass123"},
        format="json",
        REMOTE_ADDR="192.168.1.1",
    )
    active_user.refresh_from_db()
    assert active_user.last_login_ip == "192.168.1.1"


# --- Token refresh ---


@pytest.mark.django_db
def test_refresh_returns_new_access_token(client, tokens):
    response = client.post(REFRESH_URL, {"refresh": tokens["refresh"]}, format="json")
    assert response.status_code == 200
    assert "access" in response.data


# --- Token verify ---


@pytest.mark.django_db
def test_valid_access_token_verifies(client, tokens):
    response = client.post(VERIFY_URL, {"token": tokens["access"]}, format="json")
    assert response.status_code == 200


# --- Current user ---


@pytest.mark.django_db
def test_unauthenticated_me_returns_401(client):
    response = client.get(ME_URL)
    assert response.status_code == 401


@pytest.mark.django_db
def test_authenticated_me_returns_user_profile(client, tokens, active_user):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = client.get(ME_URL)
    assert response.status_code == 200
    assert response.data["email"] == active_user.email


@pytest.mark.django_db
def test_authenticated_me_includes_memberships(client, tokens, active_user):
    org = Organization.objects.create(
        name="Test Org",
        slug="test-org",
        organization_type="company",
        status="active",
    )
    Membership.objects.create(
        user=active_user,
        organization=org,
        role="owner",
        status="active",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = client.get(ME_URL)
    assert response.status_code == 200
    assert len(response.data["memberships"]) == 1
    assert response.data["memberships"][0]["organization_name"] == "Test Org"


# --- Logout ---


@pytest.mark.django_db
def test_authenticated_user_can_logout(client, tokens):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = client.post(LOGOUT_URL, {"refresh": tokens["refresh"]}, format="json")
    assert response.status_code == 204


@pytest.mark.django_db
def test_logout_with_invalid_token_returns_400(client, tokens):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = client.post(LOGOUT_URL, {"refresh": "not-a-valid-token"}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_blacklisted_refresh_token_cannot_be_reused(client, tokens):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    client.post(LOGOUT_URL, {"refresh": tokens["refresh"]}, format="json")
    client.credentials()
    response = client.post(REFRESH_URL, {"refresh": tokens["refresh"]}, format="json")
    assert response.status_code in [400, 401]
