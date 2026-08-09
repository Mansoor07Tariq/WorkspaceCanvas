import datetime

import pytest
from django.utils import timezone

from accounts.models import Membership
from chat.commands import CommandRouter, Intent, ReplyKind
from chat.models import BotActionAudit, ChatConfirmToken, ChatLink
from chat.services.glue import ServiceGlue, record_event
from offices.models import DeskBooking

USUAL_DATE = datetime.date(2000, 1, 1)


def _cmd(intent, slots=None, external_user_id="U123"):
    from chat.commands import InboundCommand

    return InboundCommand(
        platform="slack",
        external_user_id=external_user_id,
        external_team_id="T1",
        intent=intent,
        slots=slots or {},
    )


def _new_active_desk_bookings(user):
    return DeskBooking.objects.filter(
        user=user, status=DeskBooking.Status.ACTIVE
    ).exclude(booking_date=USUAL_DATE)


# ─── router ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "text,intent,offset",
    [
        ("today", Intent.TODAY, None),
        ("tomorrow", Intent.TOMORROW, None),
        ("book", Intent.BOOK, 0),
        ("book tomorrow", Intent.BOOK, 1),
        ("cancel", Intent.CANCEL, 0),
        ("cancel tomorrow", Intent.CANCEL, 1),
        ("help", Intent.HELP, None),
        ("", Intent.HELP, None),
        ("link", Intent.LINK, None),
        ("wat is this", Intent.UNKNOWN, None),
    ],
)
def test_router_parses_fixed_intents(text, intent, offset):
    cmd = CommandRouter.parse_text(text, platform="slack", external_user_id="U1")
    assert cmd.intent == intent
    if offset is not None:
        assert cmd.slots["date_offset"] == offset


# ─── reads + help + link (no write) ───────────────────────────────────────────


@pytest.mark.django_db
def test_help_works_unlinked_and_is_audited():
    reply = ServiceGlue().handle(_cmd(Intent.HELP))
    assert reply.kind == ReplyKind.TEXT
    assert "book" in reply.text.lower()
    assert BotActionAudit.objects.filter(command="help", result="ok").count() == 1


@pytest.mark.django_db
def test_link_prompt_when_unlinked_creates_pending_link():
    reply = ServiceGlue().handle(_cmd(Intent.LINK, external_user_id="Unew"))
    assert "link-chat?code=" in reply.text
    link = ChatLink.objects.get(platform="slack", external_user_id="Unew")
    assert link.status == ChatLink.Status.PENDING
    assert BotActionAudit.objects.filter(command="link").count() == 1


@pytest.mark.django_db
def test_link_when_already_linked_says_so(linked):
    reply = ServiceGlue().handle(_cmd(Intent.LINK))
    assert "already linked" in reply.text.lower()
    assert BotActionAudit.objects.filter(
        command="link", error_code="already_linked"
    ).exists()


@pytest.mark.django_db
def test_read_when_unlinked_prompts_link_and_is_audited():
    reply = ServiceGlue().handle(_cmd(Intent.TODAY))
    assert "link" in reply.text.lower()
    audit = BotActionAudit.objects.get(command="today")
    assert audit.error_code == "not_linked"
    assert audit.user_id is None


@pytest.mark.django_db
def test_today_lists_the_users_bookings(linked, user, org, office, floor, desk):
    today = timezone.now().date()
    DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    reply = ServiceGlue().handle(_cmd(Intent.TODAY))
    assert "Desk A1" in reply.text
    assert BotActionAudit.objects.filter(command="today", result="ok").count() == 1


# ─── fail closed ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_revoked_link_fails_closed(linked, user):
    linked.status = ChatLink.Status.REVOKED
    linked.save(update_fields=["status"])
    reply = ServiceGlue().handle(_cmd(Intent.TODAY))
    assert "link" in reply.text.lower()  # treated as unlinked


@pytest.mark.django_db
def test_lost_membership_fails_closed(linked, user, org):
    Membership.objects.filter(user=user, organization=org).update(
        status=Membership.Status.DISABLED
    )
    reply = ServiceGlue().handle(_cmd(Intent.BOOK))
    assert "membership" in reply.text.lower()
    assert BotActionAudit.objects.filter(
        command="book", error_code="no_membership"
    ).exists()
    # Fail-closed: no confirm token was minted.
    assert ChatConfirmToken.objects.count() == 0


