import pyotp
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .mfa_serializers import (
    MFAConfirmSerializer,
    MFADisableSerializer,
    MFAStatusSerializer,
    RecoveryCodeRegenerateSerializer,
)
from .models import RecoveryCode, UserMFADevice


class MFAStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: MFAStatusSerializer},
        summary="Return the current MFA status for the authenticated user",
    )
    def get(self, request: Request) -> Response:
        user = request.user
        try:
            device = user.mfa_device
            has_confirmed_device = device.is_confirmed
        except UserMFADevice.DoesNotExist:
            has_confirmed_device = False

        remaining = RecoveryCode.objects.filter(user=user, used_at__isnull=True).count()

        data = {
            "mfa_enabled": user.mfa_enabled,
            "has_confirmed_device": has_confirmed_device,
            "recovery_codes_remaining": remaining,
        }
        serializer = MFAStatusSerializer(data)
        return Response(serializer.data)


class MFASetupView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "provisioning_uri": {"type": "string"},
                    "detail": {"type": "string"},
                },
            }
        },
        summary="Begin MFA setup — returns a TOTP provisioning URI",
    )
    def post(self, request: Request) -> Response:
        user = request.user

        try:
            device = user.mfa_device
            if device.is_confirmed:
                return Response(
                    {"detail": "MFA is already enabled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            device.delete()
        except UserMFADevice.DoesNotExist:
            pass

        secret = pyotp.random_base32()
        device = UserMFADevice.objects.create(user=user, secret=secret)

        _confirm_url = "/api/auth/mfa/confirm/"
        response_data = {
            "provisioning_uri": device.provisioning_uri(),
            "detail": (
                f"Scan the provisioning URI in your authenticator app, "
                f"then confirm with POST {_confirm_url}."
            ),
        }
        if settings.DEBUG:
            response_data["secret"] = secret

        return Response(response_data)


class MFAConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=MFAConfirmSerializer,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "detail": {"type": "string"},
                    "recovery_codes": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            }
        },
        summary="Confirm MFA setup with a TOTP token and receive recovery codes",
    )
    def post(self, request: Request) -> Response:
        serializer = MFAConfirmSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        raw_codes = serializer.save()
        _msg = "MFA enabled. Store your recovery codes safely — not shown again."
        return Response({"detail": _msg, "recovery_codes": raw_codes})


class MFADisableView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=MFADisableSerializer,
        responses={204: None},
        summary="Disable MFA — requires password and TOTP token or recovery code",
    )
    def post(self, request: Request) -> Response:
        serializer = MFADisableSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecoveryCodeRegenerateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=RecoveryCodeRegenerateSerializer,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "detail": {"type": "string"},
                    "recovery_codes": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            }
        },
        summary="Regenerate recovery codes — requires password and TOTP token or code",
    )
    def post(self, request: Request) -> Response:
        serializer = RecoveryCodeRegenerateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        raw_codes = serializer.save()
        _msg = "Recovery codes regenerated. Store them safely — not shown again."
        return Response({"detail": _msg, "recovery_codes": raw_codes})
