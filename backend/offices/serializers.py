from __future__ import annotations

import zoneinfo
from datetime import datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Desk,
    DeskBooking,
    Floor,
    FloorLayoutObject,
    MeetingRoom,
    Office,
    RoomBooking,
)
from .permissions import user_can_manage_offices

_VALID_TIMEZONES: frozenset[str] = frozenset(zoneinfo.available_timezones())

_OPT_STR = {"required": False, "allow_blank": True, "default": ""}

# Geometry sanity bounds (canvas px). The floor boundary maxes out at 4000
# (Floor.boundary_width/height validators), so these are generous ceilings that
# reject abuse (e.g. 10^8 coordinates) without rejecting any legitimate layout.
_MAX_COORD = Decimal("100000")
_MAX_SIZE = Decimal("100000")
# Geometry fields an enhance operation is allowed to touch. The apply path must
# never mutate object_type / metadata, because undo only restores
# geometry and those changes would be unrevertable (BE-5).
_GEOMETRY_FIELD_NAMES: frozenset[str] = frozenset(
    {"x", "y", "width", "height", "rotation"}
)


def resolve_office_zone(office) -> zoneinfo.ZoneInfo:
    """Return the office's timezone (BE-3), falling back to the configured
    ``BOOKING_DEFAULT_TIMEZONE`` and finally UTC. Accepts ``None`` (→ default)."""
    tzname = (getattr(office, "timezone", "") or "").strip()
    if tzname not in _VALID_TIMEZONES:
        tzname = settings.BOOKING_DEFAULT_TIMEZONE
    try:
        return zoneinfo.ZoneInfo(tzname)
    except Exception:  # pragma: no cover - guarded by _VALID_TIMEZONES above
        return zoneinfo.ZoneInfo("UTC")


def resolve_office_today(office: Office):
    """Return "today" in the office's timezone.

    Booking dates must be judged against the office's local day, not raw UTC —
    otherwise a user west of UTC is wrongly told the current local day is in the
    past during their evening (BE-3).
    """
    return timezone.now().astimezone(resolve_office_zone(office)).date()


def office_local_to_utc(office, date_, time_):
    """Convert an office-local calendar date + wall-clock time into a UTC-aware
    instant (PR 073). Rooms store UTC instants but users pick local times.

    Rejects DST-invalid local times so a slot can never be persisted with an
    ambiguous or nonexistent instant:
      * nonexistent (spring-forward gap) — the wall time does not exist locally;
      * ambiguous (fall-back repeat) — the wall time occurs twice.
    """
    zone = resolve_office_zone(office)
    naive = datetime.combine(date_, time_)

    # Nonexistent: round-tripping through UTC changes the wall clock.
    aware = naive.replace(tzinfo=zone)
    roundtrip = aware.astimezone(zoneinfo.ZoneInfo("UTC")).astimezone(zone)
    if roundtrip.replace(tzinfo=None) != naive:
        raise serializers.ValidationError(
            "That start/end time does not exist on this date in the office "
            "timezone (daylight-saving change)."
        )
    # Ambiguous: fold=0 and fold=1 resolve to different UTC offsets.
    if (
        naive.replace(tzinfo=zone, fold=0).utcoffset()
        != naive.replace(tzinfo=zone, fold=1).utcoffset()
    ):
        raise serializers.ValidationError(
            "That start/end time is ambiguous on this date in the office "
            "timezone (daylight-saving change)."
        )
    return aware.astimezone(zoneinfo.ZoneInfo("UTC"))


class _LayoutObjectGeometryMixin:
    """Shared geometry-field validation for the create/update layout-object
    serializers: positive sizes, bounded coordinates, normalized rotation."""

    def validate_width(self, value):
        if value <= 0:
            raise serializers.ValidationError("Width must be greater than 0.")
        if value > _MAX_SIZE:
            raise serializers.ValidationError(f"Width must be at most {_MAX_SIZE}.")
        return value

    def validate_height(self, value):
        if value <= 0:
            raise serializers.ValidationError("Height must be greater than 0.")
        if value > _MAX_SIZE:
            raise serializers.ValidationError(f"Height must be at most {_MAX_SIZE}.")
        return value

    def validate_x(self, value):
        if abs(value) > _MAX_COORD:
            raise serializers.ValidationError(
                f"x must be between -{_MAX_COORD} and {_MAX_COORD}."
            )
        return value

    def validate_y(self, value):
        if abs(value) > _MAX_COORD:
            raise serializers.ValidationError(
                f"y must be between -{_MAX_COORD} and {_MAX_COORD}."
            )
        return value

    def validate_rotation(self, value):
        if value is None:
            return value
        # Normalize to [0, 360). Decimal % follows the dividend's sign (so
        # -90 % 360 == -90), so fold negatives back into range explicitly.
        normalized = value % Decimal(360)
        if normalized < 0:
            normalized += Decimal(360)
        return normalized


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
            "organization",
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


