from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import (
    validate_password as django_validate_password,
)
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership

from .models import User
from .social_auth import SocialAuthError, verify_google_token, verify_microsoft_token


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
        email = data["email"]
        password = data["password"]
        request = self.context.get("request")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Invalid email or password."})

        authenticated_user = authenticate(
            request=request,
            username=user.username,
            password=password,
        )

        if authenticated_user is None:
            raise serializers.ValidationError({"detail": "Invalid email or password."})

        if not authenticated_user.is_active:
            raise serializers.ValidationError({"detail": "This account is inactive."})

        update_fields = []

        if not authenticated_user.preferred_auth_provider:
            authenticated_user.preferred_auth_provider = User.AuthProvider.EMAIL
            update_fields.append("preferred_auth_provider")

        ip = self._get_client_ip(request) if request else None
        if ip:
            authenticated_user.last_login_ip = ip
            update_fields.append("last_login_ip")

        if update_fields:
            authenticated_user.save(update_fields=update_fields)

        refresh = RefreshToken.for_user(authenticated_user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

    @staticmethod
    def _get_client_ip(request) -> str:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_password(self, value):
        django_validate_password(value)
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

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


class SocialAuthSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=["google", "microsoft"])
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

        user = self._find_or_create_user(identity, self.context.get("request"))
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "email": user.email,
            "email_verified": user.email_verified,
            "preferred_auth_provider": user.preferred_auth_provider,
        }

    @staticmethod
    def _find_or_create_user(identity: dict, request) -> User:
        email = identity["email"]
        provider = identity["provider"]
        provider_verified = identity["email_verified"]

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
                if update_fields:
                    user.save(update_fields=update_fields)
            except User.DoesNotExist:
                now = timezone.now()
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password=None,
                    full_name=identity.get("full_name", ""),
                    preferred_auth_provider=provider,
                    email_verified=provider_verified,
                    email_verified_at=now if provider_verified else None,
                )

        ip = _get_client_ip(request) if request else None
        if ip:
            user.last_login_ip = ip
            user.save(update_fields=["last_login_ip"])

        return user


def _get_client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")
