"""Meeting-room booking tests (PR 073, Slice 1).

Covers the model-level overlap guarantee (GiST ExclusionConstraint), the
request-free RoomBookingService, the HTTP API (room CRUD, slot booking, cancel,
my-rooms), identity masking parity with desks, office-timezone + DST slot
handling, and the folded-in MyBookingsView default-window timezone fix.
"""

import datetime
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import (
    Floor,
    FloorLayoutObject,
    MeetingRoom,
    Office,
    RoomBooking,
)
from offices.services.room_booking_service import (
    RoomBookingAlreadyCancelledError,
    RoomBookingService,
    RoomFloorNotPublishedError,
    RoomNotAvailableError,
    RoomSlotConflictError,
)

User = get_user_model()
UTC = datetime.UTC


# ─── URL helpers ─────────────────────────────────────────────────────────────


def rooms_url(o, f):
    return f"/api/offices/{o}/floors/{f}/rooms/"


def room_bookings_url(o, f):
    return f"/api/offices/{o}/floors/{f}/room-bookings/"


def room_booking_cancel_url(o, f, b):
    return f"/api/offices/{o}/floors/{f}/room-bookings/{b}/cancel/"


MY_ROOMS_URL = "/api/bookings/my/rooms/"


# ─── data helpers ────────────────────────────────────────────────────────────


def _dt(y, m, d, hh, mm=0):
    return datetime.datetime(y, m, d, hh, mm, tzinfo=UTC)


def _future_date(days=2):
    return timezone.now().date() + datetime.timedelta(days=days)


def make_room_object(floor, label="Meeting Room A", object_type="meeting_room"):
    return FloorLayoutObject.objects.create(
        floor=floor,
        object_type=object_type,
        label=label,
        x="100.00",
        y="100.00",
        width="120.00",
        height="80.00",
        rotation="0.00",
    )


def make_room(org, office, floor, layout_object, name="Room A", capacity=6):
    return MeetingRoom.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=layout_object,
        name=name,
        capacity=capacity,
        status=MeetingRoom.Status.AVAILABLE,
    )


# ─── fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


