from __future__ import annotations

import zoneinfo
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Desk, DeskBooking, Floor, FloorLayoutObject, Office
from .permissions import user_can_manage_offices

_VALID_TIMEZONES: frozenset[str] = frozenset(zoneinfo.available_timezones())

_OPT_STR = {"required": False, "allow_blank": True, "default": ""}


class CreateOfficeSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    address_line_1 = serializers.CharField(max_length=255, **_OPT_STR)
    address_line_2 = serializers.CharField(max_length=255, **_OPT_STR)
    city = serializers.CharField(max_length=120, **_OPT_STR)
    county_or_state = serializers.CharField(max_length=120, **_OPT_STR)
    country = serializers.CharField(max_length=120, **_OPT_STR)
    timezone = serializers.CharField(max_length=64, **_OPT_STR)

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Office name is required.")
        return stripped

    def validate_timezone(self, value: str) -> str:
        stripped = value.strip()
        if stripped and stripped not in _VALID_TIMEZONES:
            raise serializers.ValidationError(
                "Enter a valid IANA timezone "
                "(e.g. Europe/Dublin, America/New_York, UTC)."
            )
        return stripped

    def validate(self, data: dict) -> dict:
        optional_text = (
            "address_line_1",
            "address_line_2",
            "city",
            "county_or_state",
            "country",
        )
        for field in optional_text:
            if field in data and isinstance(data[field], str):
                data[field] = data[field].strip()
        return data


class OfficeResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = [
            "id",
            "name",
            "slug",
            "address_line_1",
            "address_line_2",
            "city",
            "county_or_state",
            "country",
            "timezone",
            "is_active",
            "created_at",
            "updated_at",
        ]


class CreateFloorSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    level_number = serializers.IntegerField(required=False, default=0)

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Floor name is required.")
        return stripped


class FloorResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Floor
        fields = [
            "id",
            "office",
            "name",
            "slug",
            "level_number",
            "is_active",
            "created_at",
            "updated_at",
        ]


_OPT_DECIMAL_10 = {"max_digits": 10, "decimal_places": 2, "required": False}
_OPT_DECIMAL_6 = {"max_digits": 6, "decimal_places": 2, "required": False}


