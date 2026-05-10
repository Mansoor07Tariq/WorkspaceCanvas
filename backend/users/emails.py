from django.conf import settings
from django.core.mail import send_mail

from .models import EmailVerificationToken, User


def send_email_verification(user: User, token: EmailVerificationToken) -> None:
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token.token}"
    name = user.full_name or user.username
    send_mail(
        subject="Verify your WorkspaceCanvas email",
        message=(
            f"Hi {name},\n\n"
            f"Verify your email address by visiting:\n{verification_url}\n\n"
            "This link expires in 24 hours.\n\n"
            "If you didn't sign up for WorkspaceCanvas, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
