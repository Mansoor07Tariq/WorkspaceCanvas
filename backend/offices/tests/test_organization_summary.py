"""Tests for the org-wide dashboard summary endpoint (TD-035).

GET /api/offices/summary/ resolves the organization from the caller's first
active membership and returns org-wide counts (all offices/floors), not
first-office-only data.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import Invitation, MemberRole, Membership, Organization
from offices.models import Desk, Floor, FloorLayoutObject, Office

User = get_user_model()

URL = "/api/offices/summary/"


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


def _make_user(email: str) -> "User":
    return User.objects.create_user(
        username=email, email=email, password="Strongpass1!"
    )


@pytest.fixture
def owner_user(db, active_org):
    user = _make_user("owner@example.com")
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def member_user(db, active_org):
    user = _make_user("member@example.com")
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    return user


@pytest.fixture
def disabled_user(db, active_org):
    user = _make_user("disabled@example.com")
    Membership.objects.create(
        user=user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    return user


@pytest.fixture
def no_membership_user(db):
    return _make_user("nobody@example.com")


@pytest.fixture
def other_org_user(db, other_org):
    user = _make_user("other@example.com")
    Membership.objects.create(
        user=user,
        organization=other_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return user


def _build_bookable_desk(org, office, floor, *, code: str) -> Desk:
    layout_object = FloorLayoutObject.objects.create(
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
        layout_object=layout_object,
        name=f"Desk {code}",
        code=code,
        status=Desk.Status.AVAILABLE,
    )


@pytest.fixture
def two_offices_second_has_desks(db, active_org):
    """Two offices: the FIRST has no floors/desks; the SECOND has a floor and
    a bookable desk. This is the multi-office case TD-035 must handle."""
    first_office = Office.objects.create(
        organization=active_org, name="Aardvark Office", slug="aardvark-office"
    )
    second_office = Office.objects.create(
        organization=active_org, name="Zephyr Office", slug="zephyr-office"
    )
    floor = Floor.objects.create(
        office=second_office, name="Floor 1", slug="floor-1", level_number=1
    )
    _build_bookable_desk(active_org, second_office, floor, code="Z1")
    return first_office, second_office, floor


# ─── Auth & membership guards ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_unauthenticated_returns_401(client):
    assert client.get(URL).status_code == 401


@pytest.mark.django_db
def test_no_membership_returns_403(client, no_membership_user):
    client.force_authenticate(user=no_membership_user)
    assert client.get(URL).status_code == 403


@pytest.mark.django_db
def test_disabled_membership_returns_403(client, disabled_user):
    client.force_authenticate(user=disabled_user)
    assert client.get(URL).status_code == 403


@pytest.mark.django_db
def test_owner_can_read_summary(client, owner_user):
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert response.status_code == 200


@pytest.mark.django_db
def test_member_can_read_summary(client, member_user):
    client.force_authenticate(user=member_user)
    response = client.get(URL)
    assert response.status_code == 200


# ─── Org-wide counts ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_summary_counts_offices_org_wide(
    client, owner_user, two_offices_second_has_desks
):
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert response.status_code == 200
    assert response.data["offices_count"] == 2


@pytest.mark.django_db
def test_summary_setup_complete_when_only_second_office_has_desks(
    client, owner_user, two_offices_second_has_desks
):
    """The key TD-035 case: desks only in the SECOND office must still mark
    the workspace as set up."""
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert response.status_code == 200
    assert response.data["floors_count"] == 1
    assert response.data["bookable_desks_count"] == 1
    assert response.data["has_floors"] is True
    assert response.data["has_bookable_desks"] is True
    assert response.data["setup_complete"] is True


@pytest.mark.django_db
def test_summary_counts_layout_objects_org_wide(
    client, owner_user, two_offices_second_has_desks
):
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    # One layout object created for the single bookable desk.
    assert response.data["layout_objects_count"] == 1
    assert response.data["has_layout_objects"] is True


@pytest.mark.django_db
def test_summary_empty_org_is_not_setup_complete(client, owner_user):
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert response.data["offices_count"] == 0
    assert response.data["floors_count"] == 0
    assert response.data["bookable_desks_count"] == 0
    assert response.data["setup_complete"] is False


@pytest.mark.django_db
def test_summary_counts_active_members(client, owner_user, member_user, disabled_user):
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    # owner + member are active; disabled is excluded.
    assert response.data["active_members_count"] == 2


# ─── Active-only filtering ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_summary_excludes_inactive_office(client, owner_user, active_org):
    Office.objects.create(
        organization=active_org, name="Live Office", slug="live-office"
    )
    Office.objects.create(
        organization=active_org,
        name="Archived Office",
        slug="archived-office",
        is_active=False,
    )
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert response.data["offices_count"] == 1


@pytest.mark.django_db
def test_summary_excludes_decommissioned_desk(client, owner_user, active_org):
    office = Office.objects.create(
        organization=active_org, name="Office", slug="office"
    )
    floor = Floor.objects.create(
        office=office, name="Floor", slug="floor", level_number=0
    )
    desk = _build_bookable_desk(active_org, office, floor, code="A1")
    desk.is_active = False
    desk.save(update_fields=["is_active"])
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert response.data["bookable_desks_count"] == 0
    assert response.data["has_bookable_desks"] is False


# ─── Tenant isolation ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_summary_ignores_other_org_resources(
    client, member_user, other_org, other_org_user
):
    """Resources in another org must not leak into this org's summary."""
    other_office = Office.objects.create(
        organization=other_org, name="Other Office", slug="other-office"
    )
    other_floor = Floor.objects.create(
        office=other_office, name="Other Floor", slug="other-floor", level_number=0
    )
    _build_bookable_desk(other_org, other_office, other_floor, code="X1")

    client.force_authenticate(user=member_user)
    response = client.get(URL)
    assert response.status_code == 200
    # member_user belongs to active_org only — counts must all be zero.
    assert response.data["offices_count"] == 0
    assert response.data["floors_count"] == 0
    assert response.data["bookable_desks_count"] == 0


