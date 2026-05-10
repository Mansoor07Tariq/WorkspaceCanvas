from django.contrib import admin

from .models import Invitation, Membership, Organization


@admin.action(description="Submit selected organizations for approval")
def submit_for_approval(modeladmin, request, queryset):
    queryset.filter(status=Organization.Status.DRAFT).update(
        status=Organization.Status.PENDING_APPROVAL
    )


@admin.action(
    description="Approve selected organizations and activate owner memberships"
)
def approve_organizations(modeladmin, request, queryset):
    org_ids = list(queryset.values_list("id", flat=True))
    queryset.update(status=Organization.Status.ACTIVE, is_active=True)
    Membership.objects.filter(
        organization_id__in=org_ids,
        role=Membership.Role.OWNER,
    ).update(status=Membership.Status.ACTIVE)


@admin.action(description="Reject selected organizations and disable owner memberships")
def reject_organizations(modeladmin, request, queryset):
    org_ids = list(queryset.values_list("id", flat=True))
    queryset.update(status=Organization.Status.REJECTED)
    Membership.objects.filter(
        organization_id__in=org_ids,
        role=Membership.Role.OWNER,
    ).update(status=Membership.Status.DISABLED)


@admin.action(description="Suspend selected organizations and disable all memberships")
def suspend_organizations(modeladmin, request, queryset):
    org_ids = list(queryset.values_list("id", flat=True))
    queryset.update(status=Organization.Status.SUSPENDED, is_active=False)
    Membership.objects.filter(organization_id__in=org_ids).update(
        status=Membership.Status.DISABLED
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "slug",
        "organization_type",
        "status",
        "allowed_email_domain",
        "is_active",
        "created_at",
    ]
    search_fields = ["name", "slug", "allowed_email_domain"]
    list_filter = ["organization_type", "status", "is_active"]
    actions = [
        submit_for_approval,
        approve_organizations,
        reject_organizations,
        suspend_organizations,
    ]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "status", "created_at"]
    search_fields = ["user__username", "user__email", "organization__name"]
    list_filter = ["role", "status", "organization"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = [
        "email",
        "organization",
        "role",
        "status",
        "invited_by",
        "accepted_by",
        "expires_at",
        "created_at",
    ]
    search_fields = ["email", "organization__name"]
    list_filter = ["role", "status", "organization"]
    readonly_fields = ["token", "created_at", "updated_at", "accepted_at"]
