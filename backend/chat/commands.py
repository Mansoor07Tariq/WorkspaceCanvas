"""Platform-free command types + router (PR 077 Slice 1).

The router parses raw text into a FIXED intent set with typed slots. There is no
free-form execution path: unknown input yields ``Intent.UNKNOWN`` (→ a help reply),
never an arbitrary action. Writes never happen here — they require the confirm-token
flow in the service glue.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class Intent(StrEnum):
    TODAY = "today"
    TOMORROW = "tomorrow"
    BOOK = "book"
    CANCEL = "cancel"
    HELP = "help"
    LINK = "link"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class InboundCommand:
    """A normalized inbound message, produced by a platform adapter (or a test)."""

    platform: str
    external_user_id: str
    intent: Intent
    external_team_id: str = ""
    # Typed, validated slots. v1: ``date_offset`` ∈ {0 (today), 1 (tomorrow)} for
    # book/cancel; the reads carry their own offset in the intent.
    slots: dict = field(default_factory=dict)


class ReplyKind(StrEnum):
    TEXT = "text"
    CONFIRM = "confirm"


@dataclass(frozen=True)
class ConfirmAction:
    """A pending write the user must explicitly confirm. ``token`` is the one-shot
    confirm-token the adapter echoes back on the Confirm button."""

    token: str
    summary: str


@dataclass(frozen=True)
class Reply:
    """A normalized reply the adapter renders (text, or a text + Confirm button)."""

    kind: ReplyKind
    text: str
    confirm: ConfirmAction | None = None

    @staticmethod
    def text_reply(text: str) -> Reply:
        return Reply(kind=ReplyKind.TEXT, text=text)

    @staticmethod
    def confirm_reply(text: str, *, token: str, summary: str) -> Reply:
        return Reply(
            kind=ReplyKind.CONFIRM,
            text=text,
            confirm=ConfirmAction(token=token, summary=summary),
        )


class CommandRouter:
    """Parse raw text → (Intent, slots). Fixed keywords only — deliberately not an
    NLP engine (that arrives, schema-constrained, in a later slice)."""

    def parse(self, text: str) -> InboundCommand:  # pragma: no cover - thin wrapper
        raise NotImplementedError

    @staticmethod
    def parse_text(
        text: str, *, platform: str, external_user_id: str, external_team_id: str = ""
    ) -> InboundCommand:
        raw = (text or "").strip().lower()
        first = raw.split()[0] if raw else ""

        def cmd(intent: Intent, slots: dict | None = None) -> InboundCommand:
            return InboundCommand(
                platform=platform,
                external_user_id=external_user_id,
                external_team_id=external_team_id,
                intent=intent,
                slots=slots or {},
            )

        if first in ("", "help", "?"):
            return cmd(Intent.HELP)
        if first == "link":
            return cmd(Intent.LINK)
        if first == "today":
            return cmd(Intent.TODAY)
        if first == "tomorrow":
            return cmd(Intent.TOMORROW)
        if first in ("book", "cancel"):
            offset = 1 if "tomorrow" in raw else 0  # v1: today or tomorrow only
            intent = Intent.BOOK if first == "book" else Intent.CANCEL
            return cmd(intent, {"date_offset": offset})
        return cmd(Intent.UNKNOWN)
