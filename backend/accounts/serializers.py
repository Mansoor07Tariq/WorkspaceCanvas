import re

from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import MemberRole, Membership, Organization

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