class UpdateFloorSerializer(serializers.Serializer):
    """Partial update for a floor. Currently only the editable boundary
    dimensions (inner room width/height, in canvas px). Bounds mirror the model
    validators so invalid sizes are rejected as 400, not 500."""

    boundary_width = serializers.DecimalField(
        max_digits=7, decimal_places=2, min_value=240, max_value=4000, required=False
    )
    boundary_height = serializers.DecimalField(
        max_digits=7, decimal_places=2, min_value=240, max_value=4000, required=False
    )
    # Setup-lifecycle transition (PR 064): publish (make bookable) or unpublish
    # (back to draft for editing). Validated against the model's choices.
    status = serializers.ChoiceField(choices=Floor.Status.choices, required=False)

    def validate(self, attrs: dict) -> dict:
        if not attrs:
            raise serializers.ValidationError("No updatable fields provided.")
        return attrs


class FloorResponseSerializer(serializers.ModelSerializer):
    # TD-045: expose the owning organization so the frontend can resolve the
    # correct per-office membership/role for UI gating (backend still enforces
    # permissions independently). Derived from the office FK — no privacy leak
    # (the org id is already known to any member of that org).
    organization = serializers.IntegerField(
        source="office.organization_id", read_only=True
    )

    class Meta:
        model = Floor
        fields = [
            "id",
            "organization",
            "office",
            "name",
            "slug",
            "level_number",
            "boundary_width",
            "boundary_height",
            "status",
            "is_active",
            "created_at",
            "updated_at",
        ]


_OPT_DECIMAL_10 = {"max_digits": 10, "decimal_places": 2, "required": False}
_OPT_DECIMAL_6 = {"max_digits": 6, "decimal_places": 2, "required": False}


