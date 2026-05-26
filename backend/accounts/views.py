from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import CreateOrganizationSerializer, OrganizationResponseSerializer


class CreateOrganizationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "org_create"

    @extend_schema(
        request=CreateOrganizationSerializer,
        responses={201: OrganizationResponseSerializer},
        summary=("Create a new organization and enroll the requesting user as owner"),
    )
    def post(self, request: Request) -> Response:
        if not request.user.is_profile_completed:
            return Response(
                {"detail": "Complete your profile before creating an organization."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CreateOrganizationSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        org = serializer.save()
        return Response(
            OrganizationResponseSerializer(org).data,
            status=status.HTTP_201_CREATED,
        )
