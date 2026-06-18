import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() in ["true", "1", "yes"]

_secret_key_env = os.environ.get("DJANGO_SECRET_KEY")
if not _secret_key_env:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY environment variable is required. "
        'Generate one with: python -c "import secrets; print(secrets.token_hex(50))"'
    )
SECRET_KEY = _secret_key_env

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "csp",
    "django_filters",
    "drf_spectacular",
    # Local apps
    "users",
    "accounts",
    "offices",
]

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "csp.middleware.CSPMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "workspacecanvas"),
        "USER": os.environ.get("POSTGRES_USER", "workspacecanvas"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "workspacecanvas"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",  # noqa: E501
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
    {
        "NAME": "users.validators.StrongPasswordValidator",
    },
]


# Internationalization

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# CORS
# In production set DJANGO_CORS_ALLOWED_ORIGINS to a comma-separated list of
# allowed origins, e.g. "https://app.workspacecanvas.com".

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "DJANGO_CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
# Required for the browser to send the httpOnly refresh cookie cross-origin.
CORS_ALLOW_CREDENTIALS = True


# Content Security Policy (django-csp)
# Applied to Django-served pages (admin, schema). The React SPA is served
# separately and gets its CSP from Vite (dev) or nginx (production).

CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        "default-src": ("'none'",),
        "script-src": ("'self'",),
        "style-src": ("'self'", "'unsafe-inline'"),
        "img-src": ("'self'", "data:"),
        "font-src": ("'self'",),
        "connect-src": ("'self'",),
        "form-action": ("'self'",),
        "frame-ancestors": ("'none'",),
        "base-uri": ("'none'",),
    }
}


# Django REST Framework

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": os.environ.get("THROTTLE_AUTH_LOGIN", "5/min"),
        "auth_signup": os.environ.get("THROTTLE_AUTH_SIGNUP", "5/min"),
        "auth_resend": os.environ.get("THROTTLE_AUTH_RESEND", "3/min"),
        "auth_mfa_challenge": os.environ.get("THROTTLE_AUTH_MFA_CHALLENGE", "5/min"),
        "auth_social": os.environ.get("THROTTLE_AUTH_SOCIAL", "10/min"),
        "auth_profile": os.environ.get("THROTTLE_AUTH_PROFILE", "30/min"),
        "org_create": os.environ.get("THROTTLE_ORG_CREATE", "5/hour"),
        "invite_write": os.environ.get("THROTTLE_INVITE_WRITE", "60/hour"),
        "invite_read": os.environ.get("THROTTLE_INVITE_READ", "120/hour"),
        "office_create": os.environ.get("THROTTLE_OFFICE_CREATE", "30/hour"),
        "floor_create": os.environ.get("THROTTLE_FLOOR_CREATE", "60/hour"),
        # Canvas object create/move/resize. Disabled by default: a single editing
        # session legitimately fires many writes (each drag/keyboard nudge/resize
        # is a PATCH), so a fixed hourly cap locks admins out mid-edit. Set
        # THROTTLE_LAYOUT_OBJECT_WRITE (e.g. "600/hour") to re-enable in prod.
        "layout_object_write": os.environ.get("THROTTLE_LAYOUT_OBJECT_WRITE") or None,
        "desk_write": os.environ.get("THROTTLE_DESK_WRITE", "120/hour"),
        "desk_booking_write": os.environ.get("THROTTLE_DESK_BOOKING_WRITE", "60/hour"),
        "desk_booking_read": os.environ.get("THROTTLE_DESK_BOOKING_READ", "120/hour"),
    },
}


# Simple JWT

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}


# ─── Media / uploads ─────────────────────────────────────────────────────────

AVATAR_MAX_BYTES: int = 2 * 1024 * 1024  # 2 MB
AVATAR_ALLOWED_FORMATS: frozenset[str] = frozenset({"JPEG", "PNG", "WEBP"})

# ─── Localisation ────────────────────────────────────────────────────────────

SUPPORTED_LOCALES: frozenset[str] = frozenset({"en", "en-IE", "en-GB", "en-US"})


# Email

EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL",
    "WorkspaceCanvas <noreply@workspacecanvas.local>",
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True").lower() in ["true", "1", "yes"]
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "False").lower() in ["true", "1", "yes"]
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


# Social auth

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
MICROSOFT_CLIENT_ID = os.environ.get("MICROSOFT_CLIENT_ID", "")
MICROSOFT_TENANT_ID = os.environ.get("MICROSOFT_TENANT_ID", "common")


# MFA

MFA_ISSUER_NAME = os.environ.get("MFA_ISSUER_NAME", "WorkspaceCanvas")
MFA_TOTP_INTERVAL = int(os.environ.get("MFA_TOTP_INTERVAL", "30"))
MFA_TOTP_DIGITS = int(os.environ.get("MFA_TOTP_DIGITS", "6"))
MFA_RECOVERY_CODE_COUNT = int(os.environ.get("MFA_RECOVERY_CODE_COUNT", "10"))
MFA_CHALLENGE_LIFETIME_MINUTES = int(
    os.environ.get("MFA_CHALLENGE_LIFETIME_MINUTES", "5")
)

RESEND_VERIFICATION_COOLDOWN_SECONDS = int(
    os.environ.get("RESEND_VERIFICATION_COOLDOWN_SECONDS", "60")
)


# Auth refresh cookie (httpOnly, sent automatically by the browser)
# AUTH_COOKIE_MAX_AGE is derived from SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] so
# the two values cannot drift independently.

AUTH_COOKIE_NAME = "wsc_rt"
AUTH_COOKIE_SECURE = not DEBUG  # True in production (HTTPS only)
AUTH_COOKIE_SAMESITE: str = os.environ.get("AUTH_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_PATH = "/api/auth/"
AUTH_COOKIE_MAX_AGE = int(SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())


# Production guard: reject an insecure default POSTGRES_PASSWORD when not in debug mode.

_POSTGRES_PASSWORD_DEFAULT = "workspacecanvas"
_postgres_password = os.environ.get("POSTGRES_PASSWORD", _POSTGRES_PASSWORD_DEFAULT)
if not DEBUG and _postgres_password == _POSTGRES_PASSWORD_DEFAULT:
    raise ImproperlyConfigured(
        "POSTGRES_PASSWORD must be set to a non-default value in production "
        "(DEBUG=False). Set the POSTGRES_PASSWORD environment variable."
    )
DATABASES["default"]["PASSWORD"] = _postgres_password


# drf-spectacular

SPECTACULAR_SETTINGS = {
    "TITLE": "WorkspaceCanvas API",
    "DESCRIPTION": "API for WorkspaceCanvas office maps, desk booking, events, awards, and workplace engagement.",  # noqa: E501
    "VERSION": "1.0.0",
}
