from __future__ import annotations

from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import DESK_CAPABLE_TYPES, Desk, Floor, FloorLayoutObject, Office
from .permissions import (
    get_first_active_membership,
    get_floor_for_office,
    get_office_for_membership,
    user_can_manage_offices,
)
from .serializers import (
    CreateDeskSerializer,
    CreateFloorSerializer,
    CreateLayoutObjectSerializer,
    CreateOfficeSerializer,
    DeskResponseSerializer,
    FloorResponseSerializer,
    LayoutObjectResponseSerializer,
    OfficeResponseSerializer,
    UpdateDeskSerializer,
    UpdateLayoutObjectSerializer,
)

_MAX_SLUG_RETRIES = 5
_SLUG_ERROR = "Could not generate a unique office slug. Please try a different name."
_FLOOR_SLUG_ERROR = (
    "Could not generate a unique floor slug. Please try a different name."
)
_NO_MEMBERSHIP = "You do not have an active organization membership."
_NO_MANAGE_OFFICES = "Only organization owners and admins can manage offices."


class _PostScopedThrottle(ScopedRateThrottle):
    """Applies the office_create throttle scope only on POST requests."""

    scope = "office_create"

    def allow_request(self, request: Request, view: APIView) -> bool:  # type: ignore[override]
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class _FloorPostScopedThrottle(ScopedRateThrottle):
    """Applies the floor_create throttle scope only on POST requests."""

    scope = "floor_create"

    def allow_request(self, request: Request, view: APIView) -> bool:  # type: ignore[override]
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class OfficeListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_PostScopedThrottle]

    @extend_schema(
        responses={200: OfficeResponseSerializer(many=True)},
        summary="List offices for the current user's active organization",
    )
    def get(self, request: Request) -> Response:
        membership = get_first_active_membership(request.user)
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
        membership = get_first_active_membership(request.user)
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
        office = get_office_for_membership(membership, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floors = Floor.objects.filter(office=office, is_active=True)
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
        office = get_office_for_membership(membership, office_id)
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


_WRITE_METHODS = frozenset({"POST", "PATCH", "DELETE"})


class _LayoutObjectWriteThrottle(ScopedRateThrottle):
    """Applies the layout_object_write throttle scope on write requests."""

    scope = "layout_object_write"

    def allow_request(self, request: Request, view: APIView) -> bool:  # type: ignore[override]
        if request.method not in _WRITE_METHODS:
            return True
        return super().allow_request(request, view)


class LayoutObjectListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_LayoutObjectWriteThrottle]

    def get(self, request: Request, office_id: int, floor_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        office = get_office_for_membership(membership, office_id)
        if office is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        objects = FloorLayoutObject.objects.filter(floor=floor, is_active=True)
        return Response(LayoutObjectResponseSerializer(objects, many=True).data)

    def post(self, request: Request, office_id: int, floor_id: int) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        office = get_office_for_membership(membership, office_id)
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
        obj = FloorLayoutObject.objects.create(
            floor=floor,
            object_type=data["object_type"],
            label=data["label"],
            x=data["x"],
            y=data["y"],
            width=data["width"],
            height=data["height"],
            rotation=data["rotation"],
            is_bookable=data["is_bookable"],
            metadata=data["metadata"],
        )
        return Response(
            LayoutObjectResponseSerializer(obj).data,
            status=status.HTTP_201_CREATED,
        )


class LayoutObjectDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_LayoutObjectWriteThrottle]

    def _get_object(
        self,
        membership,
        office_id: int,
        floor_id: int,
        object_id: int,
    ):
        office = get_office_for_membership(membership, office_id)
        if office is None:
            return None, Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return None, Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            obj = FloorLayoutObject.objects.get(
                pk=object_id, floor=floor, is_active=True
            )
        except FloorLayoutObject.DoesNotExist:
            return None, Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return obj, None

    def patch(
        self, request: Request, office_id: int, floor_id: int, object_id: int
    ) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        obj, err = self._get_object(membership, office_id, floor_id, object_id)
        if err is not None:
            return err
        serializer = UpdateLayoutObjectSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        for field, value in serializer.validated_data.items():
            setattr(obj, field, value)
        obj.save()
        return Response(LayoutObjectResponseSerializer(obj).data)

    def delete(
        self, request: Request, office_id: int, floor_id: int, object_id: int
    ) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        obj, err = self._get_object(membership, office_id, floor_id, object_id)
        if err is not None:
            return err
        obj.is_active = False
        obj.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


_NO_DESK_CAPABLE = (
    "This layout object type cannot be set up as a bookable desk. "
    "Only desk, standing_desk, hot_desk, and private_desk types are supported."
)
_DESK_ALREADY_EXISTS = "This layout object already has an active desk resource."
_DESK_CODE_TAKEN = "A desk with this code already exists in this office."


class _DeskWriteThrottle(ScopedRateThrottle):
    """Applies the desk_write throttle scope on write requests."""

    scope = "desk_write"

    def allow_request(self, request: Request, view: APIView) -> bool:  # type: ignore[override]
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
        office = get_office_for_membership(membership, office_id)
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
        office = get_office_for_membership(membership, office_id)
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
        return Response(
            DeskResponseSerializer(desk).data,
            status=status.HTTP_201_CREATED,
        )


class DeskDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_DeskWriteThrottle]

    def _get_desk(self, membership, office_id: int, floor_id: int, desk_id: int):
        office = get_office_for_membership(membership, office_id)
        if office is None:
            return None, Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        floor = get_floor_for_office(office, floor_id)
        if floor is None:
            return None, Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            desk = Desk.objects.select_related("layout_object").get(
                pk=desk_id, floor=floor, is_active=True
            )
        except Desk.DoesNotExist:
            return None, Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return desk, None

    def patch(
        self, request: Request, office_id: int, floor_id: int, desk_id: int
    ) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        desk, err = self._get_desk(membership, office_id, floor_id, desk_id)
        if err is not None:
            return err

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
        desk.save()
        return Response(DeskResponseSerializer(desk).data)

    def delete(
        self, request: Request, office_id: int, floor_id: int, desk_id: int
    ) -> Response:
        membership = get_first_active_membership(request.user)
        if membership is None:
            return Response(
                {"detail": _NO_MEMBERSHIP}, status=status.HTTP_403_FORBIDDEN
            )
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": _NO_MANAGE_OFFICES}, status=status.HTTP_403_FORBIDDEN
            )
        desk, err = self._get_desk(membership, office_id, floor_id, desk_id)
        if err is not None:
            return err
        desk.is_active = False
        desk.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
