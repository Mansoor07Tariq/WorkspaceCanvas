from django.conf import settings as django_settings
from rest_framework.response import Response


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=django_settings.AUTH_COOKIE_NAME,
        value=refresh_token,
        max_age=django_settings.AUTH_COOKIE_MAX_AGE,
        httponly=True,
        secure=django_settings.AUTH_COOKIE_SECURE,
        samesite=django_settings.AUTH_COOKIE_SAMESITE,
        path=django_settings.AUTH_COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    # Use set_cookie with max_age=0 so we can pass the same secure flag used at
    # login time.  Django's delete_cookie() does not accept a secure= argument,
    # meaning browsers that set the cookie with Secure would silently ignore a
    # plain delete_cookie() call in production.
    response.set_cookie(
        key=django_settings.AUTH_COOKIE_NAME,
        value="",
        max_age=0,
        httponly=True,
        secure=django_settings.AUTH_COOKIE_SECURE,
        samesite=django_settings.AUTH_COOKIE_SAMESITE,
        path=django_settings.AUTH_COOKIE_PATH,
    )
