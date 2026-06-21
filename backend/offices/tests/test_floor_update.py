import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization
from offices.models import Floor, Office

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def floor_detail_url(office_id: int, floor_id: int) -> str:
    return f"/api/offices/{office_id}/floors/{floor_id}/"


# ─── Fixtures ────────────────────────────────────────────────────────────────


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
def other_org(db):
    return Organization.objects.create(
        name="Other Corp",
        slug="other-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.fixture
def active_office(db, active_org):
    return Office.objects.create(
        organization=active_org, name="Dublin Office", slug="dublin-office"
    )


@pytest.fixture
def other_office(db, other_org):
    return Office.objects.create(
        organization=other_org, name="London Office", slug="london-office"
    )


@pytest.fixture
def floor(db, active_office):
    return Floor.objects.create(office=active_office, name="Ground", slug="ground")


@pytest.fixture
def other_floor(db, other_office):
    return Floor.objects.create(office=other_office, name="Ground", slug="ground")


def _member(org, role, status=Membership.Status.ACTIVE, email="u@example.com"):
    user = User.objects.create_user(
        username=email, email=email, password="Strongpass1!"
    )
    Membership.objects.create(user=user, organization=org, role=role, status=status)
    return user


@pytest.fixture
def owner_client(client, active_org):
    client.force_authenticate(
        user=_member(active_org, MemberRole.OWNER, email="owner@example.com")
    )
    return client


@pytest.fixture
def member_client(client, active_org):
    client.force_authenticate(
        user=_member(active_org, MemberRole.MEMBER, email="member@example.com")
    )
    return client


# ─── Tests ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_default_boundary_dimensions(floor):
    assert float(floor.boundary_width) == 904
    assert float(floor.boundary_height) == 544


@pytest.mark.django_db
def test_owner_updates_boundary(owner_client, active_office, floor):
    res = owner_client.patch(
        floor_detail_url(active_office.id, floor.id),
        {"boundary_width": 1200, "boundary_height": 800},
        format="json",
    )
    assert res.status_code == 200
    assert float(res.data["boundary_width"]) == 1200
    assert float(res.data["boundary_height"]) == 800
    floor.refresh_from_db()
    assert float(floor.boundary_width) == 1200
    assert float(floor.boundary_height) == 800


@pytest.mark.django_db
def test_partial_update_keeps_other_dimension(owner_client, active_office, floor):
    res = owner_client.patch(
        floor_detail_url(active_office.id, floor.id),
        {"boundary_width": 1500},
        format="json",
    )
    assert res.status_code == 200
    floor.refresh_from_db()
    assert float(floor.boundary_width) == 1500
    assert float(floor.boundary_height) == 544


@pytest.mark.django_db
@pytest.mark.parametrize("bad", [100, 5000, -10])
def test_rejects_out_of_bounds(owner_client, active_office, floor, bad):
    res = owner_client.patch(
        floor_detail_url(active_office.id, floor.id),
        {"boundary_width": bad},
        format="json",
    )
    assert res.status_code == 400
    floor.refresh_from_db()
    assert float(floor.boundary_width) == 904


@pytest.mark.django_db
def test_empty_payload_rejected(owner_client, active_office, floor):
    res = owner_client.patch(
        floor_detail_url(active_office.id, floor.id), {}, format="json"
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_member_cannot_update(member_client, active_office, floor):
    res = member_client.patch(
        floor_detail_url(active_office.id, floor.id),
        {"boundary_width": 1200},
        format="json",
    )
    assert res.status_code == 403
    floor.refresh_from_db()
    assert float(floor.boundary_width) == 904


@pytest.mark.django_db
def test_cannot_update_floor_in_other_org(owner_client, active_office, other_floor):
    # Floor belongs to another org's office → not resolvable, 404 (no leak).
    res = owner_client.patch(
        floor_detail_url(active_office.id, other_floor.id),
        {"boundary_width": 1200},
        format="json",
    )
    assert res.status_code == 404


@pytest.mark.django_db
def test_unauthenticated_rejected(client, active_office, floor):
    res = client.patch(
        floor_detail_url(active_office.id, floor.id),
        {"boundary_width": 1200},
        format="json",
    )
    assert res.status_code in (401, 403)
