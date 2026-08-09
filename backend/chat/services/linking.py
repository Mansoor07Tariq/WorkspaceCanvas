"""Account-linking service (PR 077 Slice 1) — modeled on the Invitation accept
precedent (single-use UUID token + expiry + IsAuthenticated bind).

Trust chain (review/24 §2.4): (1) inbound webhook signature proves the chat identity
that requested the code [Slice 2]; (2) the code is delivered only to that chat DM;
(3) the web-side confirm is IsAuthenticated, proving the WC identity. No per-user WC
credential is ever stored — a linked row simply lets the bot resolve the User and call
the request-free services on their behalf.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone as tz

from chat.models import ChatLink


class LinkTokenInvalid(Exception):
    """The link token does not exist / is not a pending link."""

    code = "invalid"


class LinkTokenExpired(Exception):
    """The link token has expired."""

    code = "expired"


class LinkTokenUsed(Exception):
    """The link token was already used."""

    code = "used"


def _ttl() -> timedelta:
    return timedelta(minutes=settings.CHAT_LINK_TOKEN_TTL_MINUTES)


def get_linked(platform: str, external_user_id: str) -> ChatLink | None:
    """The active (linked) ChatLink for a chat identity, or None."""
    return (
        ChatLink.objects.filter(
            platform=platform,
            external_user_id=external_user_id,
            status=ChatLink.Status.LINKED,
        )
        .select_related("user")
        .first()
    )


def create_pending_link(
    *, platform: str, external_user_id: str, external_team_id: str = ""
) -> ChatLink:
    """(Re)issue a single-use pending link token for a chat identity, rotating any
    prior token (Invitation-resend precedent). One row per identity; callers must
    only invoke this when the identity is NOT currently linked (the glue checks),
    so an existing binding is never silently dropped.
    """
    link, _created = ChatLink.objects.get_or_create(
        platform=platform,
        external_user_id=external_user_id,
        defaults={
            "external_team_id": external_team_id,
            "expires_at": tz.now() + _ttl(),
        },
    )
    link.external_team_id = external_team_id or link.external_team_id
    link.status = ChatLink.Status.PENDING
    link.user = None
    link.linked_at = None
    link.token = uuid.uuid4()
    link.expires_at = tz.now() + _ttl()
    link.used_at = None
    link.save()
    return link


def link_url(link: ChatLink) -> str:
    """The web confirm URL the user opens (built from FRONTEND_URL, never a host
    header — mirrors the invitation email URL policy)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/app/link-chat?code={link.token}"


def confirm_link(*, token, user) -> ChatLink:
    """Bind ``user`` to a pending chat identity (the web confirm step). Atomic +
    single-use via ``select_for_update``. Raises ``LinkTokenInvalid`` /
    ``LinkTokenExpired`` / ``LinkTokenUsed`` for the caller to map to 400s.
    """
    with transaction.atomic():
        try:
            link = ChatLink.objects.select_for_update().get(token=token)
        except (ChatLink.DoesNotExist, ValueError, ValidationError):
            # A malformed UUID raises ValidationError/ValueError on the lookup —
            # treat it as an invalid token, not a 500.
            raise LinkTokenInvalid()
        if link.used_at is not None:
            raise LinkTokenUsed()
        if link.is_expired:
            raise LinkTokenExpired()
        if link.status != ChatLink.Status.PENDING:
            raise LinkTokenInvalid()
        link.user = user
        link.status = ChatLink.Status.LINKED
        link.used_at = tz.now()
        link.linked_at = tz.now()
        link.save(
            update_fields=["user", "status", "used_at", "linked_at", "updated_at"]
        )
        return link


def revoke_own_links(user) -> int:
    """Revoke all of the caller's linked/pending chat links (self-service unlink).
    Returns the number of rows revoked. Manager-revoke of other members' links is
    intentionally NOT offered: a ChatLink is platform+user scoped (cross-org) and
    does not map onto the office/org permission helpers cleanly (review/25 §Scope).
    """
    return ChatLink.objects.filter(
        user=user,
        status__in=[ChatLink.Status.PENDING, ChatLink.Status.LINKED],
    ).update(status=ChatLink.Status.REVOKED, updated_at=tz.now())
