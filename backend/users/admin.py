from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import EmailVerificationToken, RecoveryCode, User, UserMFADevice


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


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "token", "created_at", "expires_at", "used_at"]
    list_filter = ["used_at", "expires_at", "created_at"]
    search_fields = ["user__email"]
    readonly_fields = ["token", "created_at", "used_at"]


@admin.register(UserMFADevice)
class UserMFADeviceAdmin(admin.ModelAdmin):
    list_display = ["user", "confirmed_at", "created_at", "updated_at"]
    list_filter = ["confirmed_at", "created_at"]
    search_fields = ["user__email"]
    readonly_fields = ["created_at", "updated_at", "confirmed_at"]


@admin.register(RecoveryCode)
class RecoveryCodeAdmin(admin.ModelAdmin):
    list_display = ["user", "used_at", "created_at"]
    list_filter = ["used_at", "created_at"]
    search_fields = ["user__email"]
    readonly_fields = ["code_hash", "used_at", "created_at"]
