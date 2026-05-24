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
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files

STATIC_URL = "static/"

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
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": os.environ.get("THROTTLE_AUTH_LOGIN", "5/min"),
        "auth_signup": os.environ.get("THROTTLE_AUTH_SIGNUP", "5/min"),
        "auth_resend": os.environ.get("THROTTLE_AUTH_RESEND", "3/min"),
        "auth_mfa_challenge": os.environ.get("THROTTLE_AUTH_MFA_CHALLENGE", "5/min"),
        "auth_social": os.environ.get("THROTTLE_AUTH_SOCIAL", "10/min"),
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


# Email

EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL",
    "WorkspaceCanvas <noreply@workspacecanvas.local>",
)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


# MFA

MFA_ISSUER_NAME = os.environ.get("MFA_ISSUER_NAME", "WorkspaceCanvas")
MFA_TOTP_INTERVAL = int(os.environ.get("MFA_TOTP_INTERVAL", "30"))
MFA_TOTP_DIGITS = int(os.environ.get("MFA_TOTP_DIGITS", "6"))
MFA_RECOVERY_CODE_COUNT = int(os.environ.get("MFA_RECOVERY_CODE_COUNT", "10"))
MFA_CHALLENGE_LIFETIME_MINUTES = int(
    os.environ.get("MFA_CHALLENGE_LIFETIME_MINUTES", "5")
)


# drf-spectacular

SPECTACULAR_SETTINGS = {
    "TITLE": "WorkspaceCanvas API",
    "DESCRIPTION": "API for WorkspaceCanvas office maps, desk booking, events, awards, and workplace engagement.",  # noqa: E501
    "VERSION": "1.0.0",
}
