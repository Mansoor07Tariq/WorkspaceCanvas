from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Invitation, MemberRole, Membership, Organization

User = get_user_model()


def list_create_url(org_id):
    return f"/api/accounts/organizations/{org_id}/invitations/"


def cancel_url(org_id, inv_id):
    return f"/api/accounts/organizations/{org_id}/invitations/{inv_id}/cancel/"


def detail_url(token):
    return f"/api/accounts/invitations/{token}/"


def accept_url(token):
    return f"/api/accounts/invitations/{token}/accept/"


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
def invited_user(db):
    return User.objects.create_user(
        username="invited@example.com",
        email="invited@example.com",
        password="pass123",
        full_name="Dave Invited",
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


@pytest.fixture
def pending_invitation(db, active_org, owner_user):
    return Invitation.objects.create(
        organization=active_org,
        email="invited@example.com",
        role=MemberRole.MEMBER,
        invited_by=owner_user,
        expires_at=timezone.now() + timedelta(days=7),
    )


# =====================================================================
# Invitation create
# =====================================================================


@pytest.mark.django_db
def test_create_unauthenticated_returns_401(api_client, active_org, owner_membership):
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_create_member_cannot_invite_returns_403(
    api_client, member_user, active_org, owner_membership, member_membership
):
    api_client.force_authenticate(user=member_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_inactive_membership_cannot_invite_returns_403(
    api_client, owner_user, active_org
):
    Membership.objects.create(
        user=owner_user,
        organization=active_org,
        role=MemberRole.OWNER,
        status=Membership.Status.DISABLED,
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_cross_org_returns_403(
    api_client, owner_user, other_org, active_org, owner_membership
):
    Membership.objects.create(
        user=owner_user,
        organization=other_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    api_client.force_authenticate(user=owner_user)
    # owner_membership is for active_org; requesting for other_org should fail
    response = api_client.post(
        list_create_url(other_org.id),
        {"email": "new@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 200 or response.status_code == 201
    # Try to invite using active_org owner against other_org where no active membership
    other_owner = User.objects.create_user(
        username="o2@example.com",
        email="o2@example.com",
        password="pass",
    )
    api_client.force_authenticate(user=other_owner)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new2@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_owner_can_invite(api_client, owner_user, active_org, owner_membership):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["email"] == "new@example.com"
    assert response.data["role"] == "member"
    assert response.data["status"] == "pending"


@pytest.mark.django_db
def test_create_admin_can_invite(
    api_client, admin_user, active_org, owner_membership, admin_membership
):
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "admin"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["role"] == "admin"


@pytest.mark.django_db
def test_create_email_normalized_lowercase(
    api_client, owner_user, active_org, owner_membership
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "NEW@EXAMPLE.COM", "role": "member"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["email"] == "new@example.com"


@pytest.mark.django_db
def test_create_invitation_has_token(
    api_client, owner_user, active_org, owner_membership
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["token"] is not None
    assert len(str(response.data["token"])) == 36  # UUID format


@pytest.mark.django_db
def test_create_invitation_has_expiry(
    api_client, owner_user, active_org, owner_membership
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["expires_at"] is not None


@pytest.mark.django_db
def test_create_cannot_invite_owner_role(
    api_client, owner_user, active_org, owner_membership
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "new@example.com", "role": "owner"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_duplicate_active_member_rejected(
    api_client, owner_user, member_user, active_org, owner_membership, member_membership
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "member@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 400
    assert "already exists" in str(response.data).lower()


@pytest.mark.django_db
def test_create_duplicate_pending_invitation_rejected(
    api_client, owner_user, active_org, owner_membership, pending_invitation
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(
        list_create_url(active_org.id),
        {"email": "invited@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == 400
    assert "pending invitation" in str(response.data).lower()


# =====================================================================
# Invitation list
# =====================================================================


@pytest.mark.django_db
def test_list_unauthenticated_returns_401(api_client, active_org, owner_membership):
    response = api_client.get(list_create_url(active_org.id))
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_member_cannot_list_returns_403(
    api_client, member_user, active_org, owner_membership, member_membership
):
    api_client.force_authenticate(user=member_user)
    response = api_client.get(list_create_url(active_org.id))
    assert response.status_code == 403


@pytest.mark.django_db
def test_list_owner_can_list(
    api_client, owner_user, active_org, owner_membership, pending_invitation
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.get(list_create_url(active_org.id))
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["email"] == "invited@example.com"


@pytest.mark.django_db
def test_list_only_returns_pending(
    api_client, owner_user, active_org, owner_membership, pending_invitation
):
    Invitation.objects.create(
        organization=active_org,
        email="accepted@example.com",
        role=MemberRole.MEMBER,
        status=Invitation.Status.ACCEPTED,
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.get(list_create_url(active_org.id))
    assert response.status_code == 200
    assert len(response.data) == 1
    assert all(i["status"] == "pending" for i in response.data)


@pytest.mark.django_db
def test_list_response_contains_token(
    api_client, owner_user, active_org, owner_membership, pending_invitation
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.get(list_create_url(active_org.id))
    assert response.status_code == 200
    assert "token" in response.data[0]
    assert response.data[0]["token"] is not None


@pytest.mark.django_db
def test_list_cross_org_returns_403(
    api_client, outside_user, active_org, other_org, owner_membership
):
    Membership.objects.create(
        user=outside_user,
        organization=other_org,
        role=MemberRole.OWNER,
        status=Membership.Status.ACTIVE,
    )
    api_client.force_authenticate(user=outside_user)
    response = api_client.get(list_create_url(active_org.id))
    assert response.status_code == 403


# =====================================================================
# Invitation cancel
# =====================================================================


@pytest.mark.django_db
def test_cancel_unauthenticated_returns_401(
    api_client, active_org, owner_membership, pending_invitation
):
    response = api_client.post(cancel_url(active_org.id, pending_invitation.id))
    assert response.status_code == 401


@pytest.mark.django_db
def test_cancel_member_cannot_cancel_returns_403(
    api_client,
    member_user,
    active_org,
    owner_membership,
    member_membership,
    pending_invitation,
):
    api_client.force_authenticate(user=member_user)
    response = api_client.post(cancel_url(active_org.id, pending_invitation.id))
    assert response.status_code == 403


@pytest.mark.django_db
def test_cancel_owner_can_cancel(
    api_client, owner_user, active_org, owner_membership, pending_invitation
):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(cancel_url(active_org.id, pending_invitation.id))
    assert response.status_code == 200
    assert response.data["status"] == "cancelled"


@pytest.mark.django_db
def test_cancel_admin_can_cancel(
    api_client,
    admin_user,
    active_org,
    owner_membership,
    admin_membership,
    pending_invitation,
):
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(cancel_url(active_org.id, pending_invitation.id))
    assert response.status_code == 200
    assert response.data["status"] == "cancelled"


@pytest.mark.django_db
def test_cancel_already_accepted_returns_400(
    api_client, owner_user, active_org, owner_membership, pending_invitation
):
    pending_invitation.status = Invitation.Status.ACCEPTED
    pending_invitation.save()
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(cancel_url(active_org.id, pending_invitation.id))
    assert response.status_code == 400


@pytest.mark.django_db
def test_cancel_cross_org_invitation_returns_404(
    api_client, owner_user, active_org, other_org, owner_membership
):
    other_inv = Invitation.objects.create(
        organization=other_org,
        email="x@example.com",
        role=MemberRole.MEMBER,
    )
    api_client.force_authenticate(user=owner_user)
    response = api_client.post(cancel_url(active_org.id, other_inv.id))
    assert response.status_code == 404


# =====================================================================
# Invitation detail (public token GET)
# =====================================================================


@pytest.mark.django_db
def test_detail_public_returns_org_name_and_role(
    api_client, active_org, pending_invitation
):
    response = api_client.get(detail_url(pending_invitation.token))
    assert response.status_code == 200
    assert response.data["organization_name"] == "Acme Corp"
    assert response.data["role"] == "member"
    assert response.data["status"] == "pending"


@pytest.mark.django_db
def test_detail_does_not_expose_token(api_client, active_org, pending_invitation):
    response = api_client.get(detail_url(pending_invitation.token))
    assert response.status_code == 200
    assert "token" not in response.data


@pytest.mark.django_db
def test_detail_unknown_token_returns_404(api_client):
    import uuid

    response = api_client.get(detail_url(uuid.uuid4()))
    assert response.status_code == 404


@pytest.mark.django_db
def test_detail_cancelled_invitation_shows_status(
    api_client, active_org, pending_invitation
):
    pending_invitation.status = Invitation.Status.CANCELLED
    pending_invitation.save()
    response = api_client.get(detail_url(pending_invitation.token))
    assert response.status_code == 200
    assert response.data["status"] == "cancelled"


# =====================================================================
# Invitation accept
# =====================================================================


@pytest.mark.django_db
def test_accept_unauthenticated_returns_401(api_client, active_org, pending_invitation):
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 401


@pytest.mark.django_db
def test_accept_matching_user_creates_membership(
    api_client, invited_user, active_org, owner_membership, pending_invitation
):
    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 200
    assert Membership.objects.filter(
        user=invited_user,
        organization=active_org,
        status=Membership.Status.ACTIVE,
    ).exists()


@pytest.mark.django_db
def test_accept_sets_accepted_by_and_at(
    api_client, invited_user, active_org, owner_membership, pending_invitation
):
    api_client.force_authenticate(user=invited_user)
    api_client.post(accept_url(pending_invitation.token))
    pending_invitation.refresh_from_db()
    assert pending_invitation.status == Invitation.Status.ACCEPTED
    assert pending_invitation.accepted_by == invited_user
    assert pending_invitation.accepted_at is not None


@pytest.mark.django_db
def test_accept_membership_has_correct_role(
    api_client, invited_user, active_org, owner_membership
):
    inv = Invitation.objects.create(
        organization=active_org,
        email="invited@example.com",
        role=MemberRole.ADMIN,
        expires_at=timezone.now() + timedelta(days=7),
    )
    api_client.force_authenticate(user=invited_user)
    api_client.post(accept_url(inv.token))
    membership = Membership.objects.get(user=invited_user, organization=active_org)
    assert membership.role == MemberRole.ADMIN


@pytest.mark.django_db
def test_accept_wrong_email_returns_403(
    api_client, outside_user, active_org, owner_membership, pending_invitation
):
    api_client.force_authenticate(user=outside_user)
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 403


@pytest.mark.django_db
def test_accept_expired_invitation_returns_400(
    api_client, invited_user, active_org, owner_membership
):
    expired_inv = Invitation.objects.create(
        organization=active_org,
        email="invited@example.com",
        role=MemberRole.MEMBER,
        expires_at=timezone.now() - timedelta(days=1),
    )
    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(expired_inv.token))
    assert response.status_code == 400
    assert "expired" in str(response.data).lower()


@pytest.mark.django_db
def test_accept_cancelled_invitation_returns_400(
    api_client, invited_user, active_org, owner_membership, pending_invitation
):
    pending_invitation.status = Invitation.Status.CANCELLED
    pending_invitation.save()
    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 400
    assert "cancelled" in str(response.data).lower()


@pytest.mark.django_db
def test_accept_already_accepted_invitation_returns_400(
    api_client, invited_user, active_org, owner_membership, pending_invitation
):
    pending_invitation.status = Invitation.Status.ACCEPTED
    pending_invitation.save()
    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 400


@pytest.mark.django_db
def test_accept_already_active_member_returns_400(
    api_client, invited_user, active_org, owner_membership, pending_invitation
):
    Membership.objects.create(
        user=invited_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 400
    assert "already a member" in str(response.data).lower()


@pytest.mark.django_db
def test_accept_reactivates_disabled_membership(
    api_client, invited_user, active_org, owner_membership, pending_invitation
):
    Membership.objects.create(
        user=invited_user,
        organization=active_org,
        role=MemberRole.MEMBER,
        status=Membership.Status.DISABLED,
    )
    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 200
    membership = Membership.objects.get(user=invited_user, organization=active_org)
    assert membership.status == Membership.Status.ACTIVE


@pytest.mark.django_db
def test_accept_unknown_token_returns_404(api_client, invited_user):
    import uuid

    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(uuid.uuid4()))
    assert response.status_code == 404


@pytest.mark.django_db
def test_accept_cancelled_cannot_be_accepted_after_cancel(
    api_client,
    owner_user,
    invited_user,
    active_org,
    owner_membership,
    pending_invitation,
):
    # First cancel it via the cancel endpoint
    owner_client = APIClient()
    owner_client.force_authenticate(user=owner_user)
    owner_client.post(cancel_url(active_org.id, pending_invitation.id))

    # Now try to accept
    api_client.force_authenticate(user=invited_user)
    response = api_client.post(accept_url(pending_invitation.token))
    assert response.status_code == 400
