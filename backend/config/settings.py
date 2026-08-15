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
    # Required for the meeting-room overlap ExclusionConstraint (GiST) and the
    # btree_gist extension migration (PR 073). Bundled with Django — not a new
    # dependency.
    "django.contrib.postgres",
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
    "chat",
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
        # Enhance/Tidy apply/undo/retry (BE-11). These are explicit, occasional
        # admin actions (a button, not a per-drag PATCH), so unlike
        # layout_object_write they carry a sensible default cap by default.
        "enhance_apply": os.environ.get("THROTTLE_ENHANCE_APPLY", "30/min"),
        "desk_write": os.environ.get("THROTTLE_DESK_WRITE", "120/hour"),
        "desk_booking_write": os.environ.get("THROTTLE_DESK_BOOKING_WRITE", "60/hour"),
        # Read throttle covers desk-booking reads: the floor-bookings list, the booking
        # detail, and (PR 079) the usual-desk lookup. The Today home screen fetches the
        # whole visible week — five per-day floor-booking reads + the usual desk on a
        # cold mount — so 120/hour (≈2/min) throttled real use to a 429. Raised so a
        # normal Today load (≈6 cached reads) has headroom; still env-overridable.
        "desk_booking_read": os.environ.get("THROTTLE_DESK_BOOKING_READ", "600/hour"),
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

# ─── Bookings ────────────────────────────────────────────────────────────────

# Timezone used to judge "today" for booking-date validation when an office has
# no timezone configured. Offices should set their own timezone; this is the
# global fallback so booking validation never depends on raw server-UTC (BE-3).
BOOKING_DEFAULT_TIMEZONE = os.environ.get("BOOKING_DEFAULT_TIMEZONE", "UTC")

# Meeting-room slot bounds (PR 073). v1 slots are intra-day; these bound a single
# booking's duration. Kept as settings constants so there are no magic numbers in
# the serializer/service.
ROOM_BOOKING_MIN_MINUTES = int(os.environ.get("ROOM_BOOKING_MIN_MINUTES", "15"))
ROOM_BOOKING_MAX_MINUTES = int(os.environ.get("ROOM_BOOKING_MAX_MINUTES", str(8 * 60)))

# ─── Chat bot (PR 077) ───────────────────────────────────────────────────────
# Platform-independent core. Secrets are ENV-ONLY (never in code/DB); the Slack
# adapter (Slice 2) reads these — empty by default so nothing breaks without them.
SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET", "")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")

# Microsoft Teams adapter (PR 078). The bot's Azure app registration — DISTINCT
# from the MICROSOFT_CLIENT_ID social-login app above. Env-only; empty by default.
# The bot is registered SINGLE TENANT (Azure no longer offers multi-tenant Azure Bot
# resources), so MICROSOFT_APP_TENANT_ID scopes both inbound issuer validation and the
# outbound token endpoint. The Teams endpoint fails closed (503) when ANY of the three
# is unset — it must be impossible to validate a token against an empty audience, or to
# run single-tenant validation without a tenant to scope the issuer/JWKS to.
MICROSOFT_APP_ID = os.environ.get("MICROSOFT_APP_ID", "")
MICROSOFT_APP_PASSWORD = os.environ.get("MICROSOFT_APP_PASSWORD", "")
MICROSOFT_APP_TENANT_ID = os.environ.get("MICROSOFT_APP_TENANT_ID", "")
# TTLs. The account-link code is short-lived (single-use); the write-confirm token
# gives the user a brief window to press Confirm before it expires.
CHAT_LINK_TOKEN_TTL_MINUTES = int(os.environ.get("CHAT_LINK_TOKEN_TTL_MINUTES", "10"))
CHAT_CONFIRM_TOKEN_TTL_MINUTES = int(
    os.environ.get("CHAT_CONFIRM_TOKEN_TTL_MINUTES", "5")
)


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
#
# BE-19 (CSRF): the API authenticates with a Bearer access token (JWTAuthentication),
# which is immune to CSRF. The only cookie-carried credential is this refresh
# cookie, read by the refresh/logout endpoints under AUTH_COOKIE_PATH. Its CSRF
# safety depends on SameSite: with "Lax" (the default) a cross-site POST does not
# send the cookie, so the refresh/logout endpoints cannot be driven cross-site.
# Setting AUTH_COOKIE_SAMESITE="None" REMOVES that protection and MUST be paired
# with a CSRF token on those endpoints — the guard below refuses the unsafe combo.

AUTH_COOKIE_NAME = "wsc_rt"
AUTH_COOKIE_SECURE = not DEBUG  # True in production (HTTPS only)
AUTH_COOKIE_SAMESITE: str = os.environ.get("AUTH_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_PATH = "/api/auth/"
AUTH_COOKIE_MAX_AGE = int(SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())

if not DEBUG and AUTH_COOKIE_SAMESITE.lower() == "none":
    raise ImproperlyConfigured(
        "AUTH_COOKIE_SAMESITE='None' disables the SameSite CSRF protection for the "
        "cookie-authenticated refresh/logout endpoints. Use 'Lax' (or add explicit "
        "CSRF-token protection to those endpoints before relaxing it)."
    )


# ─── Production transport security (applied only when DEBUG is off) ───────────
# BE-18: HTTPS/HSTS/secure-cookie hardening for production. All are opt-out via
# env for unusual deploys, but secure-by-default when DEBUG is False.

if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get(
        "DJANGO_SECURE_SSL_REDIRECT", "True"
    ).lower() in ["true", "1", "yes"]
    SECURE_HSTS_SECONDS = int(
        os.environ.get("DJANGO_SECURE_HSTS_SECONDS", str(60 * 60 * 24 * 365))
    )
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # TLS is terminated at the proxy; trust its forwarded-proto header so Django
    # knows the original request was HTTPS.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


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
