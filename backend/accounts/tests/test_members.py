import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import MemberRole, Membership, Organization

User = get_user_model()


def members_url(org_id):
    return f"/api/accounts/organizations/{org_id}/members/"


# --- Fixtures ---


@pytest.fixture
def api_client():
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
def owner_user(db):
    return User.objects.create_user(
        username="owner@example.com",
        email="owner@example.com",
        password="pass123",
        full_name="Alice Owner",
        is_profile_completed=True,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin@example.com",
        email="admin@example.com",
        password="pass123",
        full_name="Bob Admin",
        is_profile_completed=True,
    )


@pytest.fixture
def member_user(db):
    return User.objects.create_user(
        username="member@example.com",
        email="member@example.com",
        password="pass123",
        full_name="Carol Member",
        is_profile_completed=True,
    )


@pytest.fixture
def outside_user(db):
    return User.objects.create_user(
        username="outside@example.com",
        email="outside@example.com",
        password="pass123",
    )


@pytest.fixture
def owner_membership(db, owner_user, active_org):
    return Membership.objects.create(
        user=owner_user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def admin_membership(db, admin_user, active_org):
    return Membership.objects.create(
        user=admin_user,
        organization=active_org,
        role=MemberRole.ADMIN,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def member_membership(db, member_user, active_org):
    return Membership.objects.create(
        user=member_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )


# --- Auth / Access ---


@pytest.mark.django_db
def test_unauthenticated_returns_401(api_client, active_org, owner_membership):
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 401


@pytest.mark.django_db
def test_non_member_returns_403(api_client, outside_user, active_org, owner_membership):
    api_client.force_authenticate(user=outside_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 403


@pytest.mark.django_db
def test_cross_org_returns_403(
    api_client, outside_user, active_org, other_org, owner_membership
):
    other_membership = Membership.objects.create(
        user=outside_user,
        organization=other_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    api_client.force_authenticate(user=outside_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 403
    other_membership.delete()


@pytest.mark.django_db
def test_inactive_membership_returns_403(
    api_client, member_user, active_org, owner_membership
):
    Membership.objects.create(
        user=member_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    api_client.force_authenticate(user=member_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 403


@pytest.mark.django_db
def test_unknown_org_returns_404(api_client, owner_user, active_org, owner_membership):
    api_client.force_authenticate(user=owner_user)
    response = api_client.get(members_url(99999))
    assert response.status_code == 404


# --- Success paths ---


@pytest.mark.django_db
def test_owner_can_list_members(
    api_client, owner_user, active_org, owner_membership, member_membership
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 200
    emails = [m["email"] for m in response.data]
    assert "owner@example.com" in emails
    assert "member@example.com" in emails


@pytest.mark.django_db
def test_admin_can_list_members(
    api_client, admin_user, active_org, owner_membership, admin_membership
):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_member_can_list_members(
    api_client, member_user, active_org, owner_membership, member_membership
):
    api_client.force_authenticate(user=member_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_response_shape(api_client, owner_user, active_org, owner_membership):
    api_client.force_authenticate(user=owner_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 200
    member = response.data[0]
    expected_fields = [
        "id",
        "user_id",
        "email",
        "full_name",
        "role",
        "status",
        "created_at",
    ]
    for field in expected_fields:
        assert field in member


@pytest.mark.django_db
def test_disabled_members_not_in_list(
    api_client, owner_user, member_user, active_org, owner_membership
):
    Membership.objects.create(
        user=member_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.get(members_url(active_org.id))
    assert response.status_code == 200
    emails = [m["email"] for m in response.data]
    assert "member@example.com" not in emails
