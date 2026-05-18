from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from .mfa_views import (
    MFAConfirmView,
    MFADisableView,
    MFALoginChallengeVerifyView,
    MFASetupView,
    MFAStatusView,
    RecoveryCodeRegenerateView,
)
from .views import (
    CurrentUserView,
    EmailTokenObtainPairView,
    LogoutView,
    ResendEmailVerificationView,
    SignupView,
    SocialAuthView,
    VerifyEmailView,
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="auth-signup"),
    path("verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path(
        "resend-verification/",
        ResendEmailVerificationView.as_view(),
        name="auth-resend-verification",
    ),
    path("token/", EmailTokenObtainPairView.as_view(), name="token-obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
    path("social/", SocialAuthView.as_view(), name="auth-social"),
    path("mfa/status/", MFAStatusView.as_view(), name="mfa-status"),
    path("mfa/setup/", MFASetupView.as_view(), name="mfa-setup"),
    path("mfa/confirm/", MFAConfirmView.as_view(), name="mfa-confirm"),
    path("mfa/disable/", MFADisableView.as_view(), name="mfa-disable"),
    path(
        "mfa/recovery-codes/regenerate/",
        RecoveryCodeRegenerateView.as_view(),
        name="mfa-recovery-codes-regenerate",
    ),
    path(
        "mfa/challenge/verify/",
        MFALoginChallengeVerifyView.as_view(),
        name="mfa-challenge-verify",
    ),
]
