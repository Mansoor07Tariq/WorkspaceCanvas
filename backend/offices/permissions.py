from __future__ import annotations

from typing import TYPE_CHECKING

from accounts.models import MemberRole, Membership

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser


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
