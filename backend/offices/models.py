from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.text import slugify

if TYPE_CHECKING:
    from accounts.models import Organization


class Office(models.Model):
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="offices",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=120, blank=True)
    county_or_state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    timezone = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"],
                name="unique_office_slug_per_organization",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.organization.name})"

    @classmethod
    def generate_slug(cls, name: str, organization: Organization) -> str:
        base = slugify(name) or "office"
        slug = base
        suffix = 1
        while cls.objects.filter(organization=organization, slug=slug).exists():
            slug = f"{base}-{suffix}"
            suffix += 1
        return slug


class Floor(models.Model):
    office = models.ForeignKey(
        Office,
        on_delete=models.CASCADE,
        related_name="floors",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    level_number = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["level_number", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["office", "slug"],
                name="unique_floor_slug_per_office",
            ),
            models.UniqueConstraint(
                fields=["office", "level_number"],
                name="unique_floor_level_per_office",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} (Level {self.level_number}, {self.office.name})"

    @classmethod
    def generate_slug(cls, name: str, office: Office) -> str:
        base = slugify(name) or "floor"
        slug = base
        suffix = 1
        while cls.objects.filter(office=office, slug=slug).exists():
            slug = f"{base}-{suffix}"
            suffix += 1
        return slug


class FloorLayoutObject(models.Model):
    class ObjectType(models.TextChoices):
        # Workstations
        DESK = "desk", "Desk"
        STANDING_DESK = "standing_desk", "Standing Desk"
        HOT_DESK = "hot_desk", "Hot Desk"
        PRIVATE_DESK = "private_desk", "Private Desk"

        # Seating
        CHAIR = "chair", "Chair"
        OFFICE_CHAIR = "office_chair", "Office Chair"
        MEETING_CHAIR = "meeting_chair", "Meeting Chair"
        LOUNGE_CHAIR = "lounge_chair", "Lounge Chair"
        BENCH = "bench", "Bench"
        SOFA = "sofa", "Sofa"

        # Tables
        TABLE = "table", "Table"
        LUNCH_TABLE = "lunch_table", "Lunch Table"
        BOARDROOM_TABLE = "boardroom_table", "Boardroom Table"
        COFFEE_TABLE = "coffee_table", "Coffee Table"

        # Rooms / zones
        ROOM = "room", "Room"
        MEETING_ROOM = "meeting_room", "Meeting Room"
        QUIET_ROOM = "quiet_room", "Quiet Room"
        FOCUS_ZONE = "focus_zone", "Focus Zone"
        PHONE_BOOTH = "phone_booth", "Phone Booth"
        MEETING_POD = "meeting_pod", "Meeting Pod"

        # Structure
        WALL = "wall", "Wall"
        DOOR = "door", "Door"
        WINDOW = "window", "Window"
        COLUMN = "column", "Column"
        PARTITION = "partition", "Partition"

        # Facilities
        TOILET = "toilet", "Toilet"
        SINK = "sink", "Sink"
        KITCHEN_SINK = "kitchen_sink", "Kitchen Sink"
        CABINET = "cabinet", "Cabinet"
        LOCKER = "locker", "Locker"
        PRINTER = "printer", "Printer"
        TV = "tv", "TV"
        WHITEBOARD = "whiteboard", "Whiteboard"

        # Decor / utility
        PLANT = "plant", "Plant"
        LABEL = "label", "Label"
        SHAPE = "shape", "Shape"

    floor = models.ForeignKey(
        Floor,
        on_delete=models.CASCADE,
        related_name="layout_objects",
    )
    object_type = models.CharField(
        max_length=40,
        choices=ObjectType.choices,
    )
    label = models.CharField(max_length=120, blank=True)

    x = models.DecimalField(max_digits=10, decimal_places=2)
    y = models.DecimalField(max_digits=10, decimal_places=2)
    width = models.DecimalField(max_digits=10, decimal_places=2)
    height = models.DecimalField(max_digits=10, decimal_places=2)
    rotation = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    is_bookable = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["floor"], name="layout_obj_floor_idx"),
            models.Index(
                fields=["floor", "object_type"],
                name="layout_obj_floor_type_idx",
            ),
            models.Index(
                fields=["floor", "is_active"],
                name="layout_obj_floor_active_idx",
            ),
        ]

    def __str__(self) -> str:
        label_part = f" — {self.label}" if self.label else ""
        return f"{self.get_object_type_display()}{label_part} (Floor {self.floor_id})"


