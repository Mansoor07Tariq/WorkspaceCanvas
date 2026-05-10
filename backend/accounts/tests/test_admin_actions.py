import pytest
from django.contrib.auth import get_user_model

from accounts.models import Membership, Organization

User = get_user_model()


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        username="owner@example.com",
        email="owner@example.com",
        password="pass123",
    )


@pytest.fixture
def pending_org(db):
    return Organization.objects.create(
        name="Pending Corp",
        slug="pending-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.PENDING_APPROVAL,
    )


@pytest.fixture
def pending_membership(db, owner, pending_org):
    return Membership.objects.create(
        user=owner,
        organization=pending_org,
        role=Membership.Role.OWNER,
        status=Membership.Status.PENDING,
    )


@pytest.mark.django_db
def test_approving_organization_activates_owner_membership(
    pending_org, pending_membership
):
    org_ids = [pending_org.pk]
    Organization.objects.filter(pk__in=org_ids).update(
        status=Organization.Status.ACTIVE,
        is_active=True,
    )
    Membership.objects.filter(
        organization_id__in=org_ids,
        role=Membership.Role.OWNER,
    ).update(status=Membership.Status.ACTIVE)

    pending_org.refresh_from_db()
    pending_membership.refresh_from_db()
    assert pending_org.status == Organization.Status.ACTIVE
    assert pending_membership.status == Membership.Status.ACTIVE


@pytest.mark.django_db
def test_rejecting_organization_disables_owner_membership(
    pending_org, pending_membership
):
    org_ids = [pending_org.pk]
    Organization.objects.filter(pk__in=org_ids).update(
        status=Organization.Status.REJECTED,
    )
    Membership.objects.filter(
        organization_id__in=org_ids,
        role=Membership.Role.OWNER,
    ).update(status=Membership.Status.DISABLED)

    pending_org.refresh_from_db()
    pending_membership.refresh_from_db()
    assert pending_org.status == Organization.Status.REJECTED
    assert pending_membership.status == Membership.Status.DISABLED


@pytest.mark.django_db
def test_suspending_organization_disables_all_memberships(owner, db):
    org = Organization.objects.create(
        name="Active Corp",
        slug="active-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
        is_active=True,
    )
    membership = Membership.objects.create(
        user=owner,
        organization=org,
        role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )

    org_ids = [org.pk]
    Organization.objects.filter(pk__in=org_ids).update(
        status=Organization.Status.SUSPENDED,
        is_active=False,
    )
    Membership.objects.filter(organization_id__in=org_ids).update(
        status=Membership.Status.DISABLED,
    )

    org.refresh_from_db()
    membership.refresh_from_db()
    assert org.status == Organization.Status.SUSPENDED
    assert not org.is_active
    assert membership.status == Membership.Status.DISABLED