# ─── Pending invitations privacy ────────────────────────────────────────────────


@pytest.mark.django_db
def test_manager_sees_pending_invitations_count(client, owner_user, active_org):
    Invitation.objects.create(
        organization=active_org,
        email="invitee@example.com",
        role=MemberRole.MEMBER,
        status=Invitation.Status.PENDING,
    )
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert response.data["pending_invitations_count"] == 1


@pytest.mark.django_db
def test_member_does_not_see_pending_invitations_count(client, member_user, active_org):
    Invitation.objects.create(
        organization=active_org,
        email="invitee@example.com",
        role=MemberRole.MEMBER,
        status=Invitation.Status.PENDING,
    )
    client.force_authenticate(user=member_user)
    response = client.get(URL)
    # Members are not exposed to invitation counts.
    assert response.data["pending_invitations_count"] == 0


@pytest.mark.django_db
def test_summary_does_not_leak_invitation_token(client, owner_user, active_org):
    Invitation.objects.create(
        organization=active_org,
        email="invitee@example.com",
        role=MemberRole.MEMBER,
        status=Invitation.Status.PENDING,
    )
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    assert "token" not in str(response.data)


@pytest.mark.django_db
def test_summary_response_shape(client, owner_user):
    client.force_authenticate(user=owner_user)
    response = client.get(URL)
    expected = {
        "organization",
        "offices_count",
        "floors_count",
        "layout_objects_count",
        "bookable_desks_count",
        "active_members_count",
        "pending_invitations_count",
        "has_offices",
        "has_floors",
        "has_layout_objects",
        "has_bookable_desks",
        "setup_complete",
    }
    assert set(response.data.keys()) == expected
