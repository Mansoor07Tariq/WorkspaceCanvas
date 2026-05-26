from datetime import timedelta

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .auth_cookies import clear_refresh_cookie, set_refresh_cookie
from .emails import send_email_verification
from .models import EmailVerificationToken, User
from .serializers import (
    CurrentUserSerializer,
    EmailTokenObtainPairSerializer,
    EmailVerificationSerializer,
    ProfileUpdateSerializer,
    ResendEmailVerificationSerializer,
    SignupSerializer,
    SocialAuthSerializer,
)
from .social_auth import SocialAuthError


class EmailTokenObtainPairView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_login"

    @extend_schema(
        request=EmailTokenObtainPairSerializer,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "access": {"type": "string"},
                },
            }
        },
        summary="Login with email and password",
    )
    def post(self, request: Request) -> Response:
        serializer = EmailTokenObtainPairSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        refresh = data.pop("refresh", None)
        response = Response(data, status=status.HTTP_200_OK)
        if refresh:
            set_refresh_cookie(response, refresh)
        return response


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_throttles(self):
        if self.request.method == "PATCH":
            self.throttle_scope = "auth_profile"
            return [ScopedRateThrottle()]
        return []

    @extend_schema(
        responses={200: CurrentUserSerializer},
        summary="Return the currently authenticated user",
    )
    def get(self, request: Request) -> Response:
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)

    @extend_schema(
        request=ProfileUpdateSerializer,
        responses={200: CurrentUserSerializer},
        summary="Update the current user's profile",
    )
    def patch(self, request: Request) -> Response:
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(CurrentUserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={204: None},
        summary="Blacklist the httpOnly refresh cookie and log out",
    )
    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get(django_settings.AUTH_COOKIE_NAME)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass  # Cookie may be already expired; still clear it
        return response


class SignupView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_signup"

    @extend_schema(
        request=SignupSerializer,
        responses={
            201: {
                "type": "object",
                "properties": {"detail": {"type": "string"}},
            }
        },
        summary="Register a new user account",
    )
    def post(self, request: Request) -> Response:
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save()
            token = EmailVerificationToken.create_for_user(user)
        send_email_verification(user, token)
        return Response(
            {"detail": "Account created. Check your email to verify your address."},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=EmailVerificationSerializer,
        responses={
            200: {
                "type": "object",
                "properties": {"detail": {"type": "string"}},
            }
        },
        summary="Verify email address using the token from the verification email",
    )
    def post(self, request: Request) -> Response:
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _invalid = "This verification token is invalid or has expired."
        try:
            with transaction.atomic():
                token = (
                    EmailVerificationToken.objects.select_for_update()
                    .select_related("user")
                    .get(token=serializer.validated_data["token"])
                )
                if not token.is_valid:
                    return Response(
                        {"detail": _invalid},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                token.mark_used()
                token.user.mark_email_verified()
        except EmailVerificationToken.DoesNotExist:
            return Response(
                {"detail": _invalid},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"detail": "Email verified successfully."})


class ResendEmailVerificationView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_resend"

    @extend_schema(
        request=ResendEmailVerificationSerializer,
        responses={
            200: {
                "type": "object",
                "properties": {"detail": {"type": "string"}},
            }
        },
        summary="Resend the email verification link",
    )
    def post(self, request: Request) -> Response:
        serializer = ResendEmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        _GENERIC = (
            "If that email is registered and unverified, a new link has been sent."
        )
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": _GENERIC})
        if user.email_verified:
            return Response({"detail": _GENERIC})
        cooldown_cutoff = timezone.now() - timedelta(
            seconds=django_settings.RESEND_VERIFICATION_COOLDOWN_SECONDS
        )
        already_sent = EmailVerificationToken.objects.filter(
            user=user,
            created_at__gte=cooldown_cutoff,
        ).exists()
        if not already_sent:
            token = EmailVerificationToken.create_for_user(user)
            send_email_verification(user, token)
        return Response({"detail": _GENERIC})


class SocialAuthView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_social"

    @extend_schema(
        request=SocialAuthSerializer,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "access": {"type": "string"},
                    "email": {"type": "string"},
                    "email_verified": {"type": "boolean"},
                    "preferred_auth_provider": {"type": "string"},
                },
            }
        },
        summary="Authenticate with a Google or Microsoft provider token",
    )
    def post(self, request: Request) -> Response:
        serializer = SocialAuthSerializer(
            data=request.data, context={"request": request}
        )
        try:
            serializer.is_valid(raise_exception=True)
        except SocialAuthError as exc:
            return Response(
                {"detail": exc.message, "code": exc.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = dict(serializer.validated_data)
        refresh = data.pop("refresh", None)
        response = Response(data, status=status.HTTP_200_OK)
        if refresh:
            set_refresh_cookie(response, refresh)
        return response


class CookieTokenRefreshView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=None,
        responses={
            200: {
                "type": "object",
                "properties": {"access": {"type": "string"}},
            }
        },
        summary="Obtain a new access token using the httpOnly refresh cookie",
    )
    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get(django_settings.AUTH_COOKIE_NAME)
        if not refresh_token:
            return Response(
                {"detail": "Refresh cookie missing.", "code": "missing_cookie"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            valid = serializer.is_valid()
        except TokenError:
            valid = False
        if not valid:
            response = Response(
                {
                    "detail": "Refresh token is invalid or has expired.",
                    "code": "token_not_valid",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response
        data = dict(serializer.validated_data)
        new_refresh = data.pop("refresh", None)
        response = Response(data, status=status.HTTP_200_OK)
        if new_refresh:
            set_refresh_cookie(response, new_refresh)
        return response
