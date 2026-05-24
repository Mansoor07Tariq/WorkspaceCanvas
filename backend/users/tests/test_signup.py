import uuid
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import EmailVerificationToken, User

SIGNUP_URL = "/api/auth/signup/"
VERIFY_URL = "/api/auth/verify-email/"
RESEND_URL = "/api/auth/resend-verification/"


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    return APIClient()


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_signup_creates_user(client):
    resp = client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "Strongpass1!"},
        format="json",
    )
    assert resp.status_code == 201
    assert User.objects.filter(email="new@example.com").exists()


@pytest.mark.django_db
def test_signup_normalises_email_to_lowercase(client):
    client.post(
        SIGNUP_URL,
        {"email": "New@Example.COM", "password": "Strongpass1!"},
        format="json",
    )
    assert User.objects.filter(email="new@example.com").exists()


@pytest.mark.django_db
def test_signup_sends_verification_email(client):
    client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "Strongpass1!"},
        format="json",
    )
    assert len(mail.outbox) == 1
    assert "new@example.com" in mail.outbox[0].to
    assert "verify" in mail.outbox[0].subject.lower()


@pytest.mark.django_db
def test_signup_creates_verification_token(client):
    client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "Strongpass1!"},
        format="json",
    )
    user = User.objects.get(email="new@example.com")
    assert EmailVerificationToken.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_signup_sets_preferred_auth_provider_to_email(client):
    client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "Strongpass1!"},
        format="json",
    )
    user = User.objects.get(email="new@example.com")
    assert user.preferred_auth_provider == User.AuthProvider.EMAIL


@pytest.mark.django_db
def test_signup_email_not_verified_after_signup(client):
    client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "Strongpass1!"},
        format="json",
    )
    user = User.objects.get(email="new@example.com")
    assert not user.email_verified


@pytest.mark.django_db
def test_signup_with_full_name(client):
    client.post(
        SIGNUP_URL,
        {
            "email": "new@example.com",
            "password": "Strongpass1!",
            "full_name": "Ada Lovelace",
        },
        format="json",
    )
    user = User.objects.get(email="new@example.com")
    assert user.full_name == "Ada Lovelace"


@pytest.mark.django_db
def test_signup_duplicate_email_returns_400(client):
    User.objects.create_user(
        username="existing",
        email="taken@example.com",
        password="Pass123456!",
    )
    resp = client.post(
        SIGNUP_URL,
        {"email": "taken@example.com", "password": "Strongpass1!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_duplicate_email_case_insensitive(client):
    User.objects.create_user(
        username="existing",
        email="taken@example.com",
        password="Pass123456!",
    )
    resp = client.post(
        SIGNUP_URL,
        {"email": "TAKEN@example.com", "password": "Strongpass1!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_password_too_short_returns_400(client):
    resp = client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "short"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_password_no_uppercase_returns_400(client):
    resp = client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "weakpass1!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_password_no_number_returns_400(client):
    resp = client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "Weakpass!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_password_no_special_char_returns_400(client):
    resp = client.post(
        SIGNUP_URL,
        {"email": "new@example.com", "password": "Weakpass1"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_missing_email_returns_400(client):
    resp = client.post(SIGNUP_URL, {"password": "Strongpass1!"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_missing_password_returns_400(client):
    resp = client.post(SIGNUP_URL, {"email": "new@example.com"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_signup_username_equals_normalized_email(client):
    client.post(
        SIGNUP_URL,
        {"email": "Alice@Example.COM", "password": "Strongpass1!"},
        format="json",
    )
    user = User.objects.get(email="alice@example.com")
    assert user.username == "alice@example.com"


@pytest.mark.django_db
def test_signup_email_equals_normalized_email(client):
    client.post(
        SIGNUP_URL,
        {"email": "Alice@Example.COM", "password": "Strongpass1!"},
        format="json",
    )
    user = User.objects.get(email="alice@example.com")
    assert user.email == "alice@example.com"


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------


@pytest.fixture
def unverified_user(db):
    return User.objects.create_user(
        username="unverified",
        email="unverified@example.com",
        password="Strongpass1!",
    )


@pytest.fixture
def valid_token(unverified_user):
    return EmailVerificationToken.create_for_user(unverified_user)


@pytest.mark.django_db
def test_verify_email_valid_token(client, valid_token):
    resp = client.post(VERIFY_URL, {"token": str(valid_token.token)}, format="json")
    assert resp.status_code == 200
    valid_token.user.refresh_from_db()
    assert valid_token.user.email_verified


@pytest.mark.django_db
def test_verify_email_marks_token_used(client, valid_token):
    client.post(VERIFY_URL, {"token": str(valid_token.token)}, format="json")
    valid_token.refresh_from_db()
    assert valid_token.is_used


@pytest.mark.django_db
def test_verify_email_unknown_token_returns_400(client, db):
    resp = client.post(VERIFY_URL, {"token": str(uuid.uuid4())}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_verify_email_already_used_token_returns_400(client, valid_token):
    valid_token.mark_used()
    resp = client.post(VERIFY_URL, {"token": str(valid_token.token)}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_verify_email_expired_token_returns_400(client, unverified_user):
    token = EmailVerificationToken.objects.create(
        user=unverified_user,
        expires_at=timezone.now() - timedelta(hours=1),
    )
    resp = client.post(VERIFY_URL, {"token": str(token.token)}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_verify_email_invalid_uuid_returns_400(client, db):
    resp = client.post(VERIFY_URL, {"token": "not-a-uuid"}, format="json")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Resend verification
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resend_sends_email_for_unverified_user(client, unverified_user):
    resp = client.post(RESEND_URL, {"email": unverified_user.email}, format="json")
    assert resp.status_code == 200
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_resend_unknown_email_returns_200_no_email(client, db):
    resp = client.post(RESEND_URL, {"email": "ghost@example.com"}, format="json")
    assert resp.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_resend_already_verified_returns_200_no_email(client, unverified_user):
    unverified_user.mark_email_verified()
    resp = client.post(RESEND_URL, {"email": unverified_user.email}, format="json")
    assert resp.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_resend_cooldown_prevents_duplicate_send(client, unverified_user):
    EmailVerificationToken.create_for_user(unverified_user)
    resp = client.post(RESEND_URL, {"email": unverified_user.email}, format="json")
    assert resp.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_resend_after_cooldown_sends_new_email(client, unverified_user):
    # auto_now_add ignores values in create(); use update() to backdate created_at
    token = EmailVerificationToken.objects.create(
        user=unverified_user,
        expires_at=timezone.now() + timedelta(hours=24),
    )
    EmailVerificationToken.objects.filter(pk=token.pk).update(
        created_at=timezone.now() - timedelta(minutes=2),
    )
    resp = client.post(RESEND_URL, {"email": unverified_user.email}, format="json")
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
