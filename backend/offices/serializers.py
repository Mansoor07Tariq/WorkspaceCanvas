from __future__ import annotations

import zoneinfo

from rest_framework import serializers

from .models import Floor, Office

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
