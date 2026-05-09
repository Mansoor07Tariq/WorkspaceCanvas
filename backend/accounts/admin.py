from django.contrib import admin

from .models import Invitation, Membership, Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "organization_type", "allowed_email_domain", "is_active", "created_at"]
    search_fields = ["name", "slug", "allowed_email_domain"]
    list_filter = ["organization_type", "is_active"]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "status", "created_at"]
    search_fields = ["user__username", "user__email", "organization__name"]
    list_filter = ["role", "status", "organization"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["email", "organization", "role", "status", "invited_by", "accepted_by", "expires_at", "created_at"]
    search_fields = ["email", "organization__name"]
    list_filter = ["role", "status", "organization"]
    readonly_fields = ["token", "created_at", "updated_at", "accepted_at"]
