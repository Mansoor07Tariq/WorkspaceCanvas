from __future__ import annotations

from typing import TYPE_CHECKING

from accounts.models import MemberRole, Membership

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser

    from .models import Office


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