# ─── book: confirm required, single-use, audited ──────────────────────────────


@pytest.mark.django_db
def test_book_returns_confirm_and_does_not_write(linked, user, usual_booking):
    reply = ServiceGlue().handle(_cmd(Intent.BOOK))
    assert reply.kind == ReplyKind.CONFIRM
    assert reply.confirm is not None and reply.confirm.token
    # The write MUST NOT have happened yet — only a confirm token exists.
    assert _new_active_desk_bookings(user).count() == 0
    assert ChatConfirmToken.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_book_no_usual_desk(linked, user):
    reply = ServiceGlue().handle(_cmd(Intent.BOOK))
    assert "usual desk" in reply.text.lower()
    assert ChatConfirmToken.objects.count() == 0


@pytest.mark.django_db
def test_confirm_executes_the_booking_once(linked, user, usual_booking):
    glue = ServiceGlue()
    confirm = glue.handle(_cmd(Intent.BOOK)).confirm
    reply = glue.execute_confirmed(
        platform="slack", external_user_id="U123", token_str=confirm.token
    )
    assert "Booked" in reply.text
    assert _new_active_desk_bookings(user).count() == 1
    assert BotActionAudit.objects.filter(command="confirm", result="ok").count() == 1


@pytest.mark.django_db
def test_confirm_token_is_single_use(linked, user, usual_booking):
    glue = ServiceGlue()
    confirm = glue.handle(_cmd(Intent.BOOK)).confirm
    glue.execute_confirmed(
        platform="slack", external_user_id="U123", token_str=confirm.token
    )
    # A redelivered/duplicate confirm must NOT book a second time.
    reply2 = glue.execute_confirmed(
        platform="slack", external_user_id="U123", token_str=confirm.token
    )
    assert "already handled" in reply2.text.lower()
    assert _new_active_desk_bookings(user).count() == 1
    assert (
        BotActionAudit.objects.filter(
            command="confirm", result="already_handled"
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_confirm_rejects_a_foreign_users_token(linked, user, other_user, usual_booking):
    # A confirm token minted for `user` cannot be executed by another chat identity.
    glue = ServiceGlue()
    confirm = glue.handle(_cmd(Intent.BOOK)).confirm
    ChatLink.objects.create(
        platform="slack",
        external_user_id="UOTHER",
        user=other_user,
        status=ChatLink.Status.LINKED,
        expires_at=timezone.now() + datetime.timedelta(days=1),
    )
    reply = glue.execute_confirmed(
        platform="slack", external_user_id="UOTHER", token_str=confirm.token
    )
    assert "no longer valid" in reply.text.lower()
    assert _new_active_desk_bookings(user).count() == 0


# ─── cancel ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_cancel_confirm_then_execute(linked, user, org, office, floor, desk):
    today = timezone.now().date()
    booking = DeskBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        desk=desk,
        user=user,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    )
    glue = ServiceGlue()
    confirm = glue.handle(_cmd(Intent.CANCEL)).confirm
    assert confirm is not None
    booking.refresh_from_db()
    assert booking.status == DeskBooking.Status.ACTIVE  # not cancelled until confirm
    glue.execute_confirmed(
        platform="slack", external_user_id="U123", token_str=confirm.token
    )
    booking.refresh_from_db()
    assert booking.status == DeskBooking.Status.CANCELLED


@pytest.mark.django_db
def test_cancel_nothing_to_cancel(linked, user):
    reply = ServiceGlue().handle(_cmd(Intent.CANCEL))
    assert "no active desk booking" in reply.text.lower()
    assert ChatConfirmToken.objects.count() == 0


# ─── audit coverage + idempotency store ───────────────────────────────────────


@pytest.mark.django_db
def test_every_handle_writes_exactly_one_audit_row(linked, user, usual_booking):
    glue = ServiceGlue()
    glue.handle(_cmd(Intent.HELP))
    glue.handle(_cmd(Intent.TODAY))
    glue.handle(_cmd(Intent.BOOK))
    assert BotActionAudit.objects.count() == 3


@pytest.mark.django_db
def test_record_event_dedupes():
    assert record_event("slack", "evt-1") is True
    assert record_event("slack", "evt-1") is False  # redelivery
    assert record_event("slack", "evt-2") is True