class CreateLayoutObjectSerializer(serializers.Serializer):
    object_type = serializers.ChoiceField(choices=FloorLayoutObject.ObjectType.choices)
    label = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    x = serializers.DecimalField(max_digits=10, decimal_places=2)
    y = serializers.DecimalField(max_digits=10, decimal_places=2)
    width = serializers.DecimalField(max_digits=10, decimal_places=2)
    height = serializers.DecimalField(max_digits=10, decimal_places=2)
    rotation = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, default=0
    )
    is_bookable = serializers.BooleanField(required=False, default=False)
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_label(self, value: str) -> str:
        return value.strip()

    def validate_width(self, value):
        if value <= 0:
            raise serializers.ValidationError("Width must be greater than 0.")
        return value

    def validate_height(self, value):
        if value <= 0:
            raise serializers.ValidationError("Height must be greater than 0.")
        return value

    def validate_metadata(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Metadata must be a JSON object.")
        return value


class UpdateLayoutObjectSerializer(serializers.Serializer):
    object_type = serializers.ChoiceField(
        choices=FloorLayoutObject.ObjectType.choices, required=False
    )
    label = serializers.CharField(max_length=120, required=False, allow_blank=True)
    x = serializers.DecimalField(**_OPT_DECIMAL_10)
    y = serializers.DecimalField(**_OPT_DECIMAL_10)
    width = serializers.DecimalField(**_OPT_DECIMAL_10)
    height = serializers.DecimalField(**_OPT_DECIMAL_10)
    rotation = serializers.DecimalField(**_OPT_DECIMAL_6)
    is_bookable = serializers.BooleanField(required=False)
    metadata = serializers.JSONField(required=False)

    def validate_label(self, value: str) -> str:
        return value.strip()

    def validate_width(self, value):
        if value <= 0:
            raise serializers.ValidationError("Width must be greater than 0.")
        return value

    def validate_height(self, value):
        if value <= 0:
            raise serializers.ValidationError("Height must be greater than 0.")
        return value

    def validate_metadata(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Metadata must be a JSON object.")
        return value


class LayoutObjectResponseSerializer(serializers.ModelSerializer):
    object_type_display = serializers.SerializerMethodField()

    class Meta:
        model = FloorLayoutObject
        fields = [
            "id",
            "floor",
            "object_type",
            "object_type_display",
            "label",
            "x",
            "y",
            "width",
            "height",
            "rotation",
            "is_bookable",
            "metadata",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_object_type_display(self, obj: FloorLayoutObject) -> str:
        return obj.get_object_type_display()


# ─── Desk serializers ─────────────────────────────────────────────────────────

_DESK_STATUS_CHOICES = [(s.value, s.label) for s in Desk.Status]
_OPT_STR_50 = {"required": False, "allow_blank": True, "default": ""}


class CreateDeskSerializer(serializers.Serializer):
    layout_object = serializers.IntegerField()
    name = serializers.CharField(max_length=120)
    code = serializers.CharField(max_length=50, **_OPT_STR_50)
    status = serializers.ChoiceField(
        choices=_DESK_STATUS_CHOICES,
        required=False,
        default=Desk.Status.AVAILABLE,
    )
    amenities = serializers.JSONField(required=False, default=dict)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Desk name is required.")
        return stripped

    def validate_code(self, value: str) -> str:
        return value.strip()

    def validate_amenities(self, value) -> dict:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Amenities must be a JSON object.")
        return value


class UpdateDeskSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    code = serializers.CharField(max_length=50, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=_DESK_STATUS_CHOICES, required=False)
    amenities = serializers.JSONField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Desk name is required.")
        return stripped

    def validate_code(self, value: str) -> str:
        return value.strip()

    def validate_amenities(self, value) -> dict:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Amenities must be a JSON object.")
        return value


class DeskResponseSerializer(serializers.ModelSerializer):
    status_display = serializers.SerializerMethodField()
    layout_object_type = serializers.SerializerMethodField()
    layout_object_label = serializers.SerializerMethodField()

    class Meta:
        model = Desk
        fields = [
            "id",
            "organization",
            "office",
            "floor",
            "layout_object",
            "layout_object_type",
            "layout_object_label",
            "name",
            "code",
            "status",
            "status_display",
            "amenities",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_status_display(self, obj: Desk) -> str:
        return obj.get_status_display()

    def get_layout_object_type(self, obj: Desk) -> str:
        return obj.layout_object.object_type

    def get_layout_object_label(self, obj: Desk) -> str:
        return obj.layout_object.label


# ─── DeskBooking serializers ──────────────────────────────────────────────────


class CreateDeskBookingSerializer(serializers.Serializer):
    desk = serializers.IntegerField()
    booking_date = serializers.DateField()

    def validate_booking_date(self, value):
        today = timezone.now().date()
        if value < today:
            raise serializers.ValidationError("Booking date cannot be in the past.")
        max_date = today + timedelta(days=365)
        if value > max_date:
            raise serializers.ValidationError(
                "Booking date cannot be more than 365 days in the future."
            )
        return value


class DeskBookingResponseSerializer(serializers.ModelSerializer):
    desk_name = serializers.CharField(source="desk.name", read_only=True)
    desk_code = serializers.CharField(source="desk.code", read_only=True)
    layout_object = serializers.IntegerField(
        source="desk.layout_object_id", read_only=True
    )
    user_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    office_name = serializers.SerializerMethodField()
    floor_name = serializers.SerializerMethodField()

    class Meta:
        model = DeskBooking
        fields = [
            "id",
            "organization",
            "office",
            "office_name",
            "floor",
            "floor_name",
            "desk",
            "desk_name",
            "desk_code",
            "layout_object",
            "user",
            "user_name",
            "is_mine",
            "booking_date",
            "status",
            "status_display",
            "cancelled_at",
            "cancelled_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "office",
            "office_name",
            "floor",
            "floor_name",
            "desk",
            "desk_name",
            "desk_code",
            "layout_object",
            "user",
            "user_name",
            "is_mine",
            "booking_date",
            "status",
            "status_display",
            "cancelled_at",
            "cancelled_by",
            "created_at",
            "updated_at",
        ]

    def _can_see_identity(self, obj):
        request = self.context.get("request")
        membership = self.context.get("membership")
        if not request:
            # No request context = Django admin shell / admin site —
            # show identity to maintain admin usability.
            return True
        if obj.user_id is None:
            # Nothing to hide when user has been deleted.
            return True
        if obj.user_id == request.user.id:
            return True
        if membership and user_can_manage_offices(membership):
            return True
        return False

    def get_user_name(self, obj):
        if obj.user is None:
            return "Former user"
        if self._can_see_identity(obj):
            return obj.user.get_full_name() or obj.user.email
        return "Reserved"

    def get_is_mine(self, obj):
        if obj.user is None:
            return False
        request = self.context.get("request")
        if not request:
            return False
        return obj.user_id == request.user.id

    def get_office_name(self, obj) -> str:
        return obj.office.name if obj.office_id else ""

    def get_floor_name(self, obj) -> str:
        return obj.floor.name if obj.floor_id else ""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self._can_see_identity(instance):
            data.pop("user", None)
            data.pop("cancelled_by", None)
        return data
