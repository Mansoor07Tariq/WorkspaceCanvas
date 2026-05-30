from django.contrib import admin

from .models import Office


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "organization",
        "city",
        "country",
        "timezone",
        "is_active",
        "created_at",
    ]
    list_filter = ["is_active", "country"]
    search_fields = ["name", "slug", "city", "country", "organization__name"]
    readonly_fields = ["slug", "created_at", "updated_at"]
    raw_id_fields = ["organization"]