@pytest.fixture
def active_org(db):
    return Organization.objects.create(
        name="Acme Corp",
        slug="acme-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def active_office(db, active_org):
    return Office.objects.create(
        organization=active_org, name="Dublin Office", slug="dublin-office"
    )


@pytest.fixture
def active_floor(db, active_office):
    return Floor.objects.create(
        office=active_office, name="Ground", slug="ground", level_number=0
    )


@pytest.fixture
def draft_floor(db, active_office):
    return Floor.objects.create(
        office=active_office,
        name="Draft",
        slug="draft",
        level_number=1,
        status=Floor.Status.DRAFT,
    )


@pytest.fixture
def room_object(db, active_floor):
    return make_room_object(active_floor)


@pytest.fixture
def room(db, active_org, active_office, active_floor, room_object):
    return make_room(active_org, active_office, active_floor, room_object)


def _make_user(org, role, email):
    user = User.objects.create_user(username=email, email=email, password="pass123")
    Membership.objects.create(
        user=user, organization=org, role=role, status=Membership.Status.ACTIVE
    )
    return user


@pytest.fixture
def member_user(db, active_org):
    return _make_user(active_org, MemberRole.MEMBER, "member@example.com")


@pytest.fixture
def member_user2(db, active_org):
    return _make_user(active_org, MemberRole.MEMBER, "member2@example.com")


@pytest.fixture
def admin_user(db, active_org):
    return _make_user(active_org, MemberRole.ADMIN, "admin@example.com")


@pytest.fixture
def member_client(client, member_user):
    client.force_authenticate(user=member_user)
    return client


@pytest.fixture
def admin_client(client, admin_user):
    client.force_authenticate(user=admin_user)
    return client


def _slot_body(room, date=None, start="10:00", end="11:00"):
    return {
        "room": room.id,
        "booking_date": (date or _future_date()).isoformat(),
        "start": start,
        "end": end,
    }


# ─── Model / constraint level ────────────────────────────────────────────────


def _seed_booking(room, org, office, floor, user, start_at, end_at, status=None):
    return RoomBooking.objects.create(
        organization=org,
        office=office,
        floor=floor,
        room=room,
        user=user,
        booking_date=start_at.date(),
        start_at=start_at,
        end_at=end_at,
        status=status or RoomBooking.Status.ACTIVE,
    )


@pytest.mark.django_db
def test_exclusion_constraint_blocks_overlapping_active(
    room, active_org, active_office, active_floor, member_user
):
    _seed_booking(
        room,
        active_org,
        active_office,
        active_floor,
        member_user,
        _dt(2099, 6, 15, 10),
        _dt(2099, 6, 15, 11),
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _seed_booking(
                room,
                active_org,
                active_office,
                active_floor,
                member_user,
                _dt(2099, 6, 15, 10, 30),
                _dt(2099, 6, 15, 11, 30),
            )


@pytest.mark.django_db
def test_adjacent_slots_allowed_half_open(
    room, active_org, active_office, active_floor, member_user
):
    # [10,11) and [11,12) are half-open and do NOT overlap.
    _seed_booking(
        room,
        active_org,
        active_office,
        active_floor,
        member_user,
        _dt(2099, 6, 15, 10),
        _dt(2099, 6, 15, 11),
    )
    _seed_booking(
        room,
        active_org,
        active_office,
        active_floor,
        member_user,
        _dt(2099, 6, 15, 11),
        _dt(2099, 6, 15, 12),
    )
    assert RoomBooking.objects.filter(room=room).count() == 2


@pytest.mark.django_db
def test_cancelled_booking_does_not_block_slot(
    room, active_org, active_office, active_floor, member_user
):
    b = _seed_booking(
        room,
        active_org,
        active_office,
        active_floor,
        member_user,
        _dt(2099, 6, 15, 10),
        _dt(2099, 6, 15, 11),
    )
    b.status = RoomBooking.Status.CANCELLED
    b.save(update_fields=["status"])
    # Same slot can be re-booked once the first is cancelled.
    _seed_booking(
        room,
        active_org,
        active_office,
        active_floor,
        member_user,
        _dt(2099, 6, 15, 10),
        _dt(2099, 6, 15, 11),
    )
    assert RoomBooking.objects.filter(room=room, status="active").count() == 1


@pytest.mark.django_db
def test_end_before_start_check_constraint(
    room, active_org, active_office, active_floor, member_user
):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            RoomBooking.objects.create(
                organization=active_org,
                office=active_office,
                floor=active_floor,
                room=room,
                user=member_user,
                booking_date=datetime.date(2099, 6, 15),
                start_at=_dt(2099, 6, 15, 11),
                end_at=_dt(2099, 6, 15, 10),
            )


@pytest.mark.django_db
def test_unique_active_room_per_layout_object(
    active_org, active_office, active_floor, room_object
):
    make_room(active_org, active_office, active_floor, room_object, name="R1")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_room(active_org, active_office, active_floor, room_object, name="R2")


# ─── Service (request-free) ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_service_create_booking_happy(
    room, active_org, active_office, active_floor, member_user
):
    booking = RoomBookingService().create_booking(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        room_id=room.id,
        user=member_user,
        booking_date=datetime.date(2099, 6, 15),
        start_at=_dt(2099, 6, 15, 10),
        end_at=_dt(2099, 6, 15, 11),
    )
    assert booking.pk is not None
    assert booking.status == RoomBooking.Status.ACTIVE


@pytest.mark.django_db
def test_service_overlap_raises_conflict(
    room, active_org, active_office, active_floor, member_user
):
    svc = RoomBookingService()
    svc.create_booking(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        room_id=room.id,
        user=member_user,
        booking_date=datetime.date(2099, 6, 15),
        start_at=_dt(2099, 6, 15, 10),
        end_at=_dt(2099, 6, 15, 11),
    )
    with pytest.raises(RoomSlotConflictError):
        svc.create_booking(
            organization=active_org,
            office=active_office,
            floor=active_floor,
            room_id=room.id,
            user=member_user,
            booking_date=datetime.date(2099, 6, 15),
            start_at=_dt(2099, 6, 15, 10, 30),
            end_at=_dt(2099, 6, 15, 11, 30),
        )


@pytest.mark.django_db
def test_service_conflict_survives_broken_pre_check(
    room, active_org, active_office, active_floor, member_user
):
    # If the in-Python overlap pre-check is bypassed (simulating a lost race),
    # the DB ExclusionConstraint still fires and is mapped to a conflict.
    svc = RoomBookingService()
    svc.create_booking(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        room_id=room.id,
        user=member_user,
        booking_date=datetime.date(2099, 6, 15),
        start_at=_dt(2099, 6, 15, 10),
        end_at=_dt(2099, 6, 15, 11),
    )
    with mock.patch(
        "offices.services.room_booking_service.RoomBooking.objects"
    ) as objs:
        # exists() returns False so the pre-check passes; the real save() below
        # must still hit the constraint. Route save() to the real manager.
        objs.filter.return_value.exists.return_value = False
        with pytest.raises(RoomSlotConflictError):
            svc.create_booking(
                organization=active_org,
                office=active_office,
                floor=active_floor,
                room_id=room.id,
                user=member_user,
                booking_date=datetime.date(2099, 6, 15),
                start_at=_dt(2099, 6, 15, 10, 15),
                end_at=_dt(2099, 6, 15, 10, 45),
            )


@pytest.mark.django_db
def test_service_unpublished_floor_raises(
    active_org, active_office, draft_floor, member_user
):
    lo = make_room_object(draft_floor)
    room = make_room(active_org, active_office, draft_floor, lo)
    with pytest.raises(RoomFloorNotPublishedError):
        RoomBookingService().create_booking(
            organization=active_org,
            office=active_office,
            floor=draft_floor,
            room_id=room.id,
            user=member_user,
            booking_date=datetime.date(2099, 6, 15),
            start_at=_dt(2099, 6, 15, 10),
            end_at=_dt(2099, 6, 15, 11),
        )


@pytest.mark.django_db
def test_service_unavailable_room_raises(
    room, active_org, active_office, active_floor, member_user
):
    room.status = MeetingRoom.Status.MAINTENANCE
    room.save(update_fields=["status"])
    with pytest.raises(RoomNotAvailableError):
        RoomBookingService().create_booking(
            organization=active_org,
            office=active_office,
            floor=active_floor,
            room_id=room.id,
            user=member_user,
            booking_date=datetime.date(2099, 6, 15),
            start_at=_dt(2099, 6, 15, 10),
            end_at=_dt(2099, 6, 15, 11),
        )


@pytest.mark.django_db
def test_service_room_not_found_raises(
    active_org, active_office, active_floor, member_user
):
    with pytest.raises(MeetingRoom.DoesNotExist):
        RoomBookingService().create_booking(
            organization=active_org,
            office=active_office,
            floor=active_floor,
            room_id=999999,
            user=member_user,
            booking_date=datetime.date(2099, 6, 15),
            start_at=_dt(2099, 6, 15, 10),
            end_at=_dt(2099, 6, 15, 11),
        )


@pytest.mark.django_db
def test_service_cancel_then_slot_reusable(
    room, active_org, active_office, active_floor, member_user
):
    svc = RoomBookingService()
    b = svc.create_booking(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        room_id=room.id,
        user=member_user,
        booking_date=datetime.date(2099, 6, 15),
        start_at=_dt(2099, 6, 15, 10),
        end_at=_dt(2099, 6, 15, 11),
    )
    svc.cancel_booking(b, cancelled_by=member_user)
    b.refresh_from_db()
    assert b.status == RoomBooking.Status.CANCELLED
    assert b.cancelled_by_id == member_user.id
    # Same slot is now free.
    svc.create_booking(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        room_id=room.id,
        user=member_user,
        booking_date=datetime.date(2099, 6, 15),
        start_at=_dt(2099, 6, 15, 10),
        end_at=_dt(2099, 6, 15, 11),
    )


@pytest.mark.django_db
def test_service_cancel_already_cancelled_raises(
    room, active_org, active_office, active_floor, member_user
):
    svc = RoomBookingService()
    b = svc.create_booking(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        room_id=room.id,
        user=member_user,
        booking_date=datetime.date(2099, 6, 15),
        start_at=_dt(2099, 6, 15, 10),
        end_at=_dt(2099, 6, 15, 11),
    )
    svc.cancel_booking(b, cancelled_by=member_user)
    with pytest.raises(RoomBookingAlreadyCancelledError):
        svc.cancel_booking(b, cancelled_by=member_user)


# ─── API: room CRUD ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_admin_can_create_room(admin_client, active_office, active_floor, room_object):
    res = admin_client.post(
        rooms_url(active_office.id, active_floor.id),
        {"layout_object": room_object.id, "name": "Boardroom", "capacity": 8},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["name"] == "Boardroom"
    assert res.data["capacity"] == 8
    assert MeetingRoom.objects.filter(is_active=True).count() == 1


@pytest.mark.django_db
def test_member_cannot_create_room(
    member_client, active_office, active_floor, room_object
):
    res = member_client.post(
        rooms_url(active_office.id, active_floor.id),
        {"layout_object": room_object.id, "name": "Boardroom"},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_create_room_on_non_room_capable_object_400(
    admin_client, active_org, active_office, active_floor
):
    desk_obj = make_room_object(active_floor, label="Desk", object_type="desk")
    res = admin_client.post(
        rooms_url(active_office.id, active_floor.id),
        {"layout_object": desk_obj.id, "name": "Nope"},
        format="json",
    )
    assert res.status_code == 400
    assert "layout_object" in res.data


@pytest.mark.django_db
def test_create_duplicate_active_room_409(
    admin_client, active_office, active_floor, room, room_object
):
    res = admin_client.post(
        rooms_url(active_office.id, active_floor.id),
        {"layout_object": room_object.id, "name": "Second"},
        format="json",
    )
    assert res.status_code == 409


@pytest.mark.django_db
def test_list_rooms(member_client, active_office, active_floor, room):
    res = member_client.get(rooms_url(active_office.id, active_floor.id))
    assert res.status_code == 200
    assert len(res.data) == 1
    assert res.data[0]["id"] == room.id


# ─── API: room booking create/list ───────────────────────────────────────────


@pytest.mark.django_db
def test_member_can_book_slot(member_client, active_office, active_floor, room):
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room),
        format="json",
    )
    assert res.status_code == 201
    assert res.data["room"] == room.id
    assert res.data["is_mine"] is True


@pytest.mark.django_db
def test_response_includes_office_timezone(member_client, la_office, la_floor, la_room):
    # PR 076: room-booking responses carry the office IANA timezone so the client
    # renders start_at/end_at in office-local time without loading offices.
    with mock.patch(
        "offices.serializers.timezone.now", return_value=_dt(2027, 6, 1, 12)
    ):
        res = member_client.post(
            room_bookings_url(la_office.id, la_floor.id),
            {
                "room": la_room.id,
                "booking_date": "2027-06-15",
                "start": "10:00",
                "end": "11:00",
            },
            format="json",
        )
    assert res.status_code == 201
    assert res.data["office_timezone"] == "America/Los_Angeles"


@pytest.mark.django_db
def test_office_timezone_falls_back_to_default_when_unset(
    member_client, active_office, active_floor, room
):
    # active_office has no timezone configured → the field falls back to the
    # configured default (UTC in tests), never empty.
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room),
        format="json",
    )
    assert res.status_code == 201
    assert res.data["office_timezone"] == "UTC"


