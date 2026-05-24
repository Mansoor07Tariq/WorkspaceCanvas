import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="Securepass1!",
    )


@pytest.mark.django_db
def test_custom_user_can_be_created():
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="Securepass1!",
    )
    assert user.pk is not None
    assert user.email == "test@example.com"


@pytest.mark.django_db
def test_email_must_be_unique():
    User.objects.create_user(
        username="user1",
        email="dup@example.com",
        password="pass123",
    )
    with pytest.raises(Exception):
        User.objects.create_user(
            username="user2",
            email="dup@example.com",
            password="pass123",
        )


@pytest.mark.django_db
def test_str_returns_email(user):
    assert str(user) == "test@example.com"


@pytest.mark.django_db
def test_user_supports_profile_fields():
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="pass123",
        full_name="Jane Smith",
        phone_number="+1234567890",
        job_title="Product Manager",
        timezone="America/New_York",
        locale="en-US",
    )
    assert user.full_name == "Jane Smith"
    assert user.phone_number == "+1234567890"
    assert user.job_title == "Product Manager"
    assert user.timezone == "America/New_York"
    assert user.locale == "en-US"


@pytest.mark.django_db
def test_default_is_profile_completed_is_false(user):
    assert user.is_profile_completed is False


# --- Auth identity field defaults ---


@pytest.mark.django_db
def test_email_verified_is_false_by_default(user):
    assert user.email_verified is False


@pytest.mark.django_db
def test_mfa_enabled_is_false_by_default(user):
    assert user.mfa_enabled is False


@pytest.mark.django_db
def test_has_verified_identity_false_by_default(user):
    assert user.has_verified_identity is False


@pytest.mark.django_db
def test_requires_mfa_false_by_default(user):
    assert user.requires_mfa is False


@pytest.mark.django_db
def test_requires_mfa_true_when_mfa_enabled(user):
    user.mfa_enabled = True
    user.save(update_fields=["mfa_enabled"])
    user.refresh_from_db()
    assert user.requires_mfa is True


@pytest.mark.django_db
def test_mark_email_verified_sets_flag(user):
    user.mark_email_verified()
    user.refresh_from_db()
    assert user.email_verified is True


@pytest.mark.django_db
def test_mark_email_verified_sets_timestamp(user):
    user.mark_email_verified()
    user.refresh_from_db()
    assert user.email_verified_at is not None


@pytest.mark.django_db
def test_has_verified_identity_true_after_verification(user):
    user.mark_email_verified()
    assert user.has_verified_identity is True


@pytest.mark.django_db
def test_preferred_auth_provider_accepts_valid_choices(user):
    for provider in ["email", "google", "microsoft"]:
        user.preferred_auth_provider = provider
        user.save(update_fields=["preferred_auth_provider"])
        user.refresh_from_db()
        assert user.preferred_auth_provider == provider
