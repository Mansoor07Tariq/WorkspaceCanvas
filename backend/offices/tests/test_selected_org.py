"""Tests for PR 055 selected-organization support.

Covers:
- ``?organization=<id>`` on the offices list and summary endpoints (validated
  against active memberships, falling back to first active membership).
- nested office/floor/desk endpoints resolving an office that belongs to ANY of
  the caller's active orgs (not just the first active membership), via
  ``get_office_for_user``.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Desk, Floor, FloorLayoutObject, Office

User = get_user_model()

SUMMARY_URL = "/api/offices/summary/"
OFFICES_URL = "/api/offices/"


@pytest.fixture
def client(settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return APIClient()


def _org(name, slug):
    return Organization.objects.create(
        name=name,
        slug=slug,
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


# "Acme" sorts before "Zephyr", so get_first_active_membership resolves Acme.
@pytest.fixture
def org_a(db):
    return _org("Acme Corp", "acme-corp")


@pytest.fixture
def org_b(db):
    return _org("Zephyr Inc", "zephyr-inc")


@pytest.fixture
def multi_org_user(db, org_a, org_b):
    """Active OWNER in both orgs. Acme (A) is the first active membership."""
    user = User.objects.create_user(
        username="multi@example.com", email="multi@example.com", password="Strongpass1!"
    )
    Membership.objects.create(
        user=user,
        organization=org_a,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    Membership.objects.create(
        user=user,
        organization=org_b,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def org_a_only_user(db, org_a):
    user = User.objects.create_user(
        username="a-only@example.com",
        email="a-only@example.com",
        password="Strongpass1!",
    )
    Membership.objects.create(
        user=user,
        organization=org_a,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return user


def _bookable_desk(org, office, floor, code):
    lo = FloorLayoutObject.objects.create(
        floor=floor,
        object_type=FloorLayoutObject.ObjectType.DESK,
        label=f"Desk {code}",
        x=0,
        y=0,
        width=80,
        height=50,
        rotation=0,
    )
    return Desk.objects.create(
        organization=org,
        office=office,
        floor=floor,
        layout_object=lo,
        name=f"Desk {code}",
        code=code,
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def org_b_office_floor(db, org_b):
    office = Office.objects.create(
        organization=org_b, name="Zephyr Office", slug="zephyr-office"
    )
    floor = Floor.objects.create(
        office=office, name="Z Floor", slug="z-floor", level_number=1
    )
    return office, floor


# ─── Summary ?organization= ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_summary_default_resolves_first_active_org(client, multi_org_user, org_a):
    Office.objects.create(organization=org_a, name="A Office", slug="a-office")
    client.force_authenticate(user=multi_org_user)
    response = client.get(SUMMARY_URL)
    assert response.status_code == 200
    assert response.data["organization"] == org_a.id
    assert response.data["offices_count"] == 1


@pytest.mark.django_db
def test_summary_selected_org_returns_that_org(
    client, multi_org_user, org_b, org_b_office_floor
):
    office, floor = org_b_office_floor
    _bookable_desk(org_b, office, floor, "Z1")
    client.force_authenticate(user=multi_org_user)
    response = client.get(f"{SUMMARY_URL}?organization={org_b.id}")
    assert response.status_code == 200
    assert response.data["organization"] == org_b.id
    assert response.data["offices_count"] == 1
    assert response.data["bookable_desks_count"] == 1


@pytest.mark.django_db
def test_summary_selected_org_without_membership_rejected(
    client, org_a_only_user, org_b
):
    client.force_authenticate(user=org_a_only_user)
    response = client.get(f"{SUMMARY_URL}?organization={org_b.id}")
    assert response.status_code == 403


@pytest.mark.django_db
def test_summary_selected_org_with_disabled_membership_rejected(client, org_a, org_b):
    user = User.objects.create_user(
        username="disabled-b@example.com",
        email="disabled-b@example.com",
        password="Strongpass1!",
    )
    Membership.objects.create(
        user=user,
        organization=org_a,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    Membership.objects.create(
        user=user,
        organization=org_b,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    client.force_authenticate(user=user)
    response = client.get(f"{SUMMARY_URL}?organization={org_b.id}")
    assert response.status_code == 403


@pytest.mark.django_db
def test_summary_invalid_org_param_falls_back_to_first_active(
    client, org_a_only_user, org_a
):
    Office.objects.create(organization=org_a, name="A Office", slug="a-office")
    client.force_authenticate(user=org_a_only_user)
    # Non-numeric param is ignored → first active membership.
    response = client.get(f"{SUMMARY_URL}?organization=not-a-number")
    assert response.status_code == 200
    assert response.data["organization"] == org_a.id


# ─── Offices list ?organization= ─────────────────────────────────────────────────


@pytest.mark.django_db
def test_offices_list_selected_org(client, multi_org_user, org_a, org_b):
    Office.objects.create(organization=org_a, name="A Office", slug="a-office")
    Office.objects.create(organization=org_b, name="B Office", slug="b-office")
    client.force_authenticate(user=multi_org_user)

    resp_a = client.get(OFFICES_URL)  # default → org A
    assert [o["name"] for o in resp_a.data] == ["A Office"]

    resp_b = client.get(f"{OFFICES_URL}?organization={org_b.id}")
    assert [o["name"] for o in resp_b.data] == ["B Office"]


@pytest.mark.django_db
def test_offices_list_selected_org_without_membership_rejected(
    client, org_a_only_user, org_b
):
    client.force_authenticate(user=org_a_only_user)
    response = client.get(f"{OFFICES_URL}?organization={org_b.id}")
    assert response.status_code == 403


@pytest.mark.django_db
def test_office_create_in_selected_org(client, multi_org_user, org_b):
    client.force_authenticate(user=multi_org_user)
    response = client.post(
        f"{OFFICES_URL}?organization={org_b.id}",
        {"name": "New Zephyr Office"},
        format="json",
    )
    assert response.status_code == 201
    office = Office.objects.get(id=response.data["id"])
    assert office.organization_id == org_b.id


# ─── Nested endpoints resolve office across active orgs (get_office_for_user) ─────


@pytest.mark.django_db
def test_floors_list_of_non_first_org_office_is_accessible(
    client, multi_org_user, org_b_office_floor
):
    office, floor = org_b_office_floor
    client.force_authenticate(user=multi_org_user)
    # Acme is first-active, but the office is in Zephyr — must still resolve.
    response = client.get(f"/api/offices/{office.id}/floors/")
    assert response.status_code == 200
    assert [f["name"] for f in response.data] == ["Z Floor"]


@pytest.mark.django_db
def test_layout_objects_of_non_first_org_office_accessible(
    client, multi_org_user, org_b, org_b_office_floor
):
    office, floor = org_b_office_floor
    _bookable_desk(org_b, office, floor, "Z1")
    client.force_authenticate(user=multi_org_user)
    response = client.get(f"/api/offices/{office.id}/floors/{floor.id}/layout-objects/")
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_non_member_cannot_access_other_org_office_floors(
    client, org_a_only_user, org_b_office_floor
):
    office, floor = org_b_office_floor
    client.force_authenticate(user=org_a_only_user)
    # org_a_only_user is not a member of Zephyr → 404 (no cross-org existence leak).
    response = client.get(f"/api/offices/{office.id}/floors/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_no_membership_user_still_gets_403_on_nested(client, org_b_office_floor):
    office, floor = org_b_office_floor
    user = User.objects.create_user(
        username="nobody@example.com",
        email="nobody@example.com",
        password="Strongpass1!",
    )
    client.force_authenticate(user=user)
    response = client.get(f"/api/offices/{office.id}/floors/")
    # No active membership anywhere → 403 (gate preserved).
    assert response.status_code == 403