@pytest.mark.django_db
def test_overlapping_slot_conflicts_409(
    member_client, active_office, active_floor, room
):
    d = _future_date()
    first = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, d, "10:00", "11:00"),
        format="json",
    )
    assert first.status_code == 201
    second = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, d, "10:30", "11:30"),
        format="json",
    )
    assert second.status_code == 409


@pytest.mark.django_db
def test_adjacent_slots_both_succeed(member_client, active_office, active_floor, room):
    d = _future_date()
    a = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, d, "10:00", "11:00"),
        format="json",
    )
    b = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, d, "11:00", "12:00"),
        format="json",
    )
    assert a.status_code == 201
    assert b.status_code == 201


@pytest.mark.django_db
def test_book_unpublished_floor_409(
    member_client, active_org, active_office, draft_floor
):
    lo = make_room_object(draft_floor)
    room = make_room(active_org, active_office, draft_floor, lo)
    res = member_client.post(
        room_bookings_url(active_office.id, draft_floor.id),
        _slot_body(room),
        format="json",
    )
    assert res.status_code == 409


@pytest.mark.django_db
def test_book_unavailable_room_400(member_client, active_office, active_floor, room):
    room.status = MeetingRoom.Status.UNAVAILABLE
    room.save(update_fields=["status"])
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room),
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_book_past_date_400(member_client, active_office, active_floor, room):
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, datetime.date(2000, 1, 1)),
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_book_beyond_horizon_400(member_client, active_office, active_floor, room):
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, _future_date(400)),
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_book_end_before_start_400(member_client, active_office, active_floor, room):
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, start="11:00", end="10:00"),
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_book_too_short_400(member_client, active_office, active_floor, room):
    # 10 min < 15 min minimum.
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, start="10:00", end="10:10"),
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_book_too_long_400(member_client, active_office, active_floor, room):
    # 9h > 8h maximum.
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, start="08:00", end="17:00"),
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_room_not_found_404(member_client, active_office, active_floor):
    res = member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        {
            "room": 999999,
            "booking_date": _future_date().isoformat(),
            "start": "10:00",
            "end": "11:00",
        },
        format="json",
    )
    assert res.status_code == 404


