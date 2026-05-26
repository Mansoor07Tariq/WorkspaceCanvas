import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Organization(models.Model):
    class OrgType(models.TextChoices):
        COMPANY = "company", "Company"
        COWORKING_SPACE = "coworking_space", "Co-working Space"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_APPROVAL = "pending_approval", "Pending Approval"
        ACTIVE = "active", "Active"
        REJECTED = "rejected", "Rejected"
        SUSPENDED = "suspended", "Suspended"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    organization_type = models.CharField(max_length=50, choices=OrgType.choices)
    allowed_email_domain = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=50,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def is_approved(self) -> bool:
        return self.status == self.Status.ACTIVE

    @property
    def is_pending_approval(self) -> bool:
        return self.status == self.Status.PENDING_APPROVAL


class MemberRole(models.TextChoices):
    OWNER = "owner", "Owner"
    ADMIN = "admin", "Admin"
    MEMBER = "member", "Member"


class Membership(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        DISABLED = "disabled", "Disabled"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=50, choices=MemberRole.choices, default=MemberRole.MEMBER
    )
    status = models.CharField(
        max_length=50, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["organization__name", "user__email"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"],
                name="unique_user_organization_membership",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.organization.name} - {self.role}"

    @property
    def has_active_access(self) -> bool:
        return (
            self.status == self.Status.ACTIVE
            and self.organization.status == Organization.Status.ACTIVE
        )


class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    email = models.EmailField()
    role = models.CharField(
        max_length=50, choices=MemberRole.choices, default=MemberRole.MEMBER
    )
    status = models.CharField(
        max_length=50, choices=Status.choices, default=Status.PENDING
    )
    token = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_invitations",
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accepted_invitations",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.email} invited to {self.organization.name}"

    @property
    def is_expired(self) -> bool:
        return bool(self.expires_at and timezone.now() > self.expires_at)
