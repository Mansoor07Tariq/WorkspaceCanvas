from __future__ import annotations

import zoneinfo

from rest_framework import serializers

from .models import Floor, FloorLayoutObject, Office

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
