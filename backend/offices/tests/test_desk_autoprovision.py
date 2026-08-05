"""Desks drawn on the canvas are bookable automatically (PR 065).

Creating a desk-capable layout object via the API auto-provisions its Desk;
deleting the object retires that desk and cancels its bookings.
"""

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, Office

User = get_user_model()


def objects_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/layout-objects/"


def object_detail_url(office_id: int, floor_id: int, obj_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/layout-objects/{obj_id}/"


def booking_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/bookings/"


def desk_payload(object_type="desk", label="Desk A1"):
    return {
        "object_type": object_type,
        "label": label,
        "x": "100.00",
        "y": "100.00",
        "width": "80.00",
        "height": "50.00",
    }


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name="Acme Corp",
        slug="acme-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def office(db, org):
    return Office.objects.create(organization=org, name="Dublin", slug="dublin")


@pytest.fixture
def floor(db, office):
    return Floor.objects.create(office=office, name="Ground", slug="ground")


def _member(org, role, email):
    user = User.objects.create_user(
        username=email, email=email, password="Strongpass1!"
    )
    Membership.objects.create(
        user=user, organization=org, role=role, status=Membership.Status.ACTIVE
    )
    return user


@pytest.fixture
def owner_client(settings, org):
    settings.ALLOWED_HOSTS = ["testserver"]
    c = APIClient()
    c.force_authenticate(user=_member(org, MemberRole.OWNER, "owner@example.com"))
    return c


@pytest.fixture
def member_client(settings, org):
    settings.ALLOWED_HOSTS = ["testserver"]
    c = APIClient()
    c.force_authenticate(user=_member(org, MemberRole.MEMBER, "member@example.com"))
    return c


@pytest.mark.django_db
def test_creating_a_desk_object_auto_provisions_a_bookable_desk(
    owner_client, office, floor
):
    res = owner_client.post(
        objects_url(office.id, floor.id), desk_payload(), format="json"
    )
    assert res.status_code == 201
    obj_id = res.data["id"]
    desk = Desk.objects.get(layout_object_id=obj_id, is_active=True)
    assert desk.status == Desk.Status.AVAILABLE
    assert desk.name == "Desk A1"
    assert desk.organization_id == office.organization_id


@pytest.mark.django_db
def test_standing_desk_is_also_auto_provisioned(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id),
        desk_payload(object_type="standing_desk", label=""),
        format="json",
    )
    assert res.status_code == 201
    assert Desk.objects.filter(layout_object_id=res.data["id"], is_active=True).exists()


@pytest.mark.django_db
def test_non_desk_object_does_not_provision_a_desk(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id),
        {
            **desk_payload(object_type="wall", label="W"),
            "width": "200.00",
            "height": "10.00",
        },
        format="json",
    )
    assert res.status_code == 201
    assert not Desk.objects.filter(layout_object_id=res.data["id"]).exists()


@pytest.mark.django_db
def test_auto_provisioned_desk_can_be_booked(
    owner_client, member_client, office, floor
):
    res = owner_client.post(
        objects_url(office.id, floor.id), desk_payload(), format="json"
    )
    desk = Desk.objects.get(layout_object_id=res.data["id"])
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    booking = member_client.post(
        booking_url(office.id, floor.id),
        {"desk": desk.id, "booking_date": tomorrow},
        format="json",
    )
    assert booking.status_code == 201


@pytest.mark.django_db
def test_deleting_a_desk_object_retires_its_desk_and_cancels_bookings(
    owner_client, member_client, office, floor
):
    res = owner_client.post(
        objects_url(office.id, floor.id), desk_payload(), format="json"
    )
    obj_id = res.data["id"]
    desk = Desk.objects.get(layout_object_id=obj_id)
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    member_client.post(
        booking_url(office.id, floor.id),
        {"desk": desk.id, "booking_date": tomorrow},
        format="json",
    )

    res = owner_client.delete(object_detail_url(office.id, floor.id, obj_id))
    assert res.status_code == 204
    desk.refresh_from_db()
    assert desk.is_active is False
    assert not DeskBooking.objects.filter(
        desk=desk, status=DeskBooking.Status.ACTIVE
    ).exists()


# ─── BE-1: PATCH across the desk-capable boundary keeps the Desk consistent ───


