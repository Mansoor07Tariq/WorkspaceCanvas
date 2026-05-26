import io
import re
from zoneinfo import available_timezones

from django.conf import settings as django_settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import (
    validate_password as django_validate_password,
)
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from PIL import Image
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership

from .models import MFALoginChallenge, User
from .social_auth import SocialAuthError, verify_google_token, verify_microsoft_token
from .utils import get_client_ip

_PHONE_RE = re.compile(r"^[0-9\s+\(\)\-]+$")
_INVALID_CREDENTIALS_MSG = "Invalid email or password."
_VALID_TIMEZONES = available_timezones()
_SOCIAL_PROVIDERS = [User.AuthProvider.GOOGLE, User.AuthProvider.MICROSOFT]


def _require_nonempty(value: str, field_label: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise serializers.ValidationError(f"{field_label} is required.")
    return stripped


def _open_and_validate_image(raw: bytes) -> "Image.Image":
    """Open image bytes with Pillow; raises ValidationError on failure."""
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception:
        raise serializers.ValidationError("Upload a valid image file.")
    if img.format not in django_settings.AVATAR_ALLOWED_FORMATS:
        raise serializers.ValidationError(
            "Only JPEG, PNG, and WebP images are supported."
        )
    return img


def build_jwt_response_for_user(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class MembershipInlineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(source="organization.id", read_only=True)
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    organization_slug = serializers.SlugField(
        source="organization.slug", read_only=True
    )
    organization_status = serializers.CharField(
        source="organization.status", read_only=True
    )
    has_active_access = serializers.BooleanField(read_only=True)

    class Meta:
        model = Membership
        fields = [
            "id",
            "organization_id",
            "organization_name",
            "organization_slug",
            "organization_status",
            "role",
            "status",
            "has_active_access",
        ]


class CurrentUserSerializer(serializers.ModelSerializer):
    memberships = MembershipInlineSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "first_name",
            "last_name",
            "avatar",
            "phone_number",
            "job_title",
            "timezone",
            "locale",
            "is_profile_completed",
            "email_verified",
            "preferred_auth_provider",
            "mfa_enabled",
            "memberships",
        ]


class EmailTokenObtainPairSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = User.normalize_email(data["email"])
        password = data["password"]
        request = self.context.get("request")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": _INVALID_CREDENTIALS_MSG})

        authenticated_user = authenticate(
            request=request,
            username=user.username,
            password=password,
        )

        if authenticated_user is None:
            raise serializers.ValidationError({"detail": _INVALID_CREDENTIALS_MSG})

        if not authenticated_user.is_active:
            raise serializers.ValidationError({"detail": "This account is inactive."})

        update_fields = []

        if not authenticated_user.preferred_auth_provider:
            authenticated_user.preferred_auth_provider = User.AuthProvider.EMAIL
            update_fields.append("preferred_auth_provider")

        ip = get_client_ip(request) if request else None
        if ip:
            authenticated_user.last_login_ip = ip
            update_fields.append("last_login_ip")

        if update_fields:
            authenticated_user.save(update_fields=update_fields)

        if authenticated_user.mfa_enabled:
            challenge = MFALoginChallenge.create_for_user(
                authenticated_user, request=request
            )
            return {
                "mfa_required": True,
                "challenge_id": str(challenge.challenge_id),
                "detail": "MFA verification required.",
            }

        return build_jwt_response_for_user(authenticated_user)


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_password(self, value):
        django_validate_password(value)
        return value

    def validate_email(self, value):
        normalized = User.normalize_email(value)
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def create(self, validated_data):
        email = validated_data["email"]
        return User.objects.create_user(
            username=email,
            email=email,
            password=validated_data["password"],
            full_name=validated_data.get("full_name", ""),
            preferred_auth_provider=User.AuthProvider.EMAIL,
        )


class EmailVerificationSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class ResendEmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


def _save_social_avatar(user, avatar_bytes: bytes) -> bool:
    """Validate and attach avatar bytes to user.avatar (does not call user.save)."""
    if not avatar_bytes or len(avatar_bytes) > django_settings.AVATAR_MAX_BYTES:
        return False
    try:
        img = _open_and_validate_image(avatar_bytes)
    except serializers.ValidationError:
        return False
    ext = "jpg" if img.format == "JPEG" else img.format.lower()
    user.avatar.save(
        f"social_avatar_{user.id}.{ext}", ContentFile(avatar_bytes), save=False
    )
    return True


class SocialAuthSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(
        choices=[(p.value, p.label) for p in _SOCIAL_PROVIDERS]
    )
    access_token = serializers.CharField(required=False, allow_blank=True)
    id_token = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        provider = data["provider"]
        access_token = data.get("access_token") or None
        id_token = data.get("id_token") or None

        if not access_token and not id_token:
            # Raised as SocialAuthError so the view can return {detail, code}
            raise SocialAuthError(
                "Either access_token or id_token is required.",
                code="missing_token",
            )

        # SocialAuthError propagates to the view — DRF only catches ValidationError
        if provider == "google":
            identity = verify_google_token(access_token=access_token, id_token=id_token)
        else:
            identity = verify_microsoft_token(
                access_token=access_token, id_token=id_token
            )

        request = self.context.get("request")
        user = self._find_or_create_user(identity, request)

        if user.mfa_enabled:
            challenge = MFALoginChallenge.create_for_user(user, request=request)
            return {
                "mfa_required": True,
                "challenge_id": str(challenge.challenge_id),
                "detail": "MFA verification required.",
                "email": user.email,
                "preferred_auth_provider": user.preferred_auth_provider,
            }

        return {
            **build_jwt_response_for_user(user),
            "email": user.email,
            "email_verified": user.email_verified,
            "preferred_auth_provider": user.preferred_auth_provider,
        }

    @staticmethod
    def _find_or_create_user(identity: dict, request) -> User:
        email = User.normalize_email(identity["email"])
        provider = identity["provider"]
        provider_verified = identity["email_verified"]

        provider_locale = identity.get("locale", "").strip()
        # Only use the locale if it's one we support; fall back to "en".
        initial_locale = (
            provider_locale
            if provider_locale in django_settings.SUPPORTED_LOCALES
            else "en"
        )

        with transaction.atomic():
            try:
                user = User.objects.select_for_update().get(email__iexact=email)
                update_fields = []
                if provider_verified and not user.email_verified:
                    user.email_verified = True
                    user.email_verified_at = timezone.now()
                    update_fields += ["email_verified", "email_verified_at"]
                if not user.preferred_auth_provider:
                    user.preferred_auth_provider = provider
                    update_fields.append("preferred_auth_provider")
                # Backfill profile fields from provider when blank on this account
                for attr, provider_val in (
                    ("full_name", identity.get("full_name", "").strip()),
                    ("first_name", identity.get("first_name", "").strip()),
                    ("last_name", identity.get("last_name", "").strip()),
                    ("job_title", identity.get("job_title", "").strip()),
                ):
                    if provider_val and not getattr(user, attr, "").strip():
                        setattr(user, attr, provider_val)
                        update_fields.append(attr)
                # Locale: only update if still the default "en" and provider
                # offers a more specific supported locale.
                if (
                    provider_locale in django_settings.SUPPORTED_LOCALES
                    and provider_locale != "en"
                    and user.locale == "en"
                ):
                    user.locale = provider_locale
                    update_fields.append("locale")
                avatar_bytes = identity.get("avatar_bytes")
                if (
                    not user.avatar
                    and avatar_bytes
                    and _save_social_avatar(user, avatar_bytes)
                ):
                    update_fields.append("avatar")
                if update_fields:
                    user.save(update_fields=update_fields)
            except User.DoesNotExist:
                now = timezone.now()
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password=None,
                    full_name=identity.get("full_name", "").strip(),
                    first_name=identity.get("first_name", "").strip(),
                    last_name=identity.get("last_name", "").strip(),
                    job_title=identity.get("job_title", "").strip(),
                    locale=initial_locale,
                    preferred_auth_provider=provider,
                    email_verified=provider_verified,
                    email_verified_at=now if provider_verified else None,
                )
                avatar_bytes = identity.get("avatar_bytes")
                if avatar_bytes and _save_social_avatar(user, avatar_bytes):
                    user.save(update_fields=["avatar"])

            ip = get_client_ip(request) if request else None
            if ip:
                user.last_login_ip = ip
                user.save(update_fields=["last_login_ip"])

        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(max_length=255, required=False)
    job_title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    phone_number = serializers.CharField(
        max_length=30, required=False, allow_blank=True
    )
    timezone = serializers.CharField(max_length=64, required=False)
    locale = serializers.CharField(max_length=20, required=False)
    avatar = serializers.ImageField(required=False, allow_null=True, use_url=True)
    remove_avatar = serializers.BooleanField(
        required=False, default=False, write_only=True
    )

    class Meta:
        model = User
        fields = [
            "full_name",
            "job_title",
            "phone_number",
            "timezone",
            "locale",
            "avatar",
            "remove_avatar",
        ]

    def validate_full_name(self, value):
        return _require_nonempty(value, "Full name")

    def validate_job_title(self, value):
        return value.strip()

    def validate_phone_number(self, value):
        stripped = value.strip()
        if stripped and not _PHONE_RE.match(stripped):
            raise serializers.ValidationError(
                "Enter a valid phone number (digits, spaces, +, (, ), - only)."
            )
        return stripped

    def validate_timezone(self, value):
        if value not in _VALID_TIMEZONES:
            raise serializers.ValidationError(
                "Enter a valid timezone (e.g. Europe/Dublin, America/New_York, UTC)."
            )
        return value

    def validate_locale(self, value):
        if value not in django_settings.SUPPORTED_LOCALES:
            supported = ", ".join(sorted(django_settings.SUPPORTED_LOCALES))
            raise serializers.ValidationError(
                f"Unsupported locale. Supported: {supported}."
            )
        return value

    def validate_avatar(self, value):
        if value is None:
            return value
        if value.size > django_settings.AVATAR_MAX_BYTES:
            raise serializers.ValidationError("Avatar must be 2 MB or smaller.")
        # Re-read bytes so Pillow doesn't interfere with Django's upload pipeline
        raw = value.read()
        value.seek(0)
        _open_and_validate_image(raw)
        return value

    def update(self, instance, validated_data):
        remove_avatar = validated_data.pop("remove_avatar", False)
        avatar_changed = False

        if remove_avatar:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None
            avatar_changed = True

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if "avatar" in validated_data:
            avatar_changed = True

        instance.is_profile_completed = instance.compute_profile_completion()
        update_fields = list(set(validated_data.keys()) | {"is_profile_completed"})
        if avatar_changed:
            update_fields = list(set(update_fields) | {"avatar"})
        instance.save(update_fields=update_fields)
        return instance
