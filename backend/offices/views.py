from __future__ import annotations

import datetime
import logging

from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from accounts.models import Invitation, Membership

from .models import (
    DESK_CAPABLE_TYPES,
    ROOM_CAPABLE_TYPES,
    Desk,
    DeskBooking,
    EnhanceRun,
    EnhanceRunOperation,
    Floor,
    FloorLayoutObject,
    MeetingRoom,
    Office,
    RoomBooking,
)
from .permissions import (
    get_first_active_membership,
    get_floor_for_office,
    get_office_for_user,
    resolve_membership,
    user_can_manage_offices,
)
from .serializers import (
    ApplyEnhanceRunSerializer,
    CreateDeskBookingSerializer,
    CreateDeskSerializer,
    CreateFloorSerializer,
    CreateLayoutObjectSerializer,
    CreateMeetingRoomSerializer,
    CreateOfficeSerializer,
    CreateRoomBookingSerializer,
    DeskBookingResponseSerializer,
    DeskResponseSerializer,
    FloorResponseSerializer,
    LayoutObjectResponseSerializer,
    MeetingRoomResponseSerializer,
    OfficeResponseSerializer,
    OrganizationSummarySerializer,
    RoomBookingResponseSerializer,
    UpdateDeskSerializer,
    UpdateFloorSerializer,
    UpdateLayoutObjectSerializer,
    UsualDeskSerializer,
)
from .services.booking_service import (
    BookingDeskNotAvailableError,
    BookingFloorNotPublishedError,
    DeskBookingAlreadyCancelledError,
    DuplicateBookingError,
    cancel_active_bookings_for_desk,
    cancel_desk_booking,
    create_booking_for_user,
    get_my_desk_booking,
    list_my_desk_bookings,
    resolve_usual_desk,
)
from .services.enhance_run_service import (
    EnhanceRunNotFoundError,
    EnhanceRunService,
)
from .services.room_booking_service import (
    RoomBookingAlreadyCancelledError,
    RoomBookingService,
    RoomFloorNotPublishedError,
    RoomNotAvailableError,
    RoomSlotConflictError,
    list_my_room_bookings,
)

logger = logging.getLogger(__name__)

_MAX_SLUG_RETRIES = 5
_SLUG_ERROR = "Could not generate a unique office slug. Please try a different name."
_FLOOR_SLUG_ERROR = (
    "Could not generate a unique floor slug. Please try a different name."
)
_NO_MEMBERSHIP = "You do not have an active organization membership."
_NO_MANAGE_OFFICES = "Only organization owners and admins can manage offices."


def _selected_org_id(request: Request) -> int | None:
    """Parse the optional ``?organization=<id>`` selected-org query param.

    Returns the int id, or None when absent/blank/non-numeric (callers then
    fall back to the first active membership). The id is never trusted on its
    own — ``resolve_membership`` validates it against the caller's active
    memberships.
    """
    raw = request.query_params.get("organization")
    if not raw:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _throttle_cache_key(throttle: SimpleRateThrottle, request: Request) -> str:
    """Shared cache key builder for all fixed-scope throttle classes."""
    if request.user.is_authenticated:
        ident = request.user.pk
    else:
        ident = throttle.get_ident(request)
    return throttle.cache_format % {"scope": throttle.scope, "ident": ident}


_DEFAULT_PAGE_SIZE = 100
_MAX_PAGE_SIZE = 500


def _maybe_paginate_qs(request: Request, queryset):
    """Opt-in, backward-compatible pagination for list endpoints (BE-10).

    These endpoints are plain APIViews that historically return a bare JSON
    array, and the SPA depends on that shape. To bound an otherwise unbounded
    response without breaking existing clients, pagination is *opt-in*: only when
    ``?page`` or ``?page_size`` is present does this apply a DB-level slice and
    signal an envelope. Returns ``(rows, None)`` for the legacy array response, or
    ``(rows, meta)`` where ``meta`` = ``{count, page, page_size, num_pages}`` — the
    caller wraps the serialized rows as ``{"results": rows, **meta}``.
    """
    page_param = request.query_params.get("page")
    size_param = request.query_params.get("page_size")
    if page_param is None and size_param is None:
        return queryset, None
    try:
        page = max(1, int(page_param)) if page_param is not None else 1
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(size_param) if size_param is not None else _DEFAULT_PAGE_SIZE
    except (TypeError, ValueError):
        page_size = _DEFAULT_PAGE_SIZE
    page_size = max(1, min(page_size, _MAX_PAGE_SIZE))
    total = queryset.count()
    start = (page - 1) * page_size
    meta = {
        "count": total,
        "page": page,
        "page_size": page_size,
        "num_pages": (total + page_size - 1) // page_size if page_size else 1,
    }
    return queryset[start : start + page_size], meta