@pytest.mark.django_db
def test_patch_desk_to_non_desk_retires_its_desk_and_cancels_bookings(
    owner_client, member_client, office, floor
):
    res = owner_client.post(
        objects_url(office.id, floor.id), desk_payload(), format="json"
    )
    obj_id = res.data["id"]
    desk = Desk.objects.get(layout_object_id=obj_id)
    tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
    member_client.post(
        booking_url(office.id, floor.id),
        {"desk": desk.id, "booking_date": tomorrow},
        format="json",
    )

    # Change the object type off the desk-capable set: the Desk must be retired
    # (not left stranded as a bookable "plant") and its bookings cancelled.
    res = owner_client.patch(
        object_detail_url(office.id, floor.id, obj_id),
        {"object_type": "plant"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["object_type"] == "plant"
    desk.refresh_from_db()
    assert desk.is_active is False
    assert not Desk.objects.filter(layout_object_id=obj_id, is_active=True).exists()
    assert not DeskBooking.objects.filter(
        desk=desk, status=DeskBooking.Status.ACTIVE
    ).exists()


@pytest.mark.django_db
def test_patch_non_desk_to_desk_provisions_a_desk(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id),
        {**desk_payload(object_type="plant", label="Ficus")},
        format="json",
    )
    obj_id = res.data["id"]
    assert not Desk.objects.filter(layout_object_id=obj_id).exists()

    res = owner_client.patch(
        object_detail_url(office.id, floor.id, obj_id),
        {"object_type": "desk"},
        format="json",
    )
    assert res.status_code == 200
    desk = Desk.objects.get(layout_object_id=obj_id, is_active=True)
    assert desk.status == Desk.Status.AVAILABLE


@pytest.mark.django_db
def test_patch_desk_geometry_only_keeps_the_same_desk(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id), desk_payload(), format="json"
    )
    obj_id = res.data["id"]
    desk_id = Desk.objects.get(layout_object_id=obj_id, is_active=True).id

    res = owner_client.patch(
        object_detail_url(office.id, floor.id, obj_id),
        {"x": "150.00", "y": "175.00"},
        format="json",
    )
    assert res.status_code == 200
    active = Desk.objects.filter(layout_object_id=obj_id, is_active=True)
    assert active.count() == 1
    assert active.first().id == desk_id  # not retired + re-provisioned


@pytest.mark.django_db
def test_patch_between_two_desk_types_keeps_the_same_desk(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id), desk_payload(), format="json"
    )
    obj_id = res.data["id"]
    desk_id = Desk.objects.get(layout_object_id=obj_id, is_active=True).id

    res = owner_client.patch(
        object_detail_url(office.id, floor.id, obj_id),
        {"object_type": "standing_desk"},
        format="json",
    )
    assert res.status_code == 200
    active = Desk.objects.filter(layout_object_id=obj_id, is_active=True)
    assert active.count() == 1
    assert active.first().id == desk_id  # both types are desk-capable → no churn


# ─── BE-8: server-side geometry validation ───────────────────────────────────


@pytest.mark.django_db
def test_create_normalizes_rotation_to_0_360(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id),
        {**desk_payload(object_type="chair"), "rotation": "450.00"},
        format="json",
    )
    assert res.status_code == 201
    assert float(res.data["rotation"]) == 90.0  # 450 % 360


@pytest.mark.django_db
def test_create_normalizes_negative_rotation(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id),
        {**desk_payload(object_type="chair"), "rotation": "-90.00"},
        format="json",
    )
    assert res.status_code == 201
    assert float(res.data["rotation"]) == 270.0  # -90 mod 360


@pytest.mark.django_db
def test_create_rejects_out_of_bounds_coordinate(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id),
        {**desk_payload(object_type="chair"), "x": "999999.00"},
        format="json",
    )
    assert res.status_code == 400
    assert "x" in res.data


@pytest.mark.django_db
def test_create_rejects_zero_width(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id),
        {**desk_payload(object_type="chair"), "width": "0.00"},
        format="json",
    )
    assert res.status_code == 400
    assert "width" in res.data


@pytest.mark.django_db
def test_patch_normalizes_rotation(owner_client, office, floor):
    res = owner_client.post(
        objects_url(office.id, floor.id), desk_payload(), format="json"
    )
    obj_id = res.data["id"]
    res = owner_client.patch(
        object_detail_url(office.id, floor.id, obj_id),
        {"rotation": "720.00"},
        format="json",
    )
    assert res.status_code == 200
    assert float(res.data["rotation"]) == 0.0  # 720 % 360
