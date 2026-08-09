"""Service glue (PR 077 Slice 1) — the platform-free bridge from a normalized
``InboundCommand`` to the request-free booking services, and back to a ``Reply``.

Invariants (enforced here, pinned by tests — review/25 §Reviewer focus):
- **Writes are impossible without a consumed confirm token.** ``handle`` NEVER calls
  a booking mutation; it only ever returns a CONFIRM reply carrying a one-shot token.
  The single code path that mutates is ``execute_confirmed``, which consumes the token
  under ``select_for_update`` first.
- **Fail closed.** A missing/revoked link, or a user with no active membership, is
  turned away — no service call happens.
- **Every routed path writes exactly one ``BotActionAudit`` row.**
"""

from __future__ import annotations

import datetime
import zoneinfo

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone as tz

from chat.commands import InboundCommand, Intent, Reply
from chat.models import BotActionAudit, ChatConfirmToken, ProcessedChatEvent
from chat.services import linking
from offices.permissions import (
    get_floor_for_office,
    get_office_for_user,
    resolve_membership,
)
from offices.services.booking_service import (
    BookingDeskNotAvailableError,
    BookingFloorNotPublishedError,
    DeskBookingAlreadyCancelledError,
    DuplicateBookingError,
    cancel_desk_booking,
    create_booking_for_user,
    get_my_desk_booking,
    list_my_desk_bookings,
    resolve_usual_desk,
)
from offices.services.room_booking_service import list_my_room_bookings

# ─── Reply copy (English; chat-reply localisation is a later-slice concern) ────
HELP_TEXT = (
    "I can help you with desk bookings:\n"
    "• `today` / `tomorrow` — what you have booked\n"
    "• `book` / `book tomorrow` — book your usual desk\n"
    "• `cancel` / `cancel tomorrow` — cancel that day's booking\n"
    "• `link` — connect your WorkspaceCanvas account"
)
NOT_LINKED_TEXT = "Your account isn't linked yet. Send `link` to connect it."
NO_MEMBERSHIP_TEXT = "You don't have an active workspace membership right now."
ALREADY_LINKED_TEXT = "You're already linked ✅. Manage it in the WorkspaceCanvas app."
LINK_PROMPT_TEXT = "Link your WorkspaceCanvas account: {url}\n(This link expires soon.)"
NO_USUAL_DESK_TEXT = (
    "I don't know your usual desk yet — book one in the app first, then I'll "
    "remember it."
)
NOTHING_TO_CANCEL_TEXT = "You have no active desk booking for {date}."
CONFIRM_BOOK_TEXT = "Book {desk} ({where}) for {date}? Confirm to book."
CONFIRM_CANCEL_TEXT = "Cancel your {desk} booking for {date}? Confirm to cancel."
BOOKED_OK_TEXT = "✅ Booked {desk} ({where}) for {date}."
CANCELLED_OK_TEXT = "✅ Cancelled your {desk} booking for {date}."
ALREADY_HANDLED_TEXT = "That was already handled — nothing more to do."
INVALID_CONFIRM_TEXT = "That confirmation is no longer valid. Start again."
EXPIRED_CONFIRM_TEXT = "That confirmation expired. Start again."
DESK_UNAVAILABLE_TEXT = "That desk isn't available to book right now."
FLOOR_DRAFT_TEXT = "That floor isn't published for booking yet."
DESK_GONE_TEXT = "That desk no longer exists."
DUPLICATE_TEXT = "You already have a desk booked for {date}."
CANCEL_NOT_FOUND_TEXT = "I couldn't find that booking to cancel."
ALREADY_CANCELLED_TEXT = "That booking is already cancelled."


class _AlreadyHandled(Exception):
    pass


class _InvalidToken(Exception):
    def __init__(self, code: str):
        self.code = code


class _WriteError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message


def record_event(platform: str, event_id: str) -> bool:
    """Idempotency for inbound webhook events (platforms redeliver). Returns True if
    this is the FIRST time we've seen ``event_id`` (process it), False if it's a
    duplicate (skip). Race-safe via the unique constraint; the savepoint keeps an
    outer transaction usable after the expected IntegrityError."""
    try:
        with transaction.atomic():
            ProcessedChatEvent.objects.create(platform=platform, event_id=event_id)
        return True
    except IntegrityError:
        return False


