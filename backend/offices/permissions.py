from __future__ import annotations

from typing import TYPE_CHECKING

from accounts.models import MemberRole, Membership

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser

    from .models import Floor, Office


def get_first_active_membership(user: AbstractBaseUser) -> Membership | None:
    return (
        Membership.objects.select_related("organization")
        .filter(
            user=user,
            status=Membership.Status.ACTIVE,
            organization__status="active",
        )
        .first()
    )


def get_active_membership_for_org(
    user: AbstractBaseUser, organization_id: int
) -> Membership | None:
    """Return the user's ACTIVE membership for a specific organization, or None.

    Used by PR 055 multi-org support: an explicit ``?organization=<id>`` is only
    honoured when the caller actually has an active membership in that org, so it
    can never be used to read another org's data.
    """
    return (
        Membership.objects.select_related("organization")
        .filter(
            user=user,
            organization_id=organization_id,
            status=Membership.Status.ACTIVE,
            organization__status="active",
        )
        .first()
    )


def resolve_membership(
    user: AbstractBaseUser, organization_id: int | None
) -> Membership | None:
    """Resolve the membership to act under.

    With an explicit ``organization_id`` (selected-org switcher), return the
    user's active membership for that org (or None if they are not an active
    member). Without it, fall back to the first active membership — unchanged
    single-org behaviour.
    """
    if organization_id is not None:
        return get_active_membership_for_org(user, organization_id)
    return get_first_active_membership(user)


def user_can_manage_offices(membership: Membership) -> bool:
    return membership.role in (MemberRole.OWNER, MemberRole.ADMIN)


def get_office_for_membership(membership: Membership, office_id: int) -> Office | None:
    from .models import Office

    try:
        return Office.objects.get(
            pk=office_id,
            organization=membership.organization,
            is_active=True,
        )
    except Office.DoesNotExist:
        return None


def get_office_for_user(
    user: AbstractBaseUser, office_id: int
) -> tuple[Office | None, Membership | None]:
    """Resolve an active office that belongs to ANY of the user's active orgs,
    plus the membership for that office's org (for role checks).

    Returns ``(None, None)`` when the office does not exist or the user has no
    active membership in its organization — callers treat that as 404 (no
    cross-org existence leak). This is what makes nested office/floor/desk/
    booking endpoints work for the selected organization under PR 055
    multi-org, instead of being pinned to the first active membership's org.
    """
    from .models import Office

    try:
        office = Office.objects.select_related("organization").get(
            pk=office_id, is_active=True
        )
    except Office.DoesNotExist:
        return None, None
    membership = get_active_membership_for_org(user, office.organization_id)
    if membership is None:
        return None, None
    return office, membership


def get_floor_for_office(office: Office, floor_id: int) -> Floor | None:
    from .models import Floor

    try:
        return Floor.objects.get(pk=floor_id, office=office, is_active=True)
    except Floor.DoesNotExist:
        return None
