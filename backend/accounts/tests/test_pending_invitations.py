from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Invitation, MemberRole, Membership, Organization

User = get_user_model()

PENDING_URL = "/api/accounts/invitations/pending/"


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
def draft_org(db):
    return Organization.objects.create(
        name="Draft Corp",
        slug="draft-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.DRAFT,
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
def invited_user(db):
    return User.objects.create_user(
        username="invited@example.com",
        email="invited@example.com",
        password="pass123",
        full_name="Dave Invited",
        is_profile_completed=True,
    )


def make_invitation(org, owner, email="invited@example.com", **kwargs):
    defaults = {
        "organization": org,
        "email": email,
        "role": MemberRole.MEMBER,
        "invited_by": owner,
        "status": Invitation.Status.PENDING,
        "expires_at": timezone.now() + timedelta(days=7),
    }
    defaults.update(kwargs)
    return Invitation.objects.create(**defaults)


# =====================================================================
# Auth / scoping
# =====================================================================


@pytest.mark.django_db
def test_pending_unauthenticated_returns_401(api_client):
    response = api_client.get(PENDING_URL)
    assert response.status_code == 401


@pytest.mark.django_db
def test_pending_returns_invitation_for_matching_email(
    api_client, active_org, owner_user, invited_user
):
    inv = make_invitation(active_org, owner_user)
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert len(response.data) == 1
    payload = response.data[0]
    assert payload["token"] == str(inv.token)
    assert payload["role"] == MemberRole.MEMBER
    assert payload["organization_name"] == "Acme Corp"
    assert payload["organization_slug"] == "acme-corp"
    assert payload["invited_by_email"] == "owner@example.com"


@pytest.mark.django_db
def test_pending_email_match_is_case_insensitive(
    api_client, active_org, owner_user, invited_user
):
    make_invitation(active_org, owner_user, email="INVITED@example.com")
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_pending_does_not_leak_other_users_invitations(
    api_client, active_org, owner_user, invited_user
):
    # An invitation addressed to someone else must never appear.
    make_invitation(active_org, owner_user, email="someone-else@example.com")
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert response.data == []


# =====================================================================
# Only actionable invitations are returned
# =====================================================================


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        Invitation.Status.ACCEPTED,
        Invitation.Status.CANCELLED,
        Invitation.Status.EXPIRED,
    ],
)
def test_pending_excludes_non_pending_statuses(
    api_client, active_org, owner_user, invited_user, status
):
    make_invitation(active_org, owner_user, status=status)
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_pending_excludes_expired_invitations(
    api_client, active_org, owner_user, invited_user
):
    make_invitation(
        active_org, owner_user, expires_at=timezone.now() - timedelta(days=1)
    )
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_pending_includes_invitations_without_expiry(
    api_client, active_org, owner_user, invited_user
):
    make_invitation(active_org, owner_user, expires_at=None)
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_pending_excludes_inactive_organization(
    api_client, draft_org, owner_user, invited_user
):
    make_invitation(draft_org, owner_user)
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_pending_excludes_org_user_already_actively_belongs_to(
    api_client, active_org, owner_user, invited_user
):
    # User is already an active member but a stray pending invite exists; it
    # would only error as "already a member", so it must be hidden.
    Membership.objects.create(
        user=invited_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    make_invitation(active_org, owner_user)
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_pending_includes_org_with_disabled_membership(
    api_client, active_org, owner_user, invited_user
):
    # A disabled membership can be reactivated by accepting, so the invite stays.
    Membership.objects.create(
        user=invited_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    make_invitation(active_org, owner_user)
    api_client.force_authenticate(user=invited_user)

    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_pending_lists_multiple_invitations_newest_first(
    api_client, active_org, other_org, owner_user, invited_user
):
    older = make_invitation(active_org, owner_user)
    older.created_at = timezone.now() - timedelta(hours=2)
    older.save(update_fields=["created_at"])
    newer = make_invitation(other_org, owner_user)

    api_client.force_authenticate(user=invited_user)
    response = api_client.get(PENDING_URL)

    assert response.status_code == 200
    assert [row["organization_slug"] for row in response.data] == [
        newer.organization.slug,
        older.organization.slug,
    ]