class ServiceGlue:
    """Stateless — construct per call."""

    # ─── inbound command → reply ──────────────────────────────────────────────

    def handle(self, inbound: InboundCommand) -> Reply:
        intent = inbound.intent

        if intent in (Intent.HELP, Intent.UNKNOWN):
            return self._audited(inbound, None, "ok", "", Reply.text_reply(HELP_TEXT))
        if intent == Intent.LINK:
            return self._handle_link(inbound)

        # Everything below requires a linked, active user — fail closed otherwise.
        link = linking.get_linked(inbound.platform, inbound.external_user_id)
        if link is None or link.user is None:
            return self._audited(
                inbound, None, "ok", "not_linked", Reply.text_reply(NOT_LINKED_TEXT)
            )
        user = link.user
        membership = resolve_membership(user, None)
        if membership is None:
            return self._audited(
                inbound,
                user,
                "error",
                "no_membership",
                Reply.text_reply(NO_MEMBERSHIP_TEXT),
            )

        if intent in (Intent.TODAY, Intent.TOMORROW):
            return self._handle_read(
                inbound, user, offset=0 if intent == Intent.TODAY else 1
            )
        if intent == Intent.BOOK:
            return self._handle_book(inbound, user, membership)
        if intent == Intent.CANCEL:
            return self._handle_cancel(inbound, user)
        return self._audited(inbound, user, "ok", "", Reply.text_reply(HELP_TEXT))

    def _handle_link(self, inbound: InboundCommand) -> Reply:
        existing = linking.get_linked(inbound.platform, inbound.external_user_id)
        if existing is not None:
            return self._audited(
                inbound,
                existing.user,
                "ok",
                "already_linked",
                Reply.text_reply(ALREADY_LINKED_TEXT),
            )
        link = linking.create_pending_link(
            platform=inbound.platform,
            external_user_id=inbound.external_user_id,
            external_team_id=inbound.external_team_id,
        )
        return self._audited(
            inbound,
            None,
            "ok",
            "",
            Reply.text_reply(LINK_PROMPT_TEXT.format(url=linking.link_url(link))),
        )

    def _handle_read(self, inbound: InboundCommand, user, *, offset: int) -> Reply:
        date = self._user_date(user, offset)
        desks = list(
            list_my_desk_bookings(user, status="active", date_from=date, date_to=date)
        )
        rooms = list(
            list_my_room_bookings(user, status="active", date_from=date, date_to=date)
        )
        return self._audited(
            inbound,
            user,
            "ok",
            "",
            Reply.text_reply(self._format_reads(date, desks, rooms)),
        )

    def _handle_book(self, inbound: InboundCommand, user, membership) -> Reply:
        date = self._user_date(user, inbound.slots.get("date_offset", 0))
        desk = resolve_usual_desk(user, organization=membership.organization)
        if desk is None:
            return self._audited(
                inbound,
                user,
                "ok",
                "no_usual_desk",
                Reply.text_reply(NO_USUAL_DESK_TEXT),
            )
        where = f"{desk.floor.name}, {desk.office.name}"
        token = ChatConfirmToken.objects.create(
            user=user,
            action=ChatConfirmToken.Action.BOOK_DESK,
            payload={
                "organization_id": membership.organization_id,
                "office_id": desk.office_id,
                "floor_id": desk.floor_id,
                "desk_id": desk.id,
                "booking_date": date.isoformat(),
            },
            expires_at=self._confirm_expiry(),
        )
        return self._audited(
            inbound,
            user,
            "ok",
            "",
            Reply.confirm_reply(
                CONFIRM_BOOK_TEXT.format(desk=desk.name, where=where, date=date),
                token=str(token.token),
                summary=f"Book {desk.name} for {date}",
            ),
        )

    def _handle_cancel(self, inbound: InboundCommand, user) -> Reply:
        date = self._user_date(user, inbound.slots.get("date_offset", 0))
        active = list(
            list_my_desk_bookings(user, status="active", date_from=date, date_to=date)
        )
        if not active:
            return self._audited(
                inbound,
                user,
                "ok",
                "nothing_to_cancel",
                Reply.text_reply(NOTHING_TO_CANCEL_TEXT.format(date=date)),
            )
        booking = active[0]
        token = ChatConfirmToken.objects.create(
            user=user,
            action=ChatConfirmToken.Action.CANCEL_DESK,
            payload={"booking_id": booking.id},
            expires_at=self._confirm_expiry(),
        )
        return self._audited(
            inbound,
            user,
            "ok",
            "",
            Reply.confirm_reply(
                CONFIRM_CANCEL_TEXT.format(desk=booking.desk.name, date=date),
                token=str(token.token),
                summary=f"Cancel {booking.desk.name} for {date}",
            ),
        )

    # ─── confirmed write (the ONLY mutation path) ─────────────────────────────

    def execute_confirmed(
        self, *, platform: str, external_user_id: str, token_str: str
    ) -> Reply:
        """Consume the one-shot confirm token atomically and perform the write
        exactly once. A redelivered/duplicate confirm → "already handled" (no second
        write); a failed write rolls the consume back (retryable) but can never
        double-book (row lock + used_at check + the DB booking constraint backstop).
        """
        link = linking.get_linked(platform, external_user_id)
        user = link.user if link else None
        result_code = "ok"
        error_code = ""
        reply: Reply
        try:
            with transaction.atomic():
                try:
                    ct = ChatConfirmToken.objects.select_for_update().get(
                        token=token_str
                    )
                except (ChatConfirmToken.DoesNotExist, ValidationError, ValueError):
                    raise _InvalidToken("invalid")
                if user is None or ct.user_id != user.id:
                    raise _InvalidToken("invalid")
                if ct.used_at is not None:
                    raise _AlreadyHandled()
                if ct.is_expired:
                    raise _InvalidToken("expired")
                ct.used_at = tz.now()
                ct.save(update_fields=["used_at"])
                reply = Reply.text_reply(self._perform_write(ct, user))
        except _AlreadyHandled:
            result_code, reply = (
                "already_handled",
                Reply.text_reply(ALREADY_HANDLED_TEXT),
            )
        except _InvalidToken as exc:
            result_code, error_code = "error", exc.code
            reply = Reply.text_reply(
                EXPIRED_CONFIRM_TEXT if exc.code == "expired" else INVALID_CONFIRM_TEXT
            )
        except _WriteError as exc:
            result_code, error_code = "error", exc.code
            reply = Reply.text_reply(exc.message)

        self._audit(
            platform,
            external_user_id,
            user,
            "confirm",
            {"token": token_str},
            result_code,
            error_code,
        )
        return reply

    def _perform_write(self, ct: ChatConfirmToken, user) -> str:
        """Runs INSIDE the token-consume transaction; a raised ``_WriteError`` rolls
        the whole thing back (token un-consumed → retryable)."""
        if ct.action == ChatConfirmToken.Action.BOOK_DESK:
            return self._perform_book(ct, user)
        return self._perform_cancel(ct, user)

    def _perform_book(self, ct: ChatConfirmToken, user) -> str:
        p = ct.payload
        booking_date = datetime.date.fromisoformat(p["booking_date"])
        office, membership = get_office_for_user(user, p["office_id"])
        if office is None or membership is None:
            raise _WriteError("office_gone", DESK_GONE_TEXT)
        floor = get_floor_for_office(office, p["floor_id"])
        if floor is None:
            raise _WriteError("floor_gone", DESK_GONE_TEXT)
        try:
            from offices.models import Desk

            create_booking_for_user(
                organization=membership.organization,
                office=office,
                floor=floor,
                desk_id=p["desk_id"],
                user=user,
                booking_date=booking_date,
            )
        except Desk.DoesNotExist:
            raise _WriteError("desk_gone", DESK_GONE_TEXT)
        except BookingFloorNotPublishedError:
            raise _WriteError("floor_draft", FLOOR_DRAFT_TEXT)
        except BookingDeskNotAvailableError:
            raise _WriteError("desk_unavailable", DESK_UNAVAILABLE_TEXT)
        except DuplicateBookingError:
            raise _WriteError("duplicate", DUPLICATE_TEXT.format(date=booking_date))
        except IntegrityError:
            raise _WriteError("conflict", DUPLICATE_TEXT.format(date=booking_date))
        desk = floor.desks.get(id=p["desk_id"])
        return BOOKED_OK_TEXT.format(
            desk=desk.name, where=f"{floor.name}, {office.name}", date=booking_date
        )

    def _perform_cancel(self, ct: ChatConfirmToken, user) -> str:
        booking = get_my_desk_booking(user, ct.payload["booking_id"])
        if booking is None:
            raise _WriteError("not_found", CANCEL_NOT_FOUND_TEXT)
        try:
            cancel_desk_booking(booking, cancelled_by=user)
        except DeskBookingAlreadyCancelledError:
            raise _WriteError("already_cancelled", ALREADY_CANCELLED_TEXT)
        return CANCELLED_OK_TEXT.format(
            desk=booking.desk.name, date=booking.booking_date
        )

    # ─── helpers ──────────────────────────────────────────────────────────────

    def _user_date(self, user, offset: int) -> datetime.date:
        name = (
            getattr(user, "timezone", "") or ""
        ).strip() or settings.BOOKING_DEFAULT_TIMEZONE
        try:
            zone = zoneinfo.ZoneInfo(name)
        except Exception:
            zone = zoneinfo.ZoneInfo("UTC")
        return tz.now().astimezone(zone).date() + datetime.timedelta(days=offset)

    def _confirm_expiry(self):
        return tz.now() + datetime.timedelta(
            minutes=settings.CHAT_CONFIRM_TOKEN_TTL_MINUTES
        )

    def _format_reads(self, date, desks, rooms) -> str:
        if not desks and not rooms:
            return (
                f"You have nothing booked for {date}. "
                "Send `book` to grab your usual desk."
            )
        lines = [f"Your bookings for {date}:"]
        for b in desks:
            lines.append(f"• Desk {b.desk.name} ({b.floor.name}, {b.office.name})")
        for b in rooms:
            lines.append(
                f"• Room {b.room.name} — {b.start_at:%H:%M}–{b.end_at:%H:%M} UTC"
            )
        return "\n".join(lines)

    def _audited(
        self, inbound: InboundCommand, user, result: str, error_code: str, reply: Reply
    ) -> Reply:
        self._audit(
            inbound.platform,
            inbound.external_user_id,
            user,
            inbound.intent.value,
            dict(inbound.slots),
            result,
            error_code,
        )
        return reply

    def _audit(
        self, platform, external_user_id, user, command, args, result, error_code
    ):
        BotActionAudit.objects.create(
            platform=platform,
            external_user_id=external_user_id,
            user=user,
            command=command,
            args=args,
            result=result,
            error_code=error_code,
        )
