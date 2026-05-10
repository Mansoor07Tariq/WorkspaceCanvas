import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_custom_user_can_be_created():
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="securepass123",
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
def test_str_returns_email():
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="pass123",
    )
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
def test_default_is_profile_completed_is_false():
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="pass123",
    )
    assert user.is_profile_completed is False
