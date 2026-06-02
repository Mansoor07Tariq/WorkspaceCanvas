"""Invitation email delivery.

The invite URL is always built from the configured FRONTEND_URL (never the
request Host) to avoid open-redirect / host-header injection into the link.
"""

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

from .models import Invitation


def build_invite_url(invitation: Invitation) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/invite/{invitation.token}"


def _role_label(invitation: Invitation) -> str:
    role = invitation.get_role_display()
    article = "an" if role[:1].lower() in "aeiou" else "a"
    return f"{article} {role}"


def _expires_display(invitation: Invitation) -> str:
    if not invitation.expires_at:
        return "an unspecified date"
    local = timezone.localtime(invitation.expires_at)
    return local.strftime("%B %d, %Y at %H:%M %Z")


def send_invitation_email(invitation: Invitation) -> None:
    """Send the invitation email for ``invitation``.

    Raises whatever the configured email backend raises on failure (e.g.
    smtplib.SMTPException, OSError). Callers should treat a raised exception as
    a delivery failure and roll back the surrounding transaction.
    """
    organization_name = invitation.organization.name
    context = {
        "organization_name": organization_name,
        "role_label": _role_label(invitation),
        "invite_url": build_invite_url(invitation),
        "expires_display": _expires_display(invitation),
    }
    subject = f"You're invited to join {organization_name} on WorkspaceCanvas"
    body = render_to_string("accounts/invitation_email.txt", context)
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
    )