@pytest.mark.django_db
def test_list_room_bookings_by_date(member_client, active_office, active_floor, room):
    d = _future_date()
    member_client.post(
        room_bookings_url(active_office.id, active_floor.id),
        _slot_body(room, d),
        format="json",
    )
    res = member_client.get(
        room_bookings_url(active_office.id, active_floor.id) + f"?date={d.isoformat()}"
    )
    assert res.status_code == 200
    assert len(res.data) == 1


@pytest.mark.django_db
def test_list_room_bookings_requires_date(member_client, active_office, active_floor):
    res = member_client.get(room_bookings_url(active_office.id, active_floor.id))
    assert res.status_code == 400


@pytest.mark.django_db
def test_list_room_bookings_invalid_date_400(
    member_client, active_office, active_floor
):
    res = member_client.get(
        room_bookings_url(active_office.id, active_floor.id) + "?date=notadate"
    )
    assert res.status_code == 400


# ─── API: identity masking ───────────────────────────────────────────────────


def _book_as(client, office, floor, room, date, start="10:00", end="11:00"):
    return client.post(
        room_bookings_url(office.id, floor.id),
        _slot_body(room, date, start, end),
        format="json",
    )


@pytest.mark.django_db
def test_member_sees_reserved_for_others(
    client, active_office, active_floor, room, member_user, member_user2
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    _book_as(client, active_office, active_floor, room, d)

    client.force_authenticate(user=member_user2)
    res = client.get(
        room_bookings_url(active_office.id, active_floor.id) + f"?date={d.isoformat()}"
    )
    assert res.status_code == 200
    row = res.data[0]
    assert row["user_name"] == "Reserved"
    assert row["is_mine"] is False
    assert "user" not in row


@pytest.mark.django_db
def test_manager_sees_identity(
    client, active_office, active_floor, room, member_user, admin_user
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    _book_as(client, active_office, active_floor, room, d)

    client.force_authenticate(user=admin_user)
    res = client.get(
        room_bookings_url(active_office.id, active_floor.id) + f"?date={d.isoformat()}"
    )
    assert res.status_code == 200
    row = res.data[0]
    assert row["user_name"] != "Reserved"
    assert row["user"] == member_user.id


# ─── API: cancel ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_owner_can_cancel_own_booking(
    client, active_office, active_floor, room, member_user
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    created = _book_as(client, active_office, active_floor, room, d)
    bid = created.data["id"]
    res = client.post(
        room_booking_cancel_url(active_office.id, active_floor.id, bid),
        {},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["status"] == "cancelled"


@pytest.mark.django_db
def test_manager_can_cancel_others_booking(
    client, active_office, active_floor, room, member_user, admin_user
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    created = _book_as(client, active_office, active_floor, room, d)
    bid = created.data["id"]
    client.force_authenticate(user=admin_user)
    res = client.post(
        room_booking_cancel_url(active_office.id, active_floor.id, bid),
        {},
        format="json",
    )
    assert res.status_code == 200


@pytest.mark.django_db
def test_other_member_cannot_cancel_403(
    client, active_office, active_floor, room, member_user, member_user2
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    created = _book_as(client, active_office, active_floor, room, d)
    bid = created.data["id"]
    client.force_authenticate(user=member_user2)
    res = client.post(
        room_booking_cancel_url(active_office.id, active_floor.id, bid),
        {},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_cancel_already_cancelled_400(
    client, active_office, active_floor, room, member_user
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    created = _book_as(client, active_office, active_floor, room, d)
    bid = created.data["id"]
    url = room_booking_cancel_url(active_office.id, active_floor.id, bid)
    client.post(url, {}, format="json")
    res = client.post(url, {}, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_cancel_not_found_404(member_client, active_office, active_floor):
    res = member_client.post(
        room_booking_cancel_url(active_office.id, active_floor.id, 999999),
        {},
        format="json",
    )
    assert res.status_code == 404


# ─── API: my room bookings ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_my_room_bookings_returns_own(
    client, active_office, active_floor, room, member_user, member_user2
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    _book_as(client, active_office, active_floor, room, d)
    client.force_authenticate(user=member_user2)
    _book_as(client, active_office, active_floor, room, d, "12:00", "13:00")

    client.force_authenticate(user=member_user)
    res = client.get(MY_ROOMS_URL)
    assert res.status_code == 200
    assert len(res.data) == 1
    assert res.data[0]["is_mine"] is True


@pytest.mark.django_db
def test_my_room_bookings_status_filter(
    client, active_office, active_floor, room, member_user
):
    d = _future_date()
    client.force_authenticate(user=member_user)
    created = _book_as(client, active_office, active_floor, room, d)
    bid = created.data["id"]
    client.post(
        room_booking_cancel_url(active_office.id, active_floor.id, bid),
        {},
        format="json",
    )
    # Default active window excludes the cancelled booking.
    assert len(client.get(MY_ROOMS_URL).data) == 0
    # Explicit cancelled filter shows it.
    assert len(client.get(MY_ROOMS_URL + "?status=cancelled").data) == 1


# ─── Office timezone / DST ───────────────────────────────────────────────────


@pytest.fixture
def la_office(db, active_org):
    return Office.objects.create(
        organization=active_org,
        name="LA Office",
        slug="la-office",
        timezone="America/Los_Angeles",
    )


@pytest.fixture
def la_floor(db, la_office):
    return Floor.objects.create(office=la_office, name="LA", slug="la", level_number=0)


@pytest.fixture
def la_room(db, active_org, la_office, la_floor):
    lo = make_room_object(la_floor)
    return make_room(active_org, la_office, la_floor, lo)


@pytest.mark.django_db
def test_dst_nonexistent_local_time_rejected(
    member_client, la_office, la_floor, la_room
):
    # 2027-03-14 is the US spring-forward: 02:00→03:00, so 02:30 does not exist
    # in America/Los_Angeles. `now` is pinned so the date stays future+in-horizon
    # (so we exercise the DST path, not the past/horizon guard).
    with mock.patch(
        "offices.serializers.timezone.now", return_value=_dt(2027, 3, 1, 12)
    ):
        res = member_client.post(
            room_bookings_url(la_office.id, la_floor.id),
            {
                "room": la_room.id,
                "booking_date": "2027-03-14",
                "start": "02:30",
                "end": "02:45",
            },
            format="json",
        )
    assert res.status_code == 400
    assert "daylight" in str(res.data).lower()


@pytest.mark.django_db
def test_office_local_time_converts_to_utc(member_client, la_office, la_floor, la_room):
    # 2027-06-15 10:00–11:00 PDT (UTC-7) → 17:00–18:00 UTC.
    with mock.patch(
        "offices.serializers.timezone.now", return_value=_dt(2027, 6, 1, 12)
    ):
        res = member_client.post(
            room_bookings_url(la_office.id, la_floor.id),
            {
                "room": la_room.id,
                "booking_date": "2027-06-15",
                "start": "10:00",
                "end": "11:00",
            },
            format="json",
        )
    assert res.status_code == 201
    booking = RoomBooking.objects.get(id=res.data["id"])
    assert booking.start_at == _dt(2027, 6, 15, 17)
    assert booking.end_at == _dt(2027, 6, 15, 18)


# ─── Folded-in: MyBookingsView default-window timezone fix ────────────────────


@pytest.mark.django_db
def test_my_bookings_default_window_uses_booking_timezone(
    client, settings, active_org, active_office, active_floor, member_user
):
    """A desk booking dated 'today' in the configured booking timezone must appear
    in the default active window even when server-UTC has already rolled to
    tomorrow (BE-3 rule, folded into this slice)."""
    from offices.models import Desk, DeskBooking

    settings.BOOKING_DEFAULT_TIMEZONE = "America/Los_Angeles"
    lo = make_room_object(active_floor, label="D", object_type="desk")
    desk = Desk.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        layout_object=lo,
        name="Desk",
        status=Desk.Status.AVAILABLE,
    )
    # 2026-06-16 05:00 UTC == 2026-06-15 22:00 PDT → local "today" is the 15th.
    fake_now = _dt(2026, 6, 16, 5)
    DeskBooking.objects.create(
        organization=active_org,
        office=active_office,
        floor=active_floor,
        desk=desk,
        user=member_user,
        booking_date=datetime.date(2026, 6, 15),
        status=DeskBooking.Status.ACTIVE,
    )
    client.force_authenticate(user=member_user)
    # PR 077: the default-window "today" computation moved out of the view into
    # list_my_desk_bookings, so the tz.now patch target moves with it (assertions
    # unchanged). See review/25 Discrepancies.
    with mock.patch("offices.services.booking_service.tz.now", return_value=fake_now):
        res = client.get("/api/bookings/my/")
    assert res.status_code == 200
    # Under raw-UTC 'today' (the 16th) this booking would be filtered out.
    assert any(b["booking_date"] == "2026-06-15" for b in res.data)
