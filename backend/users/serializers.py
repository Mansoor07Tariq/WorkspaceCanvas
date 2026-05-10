from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import (
    validate_password as django_validate_password,
)
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership

from .models import User


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