class CreateLayoutObjectSerializer(_LayoutObjectGeometryMixin, serializers.Serializer):
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
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_label(self, value: str) -> str:
        return value.strip()

    def validate_metadata(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Metadata must be a JSON object.")
        return value


class UpdateLayoutObjectSerializer(_LayoutObjectGeometryMixin, serializers.Serializer):
    object_type = serializers.ChoiceField(
        choices=FloorLayoutObject.ObjectType.choices, required=False
    )
    label = serializers.CharField(max_length=120, required=False, allow_blank=True)
    x = serializers.DecimalField(**_OPT_DECIMAL_10)
    y = serializers.DecimalField(**_OPT_DECIMAL_10)
    width = serializers.DecimalField(**_OPT_DECIMAL_10)
    height = serializers.DecimalField(**_OPT_DECIMAL_10)
    rotation = serializers.DecimalField(**_OPT_DECIMAL_6)
    metadata = serializers.JSONField(required=False)

    def validate_label(self, value: str) -> str:
        return value.strip()

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


# ─── Booking response serializers ─────────────────────────────────────────────


class _IdentityMaskingMixin:
    """Shared booking-identity masking for the desk + room response serializers.

    A booking's identity — the ``user`` and ``cancelled_by`` — is visible only to the
    booking's owner, a manager (``user_can_manage_offices``), or the admin shell (no
    request in context). Everyone else sees ``user_name = "Reserved"`` and the
    ``user`` / ``cancelled_by`` fields are dropped from the representation. Behaviour
    is byte-identical to the per-serializer methods it replaces (PR 076).

    Host serializer must declare ``user_name``/``is_mine`` SerializerMethodFields and
    include ``user``/``cancelled_by`` in ``fields``.
    """

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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self._can_see_identity(instance):
            data.pop("user", None)
            data.pop("cancelled_by", None)
        return data


class CreateDeskBookingSerializer(serializers.Serializer):
    desk = serializers.IntegerField()
    booking_date = serializers.DateField()

    def validate_booking_date(self, value):
        # "Today" is judged in the office's timezone (BE-3), passed via context.
        # Without an office in context (defensive), fall back to the configured
        # default timezone rather than raw UTC.
        office = self.context.get("office")
        if office is not None:
            today = resolve_office_today(office)
        else:
            tzname = settings.BOOKING_DEFAULT_TIMEZONE
            today = timezone.now().astimezone(zoneinfo.ZoneInfo(tzname)).date()
        if value < today:
            raise serializers.ValidationError("Booking date cannot be in the past.")
        max_date = today + timedelta(days=365)
        if value > max_date:
            raise serializers.ValidationError(
                "Booking date cannot be more than 365 days in the future."
            )
        return value


class DeskBookingResponseSerializer(_IdentityMaskingMixin, serializers.ModelSerializer):
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

    def get_office_name(self, obj) -> str:
        return obj.office.name if obj.office_id else ""

    def get_floor_name(self, obj) -> str:
        return obj.floor.name if obj.floor_id else ""


# ─── Meeting rooms (PR 073) ───────────────────────────────────────────────────


class CreateMeetingRoomSerializer(serializers.Serializer):
    """Admin creates a bookable room on a room-capable layout object. ``capacity``
    defaults to 1; the view resolves/validates the layout object + room-capability."""

    layout_object = serializers.IntegerField()
    name = serializers.CharField(max_length=120)
    capacity = serializers.IntegerField(min_value=1, required=False, default=1)
    amenities = serializers.DictField(required=False, default=dict)
    notes = serializers.CharField(**_OPT_STR)

    def validate_name(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Name cannot be blank.")
        return cleaned


class MeetingRoomResponseSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    layout_object_type = serializers.CharField(
        source="layout_object.object_type", read_only=True
    )
    layout_object_label = serializers.CharField(
        source="layout_object.label", read_only=True
    )

    class Meta:
        model = MeetingRoom
        fields = [
            "id",
            "organization",
            "office",
            "floor",
            "layout_object",
            "layout_object_type",
            "layout_object_label",
            "name",
            "capacity",
            "status",
            "status_display",
            "amenities",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CreateRoomBookingSerializer(serializers.Serializer):
    """Create a room slot booking. The user submits an office-LOCAL date + start/
    end times; ``validate`` converts them to UTC instants and enforces the slot
    rules (intra-day, min/max duration, not past, within the 365-day horizon).
    Office is passed via context for the timezone resolution (BE-3)."""

    room = serializers.IntegerField()
    booking_date = serializers.DateField()
    start = serializers.TimeField()
    end = serializers.TimeField()

    def validate(self, attrs: dict) -> dict:
        office = self.context.get("office")
        booking_date = attrs["booking_date"]
        start = attrs["start"]
        end = attrs["end"]

        # Intra-day: both times share booking_date, so end after start suffices.
        if end <= start:
            raise serializers.ValidationError(
                {"end": "End time must be after start time."}
            )

        today = resolve_office_today(office)
        if booking_date < today:
            raise serializers.ValidationError(
                {"booking_date": "Booking date cannot be in the past."}
            )
        if booking_date > today + timedelta(days=365):
            raise serializers.ValidationError(
                {
                    "booking_date": (
                        "Booking date cannot be more than 365 days in the future."
                    )
                }
            )

        # Local wall-clock → UTC instants (rejects DST-invalid times).
        start_at = office_local_to_utc(office, booking_date, start)
        end_at = office_local_to_utc(office, booking_date, end)

        duration_min = (end_at - start_at).total_seconds() / 60
        if duration_min < settings.ROOM_BOOKING_MIN_MINUTES:
            raise serializers.ValidationError(
                f"Booking must be at least {settings.ROOM_BOOKING_MIN_MINUTES} "
                "minutes long."
            )
        if duration_min > settings.ROOM_BOOKING_MAX_MINUTES:
            raise serializers.ValidationError(
                f"Booking cannot exceed {settings.ROOM_BOOKING_MAX_MINUTES} minutes."
            )

        if start_at < timezone.now():
            raise serializers.ValidationError(
                {"start": "Booking start time cannot be in the past."}
            )

        attrs["start_at"] = start_at
        attrs["end_at"] = end_at
        return attrs


class RoomBookingResponseSerializer(_IdentityMaskingMixin, serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)
    room_capacity = serializers.IntegerField(source="room.capacity", read_only=True)
    layout_object = serializers.IntegerField(
        source="room.layout_object_id", read_only=True
    )
    user_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    office_name = serializers.SerializerMethodField()
    floor_name = serializers.SerializerMethodField()
    # Office IANA timezone for rendering start_at/end_at (UTC instants) in office-
    # local time on the client (PR 076). Falls back to the configured default so the
    # field is never empty/misleading. Additive, read-only — no migration.
    office_timezone = serializers.SerializerMethodField()

    class Meta:
        model = RoomBooking
        fields = [
            "id",
            "organization",
            "office",
            "office_name",
            "office_timezone",
            "floor",
            "floor_name",
            "room",
            "room_name",
            "room_capacity",
            "layout_object",
            "user",
            "user_name",
            "is_mine",
            "booking_date",
            "start_at",
            "end_at",
            "status",
            "status_display",
            "cancelled_at",
            "cancelled_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_office_name(self, obj) -> str:
        return obj.office.name if obj.office_id else ""

    def get_floor_name(self, obj) -> str:
        return obj.floor.name if obj.floor_id else ""

    def get_office_timezone(self, obj) -> str:
        tzname = ""
        if obj.office_id:
            tzname = (getattr(obj.office, "timezone", "") or "").strip()
        # Guarantee a valid IANA name so the client never has to guess (mirrors
        # resolve_office_zone's fallback chain).
        if tzname not in _VALID_TIMEZONES:
            return settings.BOOKING_DEFAULT_TIMEZONE
        return tzname


# ─── EnhanceRun serializers ───────────────────────────────────────────────────


class EnhanceOperationInputSerializer(serializers.Serializer):
    """A single object's enhancement operation. Geometry dicts carry
    {x, y, width, height, rotation} as strings (2-decimal canvas px).

    ``before``/``after``/``patch`` are restricted to geometry keys only: the
    enhance path must never mutate object_type/metadata, because
    undo restores geometry only and such changes would be unrevertable (BE-5).
    """

    object_id = serializers.IntegerField()
    before = serializers.DictField()
    after = serializers.DictField()
    patch = serializers.DictField()
    reason_codes = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

    def _geometry_only(self, value: dict, field_name: str) -> dict:
        extra = set(value.keys()) - _GEOMETRY_FIELD_NAMES
        if extra:
            raise serializers.ValidationError(
                f"'{field_name}' may only contain geometry fields "
                f"{sorted(_GEOMETRY_FIELD_NAMES)}; got unexpected {sorted(extra)}."
            )
        return value

    def validate_before(self, value):
        return self._geometry_only(value, "before")

    def validate_after(self, value):
        return self._geometry_only(value, "after")

    def validate_patch(self, value):
        return self._geometry_only(value, "patch")


# A single apply may not touch more objects than a floor could plausibly hold —
# caps the per-request DB write amplification of an unbounded operations array
# (BE-11). Real floors carry a few hundred objects at most.
_MAX_ENHANCE_OPERATIONS = 1000


class ApplyEnhanceRunSerializer(serializers.Serializer):
    plan_id = serializers.CharField(max_length=64)
    operations = EnhanceOperationInputSerializer(many=True)
    summary = serializers.DictField(required=False, default=dict)
    diagnostics = serializers.ListField(required=False, default=list)

    def validate_operations(self, value):
        if not value:
            raise serializers.ValidationError("At least one operation is required.")
        if len(value) > _MAX_ENHANCE_OPERATIONS:
            raise serializers.ValidationError(
                f"Too many operations (max {_MAX_ENHANCE_OPERATIONS})."
            )
        return value


class OrganizationSummarySerializer(serializers.Serializer):
    """Org-wide workspace summary for the dashboard (TD-035).

    Count-only — exposes no member identities, booking identities, or
    invitation tokens. ``pending_invitations_count`` is gated to managers in
    the view and returned as 0 for regular members.
    """

    organization = serializers.IntegerField()
    offices_count = serializers.IntegerField()
    floors_count = serializers.IntegerField()
    layout_objects_count = serializers.IntegerField()
    bookable_desks_count = serializers.IntegerField()
    active_members_count = serializers.IntegerField()
    pending_invitations_count = serializers.IntegerField()
    has_offices = serializers.BooleanField()
    has_floors = serializers.BooleanField()
    has_layout_objects = serializers.BooleanField()
    has_bookable_desks = serializers.BooleanField()
    setup_complete = serializers.BooleanField()
