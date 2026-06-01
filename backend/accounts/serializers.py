import re
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Invitation, MemberRole, Membership, Organization

_DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+"
    r"[a-zA-Z]{2,}$"
)

_MAX_SLUG_RETRIES = 5


class CreateOrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    organization_type = serializers.ChoiceField(choices=Organization.OrgType.choices)
    allowed_email_domain = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Name is required.")
        return stripped

    def validate_allowed_email_domain(self, value: str) -> str:
        stripped = value.strip().lower()
        if not stripped:
            return stripped
        if "@" in stripped:
            raise serializers.ValidationError(
                "Enter a domain, not an email address (e.g. example.com)."
            )
        if stripped.startswith(("http://", "https://")):
            raise serializers.ValidationError(
                "Enter a domain without a protocol (e.g. example.com)."
            )
        if "/" in stripped:
            raise serializers.ValidationError(
                "Enter a domain without a path (e.g. example.com)."
            )
        if not _DOMAIN_RE.match(stripped):
            raise serializers.ValidationError(
                "Enter a valid domain (e.g. example.com)."
            )
        return stripped

    def create(self, validated_data: dict) -> Organization:
        user = self.context["request"].user
        name = validated_data["name"]
        org_type = validated_data["organization_type"]
        domain = validated_data.get("allowed_email_domain", "")

        for attempt in range(_MAX_SLUG_RETRIES):
            slug = Organization.generate_slug(name)
            try:
                with transaction.atomic():
                    org = Organization.objects.create(
                        name=name,
                        slug=slug,
                        organization_type=org_type,
                        allowed_email_domain=domain,
                        status=Organization.Status.ACTIVE,
                    )
                    Membership.objects.create(
                        user=user,
                        organization=org,
                        role=MemberRole.OWNER,
                        status=Membership.Status.ACTIVE,
                    )
                return org
            except IntegrityError:
                if attempt == _MAX_SLUG_RETRIES - 1:
                    raise
                continue

        raise IntegrityError("Failed to generate a unique slug.")


class MembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id")
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")
    job_title = serializers.CharField(source="user.job_title")
    avatar_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_avatar_url(self, obj: Membership) -> str | None:
        request = self.context.get("request")
        if obj.user.avatar:
            url = obj.user.avatar.url
            return request.build_absolute_uri(url) if request else url
        return None

    class Meta:
        model = Membership
        fields = [
            "id",
            "user_id",
            "email",
            "full_name",
            "job_title",
            "avatar_url",
            "role",
            "status",
            "created_at",
        ]


class InvitationSerializer(serializers.ModelSerializer):
    invited_by_email = serializers.SerializerMethodField()
    accepted_by_email = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_invited_by_email(self, obj: Invitation) -> str | None:
        return obj.invited_by.email if obj.invited_by else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_accepted_by_email(self, obj: Invitation) -> str | None:
        return obj.accepted_by.email if obj.accepted_by else None

    class Meta:
        model = Invitation
        fields = [
            "id",
            "email",
            "role",
            "status",
            "token",
            "invited_by_email",
            "accepted_by_email",
            "expires_at",
            "accepted_at",
            "created_at",
        ]


class CreateInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[
            (MemberRole.MEMBER, "Member"),
            (MemberRole.ADMIN, "Admin"),
        ]
    )

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_role(self, value: str) -> str:
        if value == MemberRole.OWNER:
            raise serializers.ValidationError("Cannot invite someone as owner.")
        return value

    def validate(self, attrs: dict) -> dict:
        org: Organization = self.context["organization"]
        email: str = attrs["email"]

        already_member = Membership.objects.filter(
            organization=org,
            user__email=email,
            status=Membership.Status.ACTIVE,
        ).exists()
        if already_member:
            raise serializers.ValidationError(
                {
                    "email": (
                        "A member with this email already exists in this organization."
                    )
                }
            )

        pending_invite = Invitation.objects.filter(
            organization=org,
            email=email,
            status=Invitation.Status.PENDING,
        ).exists()
        if pending_invite:
            raise serializers.ValidationError(
                {"email": "A pending invitation for this email already exists."}
            )

        return attrs

    def create(self, validated_data: dict) -> Invitation:
        org: Organization = self.context["organization"]
        invited_by = self.context["request"].user
        expires_at = timezone.now() + timedelta(days=7)
        return Invitation.objects.create(
            organization=org,
            email=validated_data["email"],
            role=validated_data["role"],
            invited_by=invited_by,
            expires_at=expires_at,
        )


class InvitationPublicSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name")
    organization_slug = serializers.CharField(source="organization.slug")
    is_expired = serializers.BooleanField()

    class Meta:
        model = Invitation
        fields = [
            "status",
            "role",
            "organization_name",
            "organization_slug",
            "is_expired",
        ]


class OrganizationResponseSerializer(serializers.ModelSerializer):
    organization_type_display = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField())
    def get_organization_type_display(self, obj: Organization) -> str:
        return obj.get_organization_type_display()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "organization_type",
            "organization_type_display",
            "allowed_email_domain",
            "status",
        ]
