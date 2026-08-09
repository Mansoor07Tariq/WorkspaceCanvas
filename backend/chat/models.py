"""Chat-bot core models (PR 077 Slice 1) — platform-independent.

Design (ratified in review/24 §2): Option A account linking. We store NO per-user
WorkspaceCanvas credential — only a mapping (platform, external_user_id) → User plus
short-lived single-use tokens, and an audit row per bot command. All secrets are
env-only (see settings); nothing sensitive is persisted here.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from users.models import ExpiringTokenMixin


class ChatPlatform(models.TextChoices):
    SLACK = "slack", "Slack"
    # Teams etc. arrive in later slices; the enum is the single extension point.


class ChatLink(ExpiringTokenMixin, models.Model):
    """A mapping between a chat identity and a WorkspaceCanvas user.

    One row per chat identity (unique ``platform`` + ``external_user_id``). The
    row moves through ``pending`` → ``linked`` → ``revoked``; the account-link
    ``token`` is single-use + expiring (rotated in place on re-link, mirroring the
    Invitation resend precedent). Because there is at most one row per identity,
    there is trivially at most one ``linked`` row per identity (a partial
    constraint additionally guarantees it at the DB level).

    No credential is stored: resolving a linked user lets the bot call the
    request-free services on their behalf (the bot runs in-process). Revocation is
    instant (status → revoked); a deactivated user/membership fails closed at
    command time (the service glue re-checks active membership).
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        LINKED = "linked", "Linked"
        REVOKED = "revoked", "Revoked"

    platform = models.CharField(max_length=20, choices=ChatPlatform.choices)
    external_user_id = models.CharField(max_length=255)
    external_team_id = models.CharField(max_length=255, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_links",
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    # Single-use account-link token (ExpiringTokenMixin needs used_at + expires_at).
    token = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    linked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["platform", "external_user_id"],
                name="unique_chat_identity",
            ),
            models.UniqueConstraint(
                fields=["platform", "external_user_id"],
                condition=Q(status="linked"),
                name="unique_linked_chat_identity",
            ),
        ]
        indexes = [
            models.Index(
                fields=["platform", "external_user_id"],
                name="chatlink_identity_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.platform}:{self.external_user_id} → {self.user_id} ({self.status})"
        )


class ChatConfirmToken(ExpiringTokenMixin, models.Model):
    """A one-shot token gating a bot WRITE (book/cancel).

    The service glue NEVER performs a write without consuming one of these
    atomically (``select_for_update`` in ``execute_confirmed``). ``payload`` holds
    the already-resolved, already-validated write parameters so no re-parsing
    happens at execute time.
    """

    class Action(models.TextChoices):
        BOOK_DESK = "book_desk", "Book desk"
        CANCEL_DESK = "cancel_desk", "Cancel desk booking"

    token = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_confirm_tokens",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    payload = models.JSONField(default=dict)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ConfirmToken {self.token} ({self.action}, user {self.user_id})"


class BotActionAudit(models.Model):
    """One row per routed bot command (reads included) — who/what/when/outcome.

    Mirrors the EnhanceRun audit philosophy: bot-initiated actions are always
    attributable. ``user`` is SET_NULL so audit history survives account deletion.
    """

    class Result(models.TextChoices):
        OK = "ok", "OK"
        ERROR = "error", "Error"
        ALREADY_HANDLED = "already_handled", "Already handled"

    platform = models.CharField(max_length=20, choices=ChatPlatform.choices)
    external_user_id = models.CharField(max_length=255)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bot_actions",
    )
    command = models.CharField(max_length=40)
    args = models.JSONField(default=dict, blank=True)
    result = models.CharField(max_length=20, choices=Result.choices)
    error_code = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"], name="botaudit_user_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.platform}:{self.external_user_id} {self.command} → {self.result}"


class ProcessedChatEvent(models.Model):
    """Inbound webhook-event dedupe (platforms REDELIVER on timeout).

    A DB table keyed by ``(platform, event_id)`` with a unique constraint: the
    first insert wins, a concurrent/duplicate insert raises IntegrityError and is
    treated as "already seen" — race-safe without extra locking. Chosen over Redis
    (also available) because it is transactional with the rest of the write, needs
    no separate infra, and the unique constraint is the whole mechanism. Old rows
    are pruned by a periodic job (later slice); ``created_at`` is indexed for it.
    """

    platform = models.CharField(max_length=20, choices=ChatPlatform.choices)
    event_id = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["platform", "event_id"],
                name="unique_processed_chat_event",
            ),
        ]
        indexes = [
            models.Index(fields=["created_at"], name="chatevent_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.platform}:{self.event_id}"
