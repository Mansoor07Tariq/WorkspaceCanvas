import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client(settings):
    """Base DRF APIClient with testserver in ALLOWED_HOSTS."""
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def make_user(db):
    """Factory fixture: create a User with sensible defaults."""

    def _make(
        email: str = "test@example.com",
        password: str = "Testpass1!",
        full_name: str = "",
        is_profile_completed: bool = False,
        **kwargs,
    ) -> User:
        return User.objects.create_user(
            username=email,
            email=email,
            password=password,
            full_name=full_name,
            is_profile_completed=is_profile_completed,
            **kwargs,
        )

    return _make


@pytest.fixture
def make_jwt_client(api_client):
    """Factory fixture: attach a JWT Bearer token for *user* to *api_client*."""

    def _make(user) -> APIClient:
        token = RefreshToken.for_user(user)
        api_client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {str(token.access_token)}"
        return api_client

    return _make
