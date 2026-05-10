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
    ]
    search_fields = ["username", "email", "full_name", "first_name", "last_name"]
    list_filter = ["is_staff", "is_superuser", "is_active", "is_profile_completed"]
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
    )