class _PostScopedThrottle(SimpleRateThrottle):
    """Applies the office_create throttle scope only on POST requests."""

    scope = "office_create"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _throttle_cache_key(self, request)

    def allow_request(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class _FloorPostScopedThrottle(SimpleRateThrottle):
    """Applies the floor_create throttle scope only on POST requests."""

    scope = "floor_create"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _throttle_cache_key(self, request)

    def allow_request(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class OrganizationSummaryView(APIView):
    """Org-wide workspace summary for the dashboard (TD-035).

    Resolves the organization from the caller's first active membership —
    consistent with every other offices endpoint. Counts are org-wide (all
    offices/floors), not first-office-only, and use aggregate ``count()``
    queries to avoid N+1.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: OrganizationSummarySerializer},
        summary="Org-wide workspace summary for the current user's organization",
    )
    def get(self, request: Request) -> Response:
        # PR 055: honour an explicit selected org (?organization=), validated
        # against the caller's active memberships; else first active membership.
        membership = resolve_membership(request.user, _selected_org_id(request))
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP},
                status=status.HTTP_403_FORBIDDEN,
            )
        org = membership.organization

        offices_count = Office.objects.filter(organization=org, is_active=True).count()
        floors_count = Floor.objects.filter(
            office__organization=org,
            office__is_active=True,
            is_active=True,
        ).count()
        layout_objects_count = FloorLayoutObject.objects.filter(
            floor__office__organization=org,
            floor__office__is_active=True,
            floor__is_active=True,
            is_active=True,
        ).count()
        # "Bookable desks" = active desk resources on an active floor/office,
        # mirroring the desk list endpoint (is_active=True). Decommissioned
        # desks and those on archived floors/offices are excluded.
        bookable_desks_count = Desk.objects.filter(
            organization=org,
            is_active=True,
            office__is_active=True,
            floor__is_active=True,
        ).count()
        active_members_count = Membership.objects.filter(
            organization=org,
            status=Membership.Status.ACTIVE,
        ).count()

        # Pending invitation count is manager-only; members get 0 so the
        # endpoint stays safe to read for every active member.
        if user_can_manage_offices(membership):
            pending_invitations_count = Invitation.objects.filter(
                organization=org,
                status=Invitation.Status.PENDING,
            ).count()
        else:
            pending_invitations_count = 0

        has_offices = offices_count > 0
        has_floors = floors_count > 0
        has_layout_objects = layout_objects_count > 0
        has_bookable_desks = bookable_desks_count > 0
        setup_complete = has_offices and has_floors and has_bookable_desks

        data = {
            "organization": org.id,
            "offices_count": offices_count,
            "floors_count": floors_count,
            "layout_objects_count": layout_objects_count,
            "bookable_desks_count": bookable_desks_count,
            "active_members_count": active_members_count,
            "pending_invitations_count": pending_invitations_count,
            "has_offices": has_offices,
            "has_floors": has_floors,
            "has_layout_objects": has_layout_objects,
            "has_bookable_desks": has_bookable_desks,
            "setup_complete": setup_complete,
        }
        return Response(OrganizationSummarySerializer(data).data)


class OfficeListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_PostScopedThrottle]

    @extend_schema(
        responses={200: OfficeResponseSerializer(many=True)},
        summary="List offices for the current user's active organization",
    )
    def get(self, request: Request) -> Response:
        # PR 055: optional ?organization= selects which org's offices to list,
        # validated against active memberships; else first active membership.
        membership = resolve_membership(request.user, _selected_org_id(request))
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP},
                status=status.HTTP_403_FORBIDDEN,
            )
        offices = Office.objects.filter(
            organization=membership.organization,
            is_active=True,
        )
        return Response(OfficeResponseSerializer(offices, many=True).data)

    @extend_schema(
        request=CreateOfficeSerializer,
        responses={201: OfficeResponseSerializer},
        summary="Create an office in the current user's active organization",
    )
    def post(self, request: Request) -> Response:
        # PR 055: create the office in the selected org (?organization=) when
        # provided, else the first active membership's org.
        membership = resolve_membership(request.user, _selected_org_id(request))
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CreateOfficeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        org = membership.organization

        for attempt in range(_MAX_SLUG_RETRIES):
            slug = Office.generate_slug(data["name"], org)
            try:
                with transaction.atomic():
                    office = Office.objects.create(
                        organization=org,
                        name=data["name"],
                        slug=slug,
                        address_line_1=data.get("address_line_1", ""),
                        address_line_2=data.get("address_line_2", ""),
                        city=data.get("city", ""),
                        county_or_state=data.get("county_or_state", ""),
                        country=data.get("country", ""),
                        timezone=data.get("timezone", ""),
                    )
                return Response(
                    OfficeResponseSerializer(office).data,
                    status=status.HTTP_201_CREATED,
                )
            except IntegrityError:
                if attempt == _MAX_SLUG_RETRIES - 1:
                    return Response(
                        {"detail": _SLUG_ERROR},
                        status=status.HTTP_409_CONFLICT,
                    )
                continue

        return Response(
            {"detail": _SLUG_ERROR},
            status=status.HTTP_409_CONFLICT,
        )


class FloorListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_FloorPostScopedThrottle]

    @extend_schema(
        responses={200: FloorResponseSerializer(many=True)},
        summary="List active floors for a given office",
    )
    def get(self, request: Request, office_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP},
                status=status.HTTP_403_FORBIDDEN,
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        # select_related("office") so the serializer's office.organization_id
        # (TD-045) does not trigger a per-floor query.
        floors = Floor.objects.select_related("office").filter(
            office=office, is_active=True
        )
        return Response(FloorResponseSerializer(floors, many=True).data)

    @extend_schema(
        request=CreateFloorSerializer,
        responses={201: FloorResponseSerializer},
        summary="Create a floor in the given office",
    )
    def post(self, request: Request, office_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP},
                status=status.HTTP_403_FORBIDDEN,
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CreateFloorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        _LEVEL_EXISTS = "A floor with this level number already exists in this office."
        level_taken = Floor.objects.filter(
            office=office, level_number=data["level_number"]
        ).exists()
        if level_taken:
            return Response(
                {"level_number": [_LEVEL_EXISTS]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for attempt in range(_MAX_SLUG_RETRIES):
            slug = Floor.generate_slug(data["name"], office)
            try:
                with transaction.atomic():
                    floor = Floor.objects.create(
                        office=office,
                        name=data["name"],
                        slug=slug,
                        level_number=data["level_number"],
                    )
                return Response(
                    FloorResponseSerializer(floor).data,
                    status=status.HTTP_201_CREATED,
                )
            except IntegrityError as exc:
                exc_str = str(exc)
                level_conflict = "unique_floor_level_per_office" in exc_str or (
                    "level_number" in exc_str and "unique" in exc_str.lower()
                )
                if level_conflict:
                    return Response(
                        {"level_number": [_LEVEL_EXISTS]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if attempt == _MAX_SLUG_RETRIES - 1:
                    return Response(
                        {"detail": _FLOOR_SLUG_ERROR},
                        status=status.HTTP_409_CONFLICT,
                    )
                continue

        return Response(
            {"detail": _FLOOR_SLUG_ERROR},
            status=status.HTTP_409_CONFLICT,
        )


class FloorDetailView(APIView):
    """Update a single floor. Currently scoped to the editable boundary
    dimensions; owners/admins only. Tenant isolation via get_office_for_user."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [_FloorPostScopedThrottle]

    @extend_schema(
        request=UpdateFloorSerializer,
        responses={200: FloorResponseSerializer},
        summary="Update a floor (boundary dimensions)",
    )
    def patch(self, request: Request, office_id: int, floor_id: int) -> Response:
        if get_first_active_membership(request.user) is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = UpdateFloorSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        for field, value in serializer.validated_data.items():
            setattr(floor, field, value)
        floor.save()
        return Response(FloorResponseSerializer(floor).data)


_WRITE_METHODS = frozenset({"POST", "PATCH", "DELETE"})


class _LayoutObjectWriteThrottle(SimpleRateThrottle):
    """Applies the layout_object_write throttle scope on write requests."""

    scope = "layout_object_write"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _throttle_cache_key(self, request)

    def allow_request(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method not in _WRITE_METHODS:
            return True
        return super().allow_request(request, view)


def _provision_desk_for_object(
    obj: FloorLayoutObject, office: Office, floor: Floor
) -> None:
    """Auto-provision the bookable Desk resource for a desk-capable layout
    object, unless one is already active. Code is left blank (excluded from the
    per-office code-uniqueness constraint). Caller runs inside a transaction."""
    if obj.desks.filter(is_active=True).exists():
        return
    Desk.objects.create(
        organization=office.organization,
        office=office,
        floor=floor,
        layout_object=obj,
        name=obj.label or f"Desk {obj.id}",
        code="",
        status=Desk.Status.AVAILABLE,
    )


def _retire_active_desks(obj: FloorLayoutObject, *, cancelled_by) -> None:
    """Deactivate any active Desk on this layout object and cancel its active
    bookings, so a no-longer-desk object stops being bookable. Caller runs
    inside a transaction."""
    for desk in obj.desks.filter(is_active=True):
        cancel_active_bookings_for_desk(desk, cancelled_by=cancelled_by)
        desk.is_active = False
        desk.save(update_fields=["is_active", "updated_at"])


class LayoutObjectListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_LayoutObjectWriteThrottle]

    def get(self, request: Request, office_id: int, floor_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        objects = FloorLayoutObject.objects.filter(floor=floor, is_active=True)
        page_qs, meta = _maybe_paginate_qs(request, objects)
        data = LayoutObjectResponseSerializer(page_qs, many=True).data
        if meta is None:
            return Response(data)
        return Response({"results": data, **meta})

    def post(self, request: Request, office_id: int, floor_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = CreateLayoutObjectSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        with transaction.atomic():
            obj = FloorLayoutObject.objects.create(
                floor=floor,
                object_type=data["object_type"],
                label=data["label"],
                x=data["x"],
                y=data["y"],
                width=data["width"],
                height=data["height"],
                rotation=data["rotation"],
                metadata=data["metadata"],
            )
            # A desk drawn on the canvas is bookable immediately — provision its
            # Desk resource automatically so admins don't link one by hand.
            if obj.object_type in DESK_CAPABLE_TYPES:
                _provision_desk_for_object(obj, office, floor)
        return Response(
            LayoutObjectResponseSerializer(obj).data,
            status=status.HTTP_201_CREATED,
        )


class LayoutObjectDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_LayoutObjectWriteThrottle]

    def _get_object(
        self,
        user,
        office_id: int,
        floor_id: int,
        object_id: int,
    ):
        # PR 055: resolve the office among the caller's active orgs and return
        # the per-office membership (so role checks use the office's org).
        # Returns (obj, err_response, membership, office, floor).
        office, membership = get_office_for_user(user, office_id)
        if office is None:
            return (
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
                None,
                None,
                None,
            )
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return (
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
                None,
                None,
                None,
            )
        try:
            obj = FloorLayoutObject.objects.get(
                pk=object_id, floor=floor, is_active=True
            )
        except FloorLayoutObject.DoesNotExist:
            return (
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
                None,
                None,
                None,
            )
        return obj, None, membership, office, floor

    def patch(
        self, request: Request, office_id: int, floor_id: int, object_id: int
    ) -> Response:
        if get_first_active_membership(request.user) is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        obj, err, membership, office, floor = self._get_object(
            request.user, office_id, floor_id, object_id
        )
        if err is not None:
            return err
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = UpdateLayoutObjectSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            # Keep the linked Desk resource consistent when object_type crosses
            # the desk-capable boundary (BE-1): leaving it retires the desk and
            # cancels its bookings; entering it auto-provisions one, mirroring the
            # create path. Without this, a desk→plant PATCH would strand a
            # bookable Desk on a non-desk object.
            was_desk_capable = obj.object_type in DESK_CAPABLE_TYPES
            for field, value in serializer.validated_data.items():
                setattr(obj, field, value)
            obj.save()
            now_desk_capable = obj.object_type in DESK_CAPABLE_TYPES
            if was_desk_capable and not now_desk_capable:
                _retire_active_desks(obj, cancelled_by=request.user)
            elif now_desk_capable and not was_desk_capable:
                _provision_desk_for_object(obj, office, floor)
        return Response(LayoutObjectResponseSerializer(obj).data)

    def delete(
        self, request: Request, office_id: int, floor_id: int, object_id: int
    ) -> Response:
        if get_first_active_membership(request.user) is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        obj, err, membership, office, floor = self._get_object(
            request.user, office_id, floor_id, object_id
        )
        if err is not None:
            return err
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        with transaction.atomic():
            # Retire any auto-provisioned desk (and cancel its bookings) so a
            # deleted desk object stops being bookable.
            _retire_active_desks(obj, cancelled_by=request.user)
            obj.is_active = False
            obj.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


_NO_DESK_CAPABLE = (
    "This layout object type cannot be set up as a bookable desk. "
    "Only desk, standing_desk, hot_desk, and private_desk types are supported."
)
_DESK_ALREADY_EXISTS = "This layout object already has an active desk resource."
_DESK_CODE_TAKEN = "A desk with this code already exists in this office."


class _DeskWriteThrottle(SimpleRateThrottle):
    """Applies the desk_write throttle scope on write requests."""

    scope = "desk_write"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _throttle_cache_key(self, request)

    def allow_request(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method not in _WRITE_METHODS:
            return True
        return super().allow_request(request, view)


class DeskListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskWriteThrottle]

    def get(self, request: Request, office_id: int, floor_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        desks = Desk.objects.filter(floor=floor, is_active=True).select_related(
            "layout_object"
        )
        return Response(DeskResponseSerializer(desks, many=True).data)

    def post(self, request: Request, office_id: int, floor_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateDeskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        # Validate layout object belongs to this floor and is active
        try:
            layout_object = FloorLayoutObject.objects.get(
                pk=data["layout_object"],
                floor=floor,
                is_active=True,
            )
        except FloorLayoutObject.DoesNotExist:
            return Response(
                {"layout_object": ["Layout object not found on this floor."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate object type is desk-capable
        if layout_object.object_type not in DESK_CAPABLE_TYPES:
            return Response(
                {"layout_object": [_NO_DESK_CAPABLE]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate no active desk already exists for this layout object
        if Desk.objects.filter(layout_object=layout_object, is_active=True).exists():
            return Response(
                {"layout_object": [_DESK_ALREADY_EXISTS]},
                status=status.HTTP_409_CONFLICT,
            )

        # Validate code uniqueness per office
        code = data.get("code", "")
        if (
            code
            and Desk.objects.filter(office=office, code=code, is_active=True).exists()
        ):
            return Response(
                {"code": [_DESK_CODE_TAKEN]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            desk = Desk.objects.create(
                organization=membership.organization,
                office=office,
                floor=floor,
                layout_object=layout_object,
                name=data["name"],
                code=code,
                status=data.get("status", Desk.Status.AVAILABLE),
                amenities=data.get("amenities", {}),
                notes=data.get("notes", ""),
            )
        except IntegrityError as exc:
            exc_str = str(exc)
            if "unique_active_desk_code_per_office" in exc_str:
                return Response(
                    {"code": [_DESK_CODE_TAKEN]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            raise
        return Response(
            DeskResponseSerializer(desk).data,
            status=status.HTTP_201_CREATED,
        )


class DeskDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskWriteThrottle]

    def _get_desk(self, user, office_id: int, floor_id: int, desk_id: int):
        # PR 055: resolve office among the caller's active orgs + per-office membership.
        office, membership = get_office_for_user(user, office_id)
        if office is None:
            return (
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
                None,
            )
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return (
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
                None,
            )
        try:
            desk = Desk.objects.select_related("layout_object").get(
                pk=desk_id, floor=floor, is_active=True
            )
        except Desk.DoesNotExist:
            return (
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
                None,
            )
        return desk, None, membership

    def get(
        self, request: Request, office_id: int, floor_id: int, desk_id: int
    ) -> Response:
        if get_first_active_membership(request.user) is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        desk, err, _membership = self._get_desk(
            request.user, office_id, floor_id, desk_id
        )
        if err is not None:
            return err
        return Response(DeskResponseSerializer(desk).data)

    def patch(
        self, request: Request, office_id: int, floor_id: int, desk_id: int
    ) -> Response:
        if get_first_active_membership(request.user) is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        desk, err, membership = self._get_desk(
            request.user, office_id, floor_id, desk_id
        )
        if err is not None:
            return err
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = UpdateDeskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        # Validate code uniqueness per office (excluding current desk)
        code = data.get("code")
        if code is not None and code:
            if (
                Desk.objects.filter(office=desk.office, code=code, is_active=True)
                .exclude(pk=desk.pk)
                .exists()
            ):
                return Response(
                    {"code": [_DESK_CODE_TAKEN]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        for field, value in data.items():
            setattr(desk, field, value)
        try:
            desk.save()
        except IntegrityError as exc:
            exc_str = str(exc)
            if "unique_active_desk_code_per_office" in exc_str:
                return Response(
                    {"code": [_DESK_CODE_TAKEN]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            raise
        return Response(DeskResponseSerializer(desk).data)

    def delete(
        self, request: Request, office_id: int, floor_id: int, desk_id: int
    ) -> Response:
        if get_first_active_membership(request.user) is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        desk, err, membership = self._get_desk(
            request.user, office_id, floor_id, desk_id
        )
        if err is not None:
            return err
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        with transaction.atomic():
            # Cancel all active bookings before soft-deleting the desk.
            # cancelled_by is set to the requesting user for API-driven deactivation.
            # The post_save signal (TD-011) also runs after desk.save() but finds
            # no remaining ACTIVE bookings, so it is a safe no-op here.
            cancel_active_bookings_for_desk(desk, cancelled_by=request.user)
            desk.is_active = False
            desk.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class _DeskBookingWriteThrottle(SimpleRateThrottle):
    scope = "desk_booking_write"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _throttle_cache_key(self, request)


class _DeskBookingReadThrottle(SimpleRateThrottle):
    scope = "desk_booking_read"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _throttle_cache_key(self, request)


class DeskBookingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "POST":
            return [_DeskBookingWriteThrottle()]
        return [_DeskBookingReadThrottle()]

    def get(self, request: Request, office_id: int, floor_id: int) -> Response:
        # NOTE: get_first_active_membership resolves the alphabetically-first org.
        # Users with memberships in multiple orgs may experience unexpected org
        # resolution. This is a pre-existing limitation. See docs for details.
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        date_str = request.query_params.get("date")
        if not date_str:
            return Response(
                {"detail": "date query parameter is required (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            booking_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bookings = (
            DeskBooking.objects.filter(
                floor=floor,
                booking_date=booking_date,
                status=DeskBooking.Status.ACTIVE,
            )
            # office/floor added (BE-7): the serializer renders office_name and
            # floor_name, so without these each row triggers two extra queries.
            .select_related("desk", "user", "cancelled_by", "office", "floor")
            .order_by("desk__name")
        )
        page_qs, meta = _maybe_paginate_qs(request, bookings)
        data = DeskBookingResponseSerializer(
            page_qs, many=True, context={"request": request, "membership": membership}
        ).data
        if meta is None:
            return Response(data)
        return Response({"results": data, **meta})

    def post(self, request: Request, office_id: int, floor_id: int) -> Response:
        # NOTE: get_first_active_membership resolves the alphabetically-first org.
        # Users with memberships in multiple orgs may experience unexpected org
        # resolution. This is a pre-existing limitation. See docs for details.
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateDeskBookingSerializer(
            data=request.data, context={"office": office}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated = serializer.validated_data

        try:
            booking = create_booking_for_user(
                organization=membership.organization,
                office=office,
                floor=floor,
                desk_id=validated["desk"],
                user=request.user,
                booking_date=validated["booking_date"],
            )
        except Desk.DoesNotExist:
            return Response(
                {"detail": "Desk not found on this floor."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except BookingFloorNotPublishedError:
            return Response(
                {"detail": "This floor is not published for booking yet."},
                status=status.HTTP_409_CONFLICT,
            )
        except BookingDeskNotAvailableError:
            return Response(
                {"detail": "Desk is not available for booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DuplicateBookingError as exc:
            if exc.constraint == "desk_date":
                return Response(
                    {"detail": "This desk is already booked for the selected date."},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {"detail": "You already have an active booking for this date."},
                status=status.HTTP_409_CONFLICT,
            )
        except IntegrityError as exc:
            exc_str = str(exc)
            if "unique_active_booking_per_desk_date" in exc_str:
                return Response(
                    {"detail": "This desk is already booked for the selected date."},
                    status=status.HTTP_409_CONFLICT,
                )
            if "unique_active_booking_per_user_org_date" in exc_str:
                return Response(
                    {"detail": "You already have an active booking for this date."},
                    status=status.HTTP_409_CONFLICT,
                )
            raise

        response_serializer = DeskBookingResponseSerializer(
            booking, context={"request": request, "membership": membership}
        )
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class DeskBookingDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskBookingReadThrottle]

    def get(
        self, request: Request, office_id: int, floor_id: int, booking_id: int
    ) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = DeskBooking.objects.select_related(
                "desk", "user", "cancelled_by"
            ).get(
                id=booking_id,
                floor=floor,
                status=DeskBooking.Status.ACTIVE,
            )
        except DeskBooking.DoesNotExist:
            return Response(
                {"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = DeskBookingResponseSerializer(
            booking, context={"request": request, "membership": membership}
        )
        return Response(serializer.data)


class DeskBookingCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskBookingWriteThrottle]

    def post(
        self, request: Request, office_id: int, floor_id: int, booking_id: int
    ) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        # PR 055: resolve the office among the caller's active orgs (not just the
        # first active membership), and use that org's membership for role checks.
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = DeskBooking.objects.select_related(
                "desk", "user", "cancelled_by"
            ).get(id=booking_id, floor=floor)
        except DeskBooking.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        is_own = booking.user == request.user
        can_manage = user_can_manage_offices(membership)
        if not is_own and not can_manage:
            return Response(
                {"detail": "You do not have permission to cancel this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            cancel_desk_booking(booking, cancelled_by=request.user)
        except DeskBookingAlreadyCancelledError:
            return Response(
                {"detail": "Booking is already cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = DeskBookingResponseSerializer(
            booking, context={"request": request, "membership": membership}
        )
        return Response(serializer.data)


class MyBookingsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskBookingReadThrottle]

    def get(self, request: Request) -> Response:
        status_param = request.query_params.get("status", "active")
        from_date_str = request.query_params.get("from")
        to_date_str = request.query_params.get("to")

        from_date = None
        if from_date_str:
            try:
                from_date = datetime.date.fromisoformat(from_date_str)
            except ValueError:
                return Response(
                    {"detail": "Invalid from date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        to_date = None
        if to_date_str:
            try:
                to_date = datetime.date.fromisoformat(to_date_str)
            except ValueError:
                return Response(
                    {"detail": "Invalid to date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        qs = list_my_desk_bookings(
            request.user,
            status=status_param,
            date_from=from_date,
            date_to=to_date,
        )
        serializer = DeskBookingResponseSerializer(
            qs, many=True, context={"request": request}
        )
        return Response(serializer.data)


class UsualDeskView(APIView):
    """Read-only: the caller's resolved "usual desk" in the selected org (PR 079).

    Thin wrapper over the existing ``resolve_usual_desk`` service (also used by the chat
    bot) — the Today screen uses it for the amber "usual desk" marker and near-you
    ranking. Returns ``{"usual_desk": <desk> | null}``.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskBookingReadThrottle]

    def get(self, request: Request) -> Response:
        membership = resolve_membership(request.user, _selected_org_id(request))
        if membership is None:
            return Response(
                {"detail": "No active membership."},
                status=status.HTTP_403_FORBIDDEN,
            )
        desk = resolve_usual_desk(request.user, organization=membership.organization)
        data = UsualDeskSerializer(desk).data if desk is not None else None
        return Response({"usual_desk": data})


class MyBookingCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskBookingWriteThrottle]

    def post(self, request: Request, booking_id: int) -> Response:
        booking = get_my_desk_booking(request.user, booking_id)
        if booking is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            cancel_desk_booking(booking, cancelled_by=request.user)
        except DeskBookingAlreadyCancelledError:
            return Response(
                {"detail": "This booking is already cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = DeskBookingResponseSerializer(
            booking, context={"request": request}
        )
        return Response(serializer.data)


# ─── Meeting rooms (PR 073) ───────────────────────────────────────────────────

_NO_ROOM_CAPABLE = (
    "This layout object's type cannot host a meeting room. "
    "Only room-capable objects (room, meeting room, meeting pod, phone booth, "
    "quiet room, focus zone) are supported."
)
_ROOM_ALREADY_EXISTS = "This layout object already has an active meeting room."


class MeetingRoomListCreateView(APIView):
    """List active meeting rooms on a floor (any member), or create one (admin).

    Rooms are NOT auto-provisioned (unlike desks): creation is the explicit
    "bookable" step. A room may be created only on a room-capable layout object,
    and at most one active room per object (mirrors the desk resource pattern)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskWriteThrottle]

    def get(self, request: Request, office_id: int, floor_id: int) -> Response:
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        rooms = MeetingRoom.objects.filter(floor=floor, is_active=True).select_related(
            "layout_object"
        )
        return Response(MeetingRoomResponseSerializer(rooms, many=True).data)

    def post(self, request: Request, office_id: int, floor_id: int) -> Response:
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateMeetingRoomSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        try:
            layout_object = FloorLayoutObject.objects.get(
                pk=data["layout_object"], floor=floor, is_active=True
            )
        except FloorLayoutObject.DoesNotExist:
            return Response(
                {"layout_object": ["Layout object not found on this floor."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if layout_object.object_type not in ROOM_CAPABLE_TYPES:
            return Response(
                {"layout_object": [_NO_ROOM_CAPABLE]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if MeetingRoom.objects.filter(
            layout_object=layout_object, is_active=True
        ).exists():
            return Response(
                {"layout_object": [_ROOM_ALREADY_EXISTS]},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            room = MeetingRoom.objects.create(
                organization=membership.organization,
                office=office,
                floor=floor,
                layout_object=layout_object,
                name=data["name"],
                capacity=data.get("capacity", 1),
                amenities=data.get("amenities", {}),
                notes=data.get("notes", ""),
            )
        except IntegrityError as exc:
            if "unique_active_room_per_layout_object" in str(exc):
                return Response(
                    {"layout_object": [_ROOM_ALREADY_EXISTS]},
                    status=status.HTTP_409_CONFLICT,
                )
            raise
        return Response(
            MeetingRoomResponseSerializer(room).data,
            status=status.HTTP_201_CREATED,
        )


class RoomBookingListCreateView(APIView):
    """List a floor's active room bookings for a date, or create a slot booking."""

    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "POST":
            return [_DeskBookingWriteThrottle()]
        return [_DeskBookingReadThrottle()]

    def get(self, request: Request, office_id: int, floor_id: int) -> Response:
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        date_str = request.query_params.get("date")
        if not date_str:
            return Response(
                {"detail": "date query parameter is required (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            booking_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bookings = (
            RoomBooking.objects.filter(
                floor=floor,
                booking_date=booking_date,
                status=RoomBooking.Status.ACTIVE,
            )
            .select_related("room", "user", "cancelled_by", "office", "floor")
            .order_by("room__name", "start_at")
        )
        page_qs, meta = _maybe_paginate_qs(request, bookings)
        data = RoomBookingResponseSerializer(
            page_qs, many=True, context={"request": request, "membership": membership}
        ).data
        if meta is None:
            return Response(data)
        return Response({"results": data, **meta})

    def post(self, request: Request, office_id: int, floor_id: int) -> Response:
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateRoomBookingSerializer(
            data=request.data, context={"office": office}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated = serializer.validated_data

        try:
            booking = RoomBookingService().create_booking(
                organization=membership.organization,
                office=office,
                floor=floor,
                room_id=validated["room"],
                user=request.user,
                booking_date=validated["booking_date"],
                start_at=validated["start_at"],
                end_at=validated["end_at"],
            )
        except MeetingRoom.DoesNotExist:
            return Response(
                {"detail": "Room not found on this floor."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except RoomFloorNotPublishedError:
            return Response(
                {"detail": "This floor is not published for booking yet."},
                status=status.HTTP_409_CONFLICT,
            )
        except RoomNotAvailableError:
            return Response(
                {"detail": "Room is not available for booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RoomSlotConflictError:
            return Response(
                {"detail": "This room is already booked for an overlapping time."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            RoomBookingResponseSerializer(
                booking, context={"request": request, "membership": membership}
            ).data,
            status=status.HTTP_201_CREATED,
        )


class RoomBookingCancelView(APIView):
    """Cancel a room booking (owner or a manager)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskBookingWriteThrottle]

    def post(
        self, request: Request, office_id: int, floor_id: int, booking_id: int
    ) -> Response:
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = RoomBooking.objects.select_related(
                "room", "user", "cancelled_by"
            ).get(id=booking_id, floor=floor)
        except RoomBooking.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        is_own = booking.user == request.user
        if not is_own and not user_can_manage_offices(membership):
            return Response(
                {"detail": "You do not have permission to cancel this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            RoomBookingService().cancel_booking(booking, cancelled_by=request.user)
        except RoomBookingAlreadyCancelledError:
            return Response(
                {"detail": "Booking is already cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            RoomBookingResponseSerializer(
                booking, context={"request": request, "membership": membership}
            ).data
        )


class MyRoomBookingsView(APIView):
    """The current user's room bookings across their active organizations."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskBookingReadThrottle]

    def get(self, request: Request) -> Response:
        status_param = request.query_params.get("status", "active")
        from_date_str = request.query_params.get("from")
        to_date_str = request.query_params.get("to")

        from_date = None
        if from_date_str:
            try:
                from_date = datetime.date.fromisoformat(from_date_str)
            except ValueError:
                return Response(
                    {"detail": "Invalid from date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        to_date = None
        if to_date_str:
            try:
                to_date = datetime.date.fromisoformat(to_date_str)
            except ValueError:
                return Response(
                    {"detail": "Invalid to date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        qs = list_my_room_bookings(
            request.user,
            status=status_param,
            date_from=from_date,
            date_to=to_date,
        )
        serializer = RoomBookingResponseSerializer(
            qs, many=True, context={"request": request}
        )
        return Response(serializer.data)


# ─── EnhanceRun ───────────────────────────────────────────────────────────────


def _operation_result(op: EnhanceRunOperation) -> dict:
    result = {
        "object_id": op.object_id,
        "status": op.status,
        "reason_codes": op.reason_codes,
    }
    # BE-13: error_code/error_message default to "" (not None), so a truthiness
    # check is required — otherwise applied ops carry empty error strings.
    if op.error_code:
        result["error_code"] = op.error_code
    if op.error_message:
        result["error_message"] = op.error_message
    return result


def _build_run_response(run: EnhanceRun, updated_objects: list) -> dict:
    operations = list(run.operations.all())
    return {
        "enhance_run_id": run.id,
        "status": run.status,
        "applied_count": run.applied_count,
        "failed_count": run.failed_count,
        "skipped_count": run.skipped_count,
        "operation_results": [_operation_result(op) for op in operations],
        "updated_objects": LayoutObjectResponseSerializer(
            updated_objects, many=True
        ).data,
    }


class _EnhanceRunWriteThrottle(SimpleRateThrottle):
    """Applies the enhance_apply throttle scope on write requests (BE-11).

    Enhance apply/undo/retry get their own default-on cap, separate from the
    per-drag layout_object_write scope (which stays disabled by default so an
    editing session is never locked out mid-drag).
    """

    scope = "enhance_apply"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _throttle_cache_key(self, request)

    def allow_request(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method not in _WRITE_METHODS:
            return True
        return super().allow_request(request, view)


class _EnhanceRunBaseView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_EnhanceRunWriteThrottle]

    def _resolve(self, request: Request, office_id: int, floor_id: int):
        """Resolve (floor, membership) or return an error Response.

        Returns (floor, membership, None) on success, or (None, None, Response).
        """
        office, membership = get_office_for_user(request.user, office_id)
        if office is None:
            return (
                None,
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
            )
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return (
                None,
                None,
                Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND),
            )
        if not user_can_manage_offices(membership):
            return (
                None,
                None,
                Response(
                    {"detail": _NO_MANAGE_OFFICES},
                    status=status.HTTP_403_FORBIDDEN,
                ),
            )
        return floor, membership, None


class EnhanceRunListCreateView(_EnhanceRunBaseView):
    """Apply a batch of layout-enhancement operations to a floor (best-effort,
    per-operation, idempotent on plan_id)."""

    def post(self, request: Request, office_id: int, floor_id: int) -> Response:
        floor, membership, err = self._resolve(request, office_id, floor_id)
        if err is not None:
            return err

        serializer = ApplyEnhanceRunSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        result = EnhanceRunService().apply(
            floor=floor,
            user=request.user,
            plan_id=data["plan_id"],
            operations=data["operations"],
            diagnostics=data.get("diagnostics", []),
            summary=data.get("summary", {}),
        )
        return Response(_build_run_response(result.run, result.updated_objects))


class EnhanceRunUndoView(_EnhanceRunBaseView):
    """Undo a prior run by restoring each applied operation's before_geometry.

    A staleness guard (BE-4) skips any object whose current geometry no longer
    matches what the original run left it at (``after_geometry``) — i.e. the user
    manually moved/resized it after the run — so undo never silently clobbers
    intervening manual edits. Such operations are reported as ``skipped`` with a
    ``stale_geometry`` reason instead of being overwritten.
    """

    def post(
        self, request: Request, office_id: int, floor_id: int, run_id: int
    ) -> Response:
        floor, membership, err = self._resolve(request, office_id, floor_id)
        if err is not None:
            return err

        try:
            result = EnhanceRunService().undo(
                floor=floor, user=request.user, run_id=run_id
            )
        except EnhanceRunNotFoundError:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_build_run_response(result.run, result.updated_objects))


class EnhanceRunRetryView(_EnhanceRunBaseView):
    """Retry the failed operations of a prior run, re-attempting their patches."""

    def post(
        self, request: Request, office_id: int, floor_id: int, run_id: int
    ) -> Response:
        floor, membership, err = self._resolve(request, office_id, floor_id)
        if err is not None:
            return err

        try:
            result = EnhanceRunService().retry(
                floor=floor, user=request.user, run_id=run_id
            )
        except EnhanceRunNotFoundError:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_build_run_response(result.run, result.updated_objects))
