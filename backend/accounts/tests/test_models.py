import pytest
from django.contrib.auth import get_user_model

from accounts.models import Membership, Organization

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="pass123",
    )


@pytest.fixture
def draft_org(db):
    return Organization.objects.create(
        name="Draft Corp",
        slug="draft-corp",
        organization_type=Organization.OrgType.COMPANY,
    )


@pytest.fixture
def active_org(db):
    return Organization.objects.create(
        name="Active Corp",
        slug="active-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )


@pytest.mark.django_db
def test_default_organization_status_is_draft(draft_org):
    assert draft_org.status == Organization.Status.DRAFT


@pytest.mark.django_db
def test_is_approved_false_for_draft(draft_org):
    assert not draft_org.is_approved


@pytest.mark.django_db
def test_is_approved_true_for_active(active_org):
    assert active_org.is_approved


@pytest.mark.django_db
def test_is_pending_approval_true():
    org = Organization.objects.create(
        name="Pending Corp",
        slug="pending-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.PENDING_APPROVAL,
    )
    assert org.is_pending_approval


@pytest.mark.django_db
def test_default_membership_status_is_pending(user, active_org):
    membership = Membership.objects.create(user=user, organization=active_org)
    assert membership.status == Membership.Status.PENDING


@pytest.mark.django_db
def test_has_active_access_false_when_org_not_active(user, draft_org):
    membership = Membership.objects.create(
        user=user,
        organization=draft_org,
        status=Membership.Status.ACTIVE,
    )
    assert not membership.has_active_access


@pytest.mark.django_db
def test_has_active_access_false_when_membership_pending(user, active_org):
    membership = Membership.objects.create(
        user=user,
        organization=active_org,
        status=Membership.Status.PENDING,
    )
    assert not membership.has_active_access


@pytest.mark.django_db
def test_has_active_access_true_when_both_active(user, active_org):
    membership = Membership.objects.create(
        user=user,
        organization=active_org,
        status=Membership.Status.ACTIVE,
    )
    assert membership.has_active_access
