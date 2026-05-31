from django.contrib import admin

from .models import Desk, DeskBooking, Floor, FloorLayoutObject, Office


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


@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ["name", "office", "level_number", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "slug", "office__name"]
    readonly_fields = ["slug", "created_at", "updated_at"]
    raw_id_fields = ["office"]


@admin.register(FloorLayoutObject)
class FloorLayoutObjectAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "floor",
        "object_type",
        "label",
        "is_bookable",
        "is_active",
        "updated_at",
    ]
    list_filter = ["object_type", "is_bookable", "is_active"]
    search_fields = ["label", "floor__name", "floor__office__name"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields = ["floor"]


@admin.register(Desk)
class DeskAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "name",
        "code",
        "office",
        "floor",
        "status",
        "is_active",
        "updated_at",
    ]
    list_filter = ["status", "is_active", "office", "floor"]
    search_fields = [
        "name",
        "code",
        "office__name",
        "floor__name",
        "layout_object__label",
    ]
    readonly_fields = [
        "organization",
        "office",
        "floor",
        "layout_object",
        "created_at",
        "updated_at",
    ]


@admin.register(DeskBooking)
class DeskBookingAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "desk",
        "office",
        "floor",
        "booking_date",
        "status",
        "created_at",
    ]
    list_select_related = ["desk", "office", "floor", "user"]
    list_filter = ["status", "booking_date", "office", "floor"]
    search_fields = [
        "user__email",
        "user__first_name",
        "user__last_name",
        "desk__name",
        "desk__code",
        "office__name",
        "floor__name",
    ]
    readonly_fields = [
        "organization",
        "office",
        "floor",
        "desk",
        "user",
        "booking_date",
        "cancelled_at",
        "cancelled_by",
        "created_at",
        "updated_at",
    ]
    ordering = ["-created_at"]
