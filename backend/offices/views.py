from __future__ import annotations

from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Office
from .permissions import get_first_active_membership, user_can_manage_offices
from .serializers import CreateOfficeSerializer, OfficeResponseSerializer

_MAX_SLUG_RETRIES = 5
_SLUG_ERROR = "Could not generate a unique office slug. Please try a different name."


class _PostScopedThrottle(ScopedRateThrottle):
    """Applies the office_create throttle scope only on POST requests."""

    scope = "office_create"

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
                {"detail": "You do not have an active organization membership."},
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
                {"detail": "You do not have an active organization membership."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not user_can_manage_offices(membership):
            return Response(
                {"detail": "Only organization owners and admins can create offices."},
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
