"""
Re-authentication helpers for sensitive MFA operations.

verify_reauth_for_user() proves the currently-authenticated user
is who they claim to be, without creating or modifying any data.
"""

from django.contrib.auth import authenticate

from .models import User
from .social_auth import SocialAuthError, verify_google_token, verify_microsoft_token


def verify_reauth_for_user(
    user: User,
    *,
    request=None,
    password: str | None = None,
    provider: str | None = None,
    access_token: str | None = None,
    id_token: str | None = None,
) -> bool:
    """
    Return True if the supplied credentials prove the identity of `user`.

    Accepts exactly one of:
      - password       — checked via Django's authenticate()
      - provider token — verified against Google or Microsoft

    Side-effect-free: no users, organisations, or memberships are created
    or modified. Recovery codes and MFA devices are not touched.
    """
    if password is not None:
        authenticated = authenticate(
            request=request, username=user.username, password=password
        )
        return authenticated is not None

    if provider is not None:
        try:
            if provider == "google":
                identity = verify_google_token(
                    access_token=access_token, id_token=id_token
                )
            elif provider == "microsoft":
                identity = verify_microsoft_token(
                    access_token=access_token, id_token=id_token
                )
            else:
                return False
        except SocialAuthError:
            return False

        # Token email must belong to the currently authenticated user.
        if identity["email"].lower() != user.email.lower():
            return False

        # Provider must confirm the email is verified.
        if not identity.get("email_verified"):
            return False

        return True

    return False