# Layout object types that can be converted into bookable desk resources.
DESK_CAPABLE_TYPES: frozenset[str] = frozenset(
    {
        FloorLayoutObject.ObjectType.DESK,
        FloorLayoutObject.ObjectType.STANDING_DESK,
        FloorLayoutObject.ObjectType.HOT_DESK,
        FloorLayoutObject.ObjectType.PRIVATE_DESK,
    }
)


class Desk(models.Model):
    """
    A bookable workplace resource linked to a FloorLayoutObject.

    Desk represents a real seat/resource that will later support booking.
    It is intentionally separate from FloorLayoutObject (which is purely visual).

    A ForeignKey (not OneToOneField) is used for layout_object so that a layout
    object can have multiple historical desk records. At most one active Desk per
    layout object is enforced by a partial unique constraint.
    """

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        UNAVAILABLE = "unavailable", "Unavailable"
        MAINTENANCE = "maintenance", "Maintenance"

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="desks",
    )
    office = models.ForeignKey(
        "offices.Office",
        on_delete=models.CASCADE,
        related_name="desks",
    )
    floor = models.ForeignKey(
        "offices.Floor",
        on_delete=models.CASCADE,
        related_name="desks",
    )
    layout_object = models.ForeignKey(
        "offices.FloorLayoutObject",
        on_delete=models.CASCADE,
        related_name="desks",
    )
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=50, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )
    amenities = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="desk_org_active_idx",
            ),
            models.Index(
                fields=["office", "is_active"],
                name="desk_office_active_idx",
            ),
            models.Index(
                fields=["floor", "is_active"],
                name="desk_floor_active_idx",
            ),
            models.Index(fields=["status"], name="desk_status_idx"),
        ]
        constraints = [
            # At most one active desk per layout object
            models.UniqueConstraint(
                fields=["layout_object"],
                condition=models.Q(is_active=True),
                name="unique_active_desk_per_layout_object",
            ),
        ]

    def __str__(self) -> str:
        code_part = f" [{self.code}]" if self.code else ""
        return f"{self.name}{code_part} ({self.office})"


class DeskBooking(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="desk_bookings",
    )
    office = models.ForeignKey(
        "offices.Office",
        on_delete=models.CASCADE,
        related_name="desk_bookings",
    )
    floor = models.ForeignKey(
        "offices.Floor",
        on_delete=models.CASCADE,
        related_name="desk_bookings",
    )
    desk = models.ForeignKey(
        "offices.Desk",
        on_delete=models.PROTECT,
        related_name="bookings",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="desk_bookings",
    )
    booking_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_bookings",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-booking_date", "created_at"]
        indexes = [
            models.Index(
                fields=["organization", "booking_date", "status"],
                name="db_org_date_status_idx",
            ),
            models.Index(
                fields=["office", "booking_date", "status"],
                name="db_ofc_date_status_idx",
            ),
            models.Index(
                fields=["floor", "booking_date", "status"],
                name="db_flr_date_status_idx",
            ),
            models.Index(
                fields=["desk", "booking_date", "status"],
                name="db_dsk_date_status_idx",
            ),
            models.Index(
                fields=["user", "booking_date", "status"],
                name="db_usr_date_status_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["desk", "booking_date"],
                condition=Q(status="active"),
                name="unique_active_booking_per_desk_date",
            ),
            models.UniqueConstraint(
                fields=["organization", "user", "booking_date"],
                condition=Q(status="active"),
                name="unique_active_booking_per_user_org_date",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"Booking {self.id}: user {self.user_id}"
            f" @ desk {self.desk_id} on {self.booking_date}"
        )
