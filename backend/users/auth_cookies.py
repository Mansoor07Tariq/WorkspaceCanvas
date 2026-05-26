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
    response.delete_cookie(
        key=django_settings.AUTH_COOKIE_NAME,
        path=django_settings.AUTH_COOKIE_PATH,
        samesite=django_settings.AUTH_COOKIE_SAMESITE,
    )
