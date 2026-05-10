from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = [
        "username",
        "email",
        "full_name",
        "is_staff",
        "is_superuser",
        "is_active",
        "is_profile_completed",
        "email_verified",
        "preferred_auth_provider",
        "mfa_enabled",
    ]
    search_fields = ["username", "email", "full_name", "first_name", "last_name"]
    list_filter = [
        "is_staff",
        "is_superuser",
        "is_active",
        "is_profile_completed",
        "email_verified",
        "preferred_auth_provider",
        "mfa_enabled",
    ]
    readonly_fields = ["email_verified_at", "mfa_verified_at", "last_login_ip"]
    fieldsets = UserAdmin.fieldsets + (
        (
            "Profile",
            {
                "fields": (
                    "full_name",
                    "avatar",
                    "phone_number",
                    "job_title",
                    "timezone",
                    "locale",
                    "is_profile_completed",
                    "last_seen_at",
                ),
            },
        ),
        (
            "Authentication Security",
            {
                "fields": (
                    "email_verified",
                    "email_verified_at",
                    "preferred_auth_provider",
                    "mfa_enabled",
                    "mfa_verified_at",
                    "last_login_ip",
                ),
            },
        ),
    )
