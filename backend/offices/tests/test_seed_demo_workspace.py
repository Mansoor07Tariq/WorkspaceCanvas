"""
Tests for the seed_demo_workspace management command.

Covers:
- Demo organisation, users, and memberships are created with correct roles.
- Office, floor, layout objects, and desks are created.
- Bookings are created without violating unique constraints.
- Command is fully idempotent (counts do not double on second run).
- Unrelated organisations and users are not touched.
- --reset-demo deletes only demo data; unrelated data is preserved.
- Output contains useful summary information.
"""

import datetime
import io

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from accounts.models import Invitation, MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()

# ─── Helpers ──────────────────────────────────────────────────────────────────

_DEMO_SLUG = "workspacecanvas-demo"
_ADMIN_EMAIL = "admin@workspacecanvas.demo"
_MEMBER_EMAIL = "member@workspacecanvas.demo"
_MEMBER2_EMAIL = "member2@workspacecanvas.demo"
_GUEST_EMAIL = "guest@workspacecanvas.demo"


def run_seed(**kwargs):
    """Call seed_demo_workspace with verbosity=0 by default."""
    kwargs.setdefault("verbosity", 0)
    call_command("seed_demo_workspace", **kwargs)


def run_seed_capture(**kwargs) -> str:
    """Call seed_demo_workspace and return captured stdout."""
    out = io.StringIO()
    kwargs.setdefault("verbosity", 1)
    call_command("seed_demo_workspace", stdout=out, **kwargs)
    return out.getvalue()


# ─── Organisation ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creates_demo_organization():
    run_seed()
    assert Organization.objects.filter(slug=_DEMO_SLUG).exists()


@pytest.mark.django_db
def test_demo_organization_is_active():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    assert org.status == Organization.Status.ACTIVE
    assert org.is_active is True


@pytest.mark.django_db
def test_demo_organization_type_is_company():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    assert org.organization_type == Organization.OrgType.COMPANY


# ─── Users ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creates_admin_user():
    run_seed()
    assert User.objects.filter(email=_ADMIN_EMAIL).exists()


@pytest.mark.django_db
def test_creates_member_user():
    run_seed()
    assert User.objects.filter(email=_MEMBER_EMAIL).exists()


@pytest.mark.django_db
def test_creates_second_member_user():
    run_seed()
    assert User.objects.filter(email=_MEMBER2_EMAIL).exists()


@pytest.mark.django_db
def test_admin_profile_is_completed():
    run_seed()
    user = User.objects.get(email=_ADMIN_EMAIL)
    assert user.is_profile_completed is True
    assert user.full_name == "Alex Admin"
    assert user.email_verified is True


@pytest.mark.django_db
def test_member_profile_is_completed():
    run_seed()
    user = User.objects.get(email=_MEMBER_EMAIL)
    assert user.is_profile_completed is True
    assert user.full_name == "Morgan Member"
    assert user.email_verified is True


@pytest.mark.django_db
def test_demo_users_can_authenticate():
    run_seed()
    admin = User.objects.get(email=_ADMIN_EMAIL)
    assert admin.check_password("DemoPass123!") is True
    member = User.objects.get(email=_MEMBER_EMAIL)
    assert member.check_password("DemoPass123!") is True


# ─── Memberships ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_admin_membership_is_owner():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    admin = User.objects.get(email=_ADMIN_EMAIL)
    ms = Membership.objects.get(user=admin, organization=org)
    assert ms.role == MemberRole.OWNER
    assert ms.status == Membership.Status.ACTIVE


@pytest.mark.django_db
def test_member_membership_is_member():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    member = User.objects.get(email=_MEMBER_EMAIL)
    ms = Membership.objects.get(user=member, organization=org)
    assert ms.role == MemberRole.MEMBER
    assert ms.status == Membership.Status.ACTIVE


@pytest.mark.django_db
def test_three_memberships_created():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    assert Membership.objects.filter(organization=org).count() == 3


# ─── Invitation ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creates_pending_invitation():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    assert Invitation.objects.filter(
        organization=org,
        email=_GUEST_EMAIL,
        status=Invitation.Status.PENDING,
    ).exists()


# ─── Office & Floor ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creates_office():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    assert Office.objects.filter(organization=org, slug="demo-hq").exists()


@pytest.mark.django_db
def test_creates_floor():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org, slug="demo-hq")
    assert Floor.objects.filter(office=office, slug="ground-floor").exists()


@pytest.mark.django_db
def test_floor_level_number_is_zero():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    floor = Floor.objects.get(office=office)
    assert floor.level_number == 0


# ─── Layout objects ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creates_layout_objects():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    floor = Floor.objects.get(office=office)
    count = FloorLayoutObject.objects.filter(floor=floor).count()
    assert count >= 5


@pytest.mark.django_db
def test_desk_layout_objects_are_bookable():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    floor = Floor.objects.get(office=office)
    desk_objects = FloorLayoutObject.objects.filter(
        floor=floor,
        object_type=FloorLayoutObject.ObjectType.DESK,
        is_bookable=True,
    )
    assert desk_objects.count() >= 4


@pytest.mark.django_db
def test_non_desk_layout_objects_not_bookable():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    floor = Floor.objects.get(office=office)
    non_desk_bookable = FloorLayoutObject.objects.filter(
        floor=floor,
        is_bookable=True,
    ).exclude(object_type=FloorLayoutObject.ObjectType.DESK)
    assert non_desk_bookable.count() == 0


# ─── Desks ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creates_desks():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    assert Desk.objects.filter(office=office, is_active=True).count() >= 4


@pytest.mark.django_db
def test_desk_codes_a1_b2_exist():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    for code in ("A1", "A2", "B1", "B2"):
        assert Desk.objects.filter(office=office, code=code, is_active=True).exists(), (
            f"Desk code {code} not found"
        )


@pytest.mark.django_db
def test_desk_c1_is_maintenance():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    desk = Desk.objects.get(office=office, code="C1", is_active=True)
    assert desk.status == Desk.Status.MAINTENANCE


@pytest.mark.django_db
def test_desks_linked_to_layout_objects():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    desks = Desk.objects.filter(office=office, is_active=True)
    for desk in desks:
        assert desk.layout_object_id is not None


# ─── Bookings ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_creates_bookings():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    count = DeskBooking.objects.filter(
        organization=org, status=DeskBooking.Status.ACTIVE
    ).count()
    assert count >= 1


@pytest.mark.django_db
def test_member_has_booking_today():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    member = User.objects.get(email=_MEMBER_EMAIL)
    today = datetime.date.today()
    assert DeskBooking.objects.filter(
        organization=org,
        user=member,
        booking_date=today,
        status=DeskBooking.Status.ACTIVE,
    ).exists()


@pytest.mark.django_db
def test_admin_has_booking_tomorrow():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    admin = User.objects.get(email=_ADMIN_EMAIL)
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    assert DeskBooking.objects.filter(
        organization=org,
        user=admin,
        booking_date=tomorrow,
        status=DeskBooking.Status.ACTIVE,
    ).exists()


@pytest.mark.django_db
def test_no_duplicate_desk_date_bookings():
    run_seed()
    # Each desk+date combination must have at most one active booking.
    org = Organization.objects.get(slug=_DEMO_SLUG)
    bookings = DeskBooking.objects.filter(
        organization=org, status=DeskBooking.Status.ACTIVE
    )
    seen: set[tuple] = set()
    for b in bookings:
        key = (b.desk_id, b.booking_date)
        assert key not in seen, (
            f"Duplicate active booking for desk {b.desk_id} on {b.booking_date}"
        )
        seen.add(key)


@pytest.mark.django_db
def test_no_duplicate_user_org_date_bookings():
    run_seed()
    # Each user+org+date combination must have at most one active booking.
    org = Organization.objects.get(slug=_DEMO_SLUG)
    bookings = DeskBooking.objects.filter(
        organization=org, status=DeskBooking.Status.ACTIVE
    )
    seen: set[tuple] = set()
    for b in bookings:
        key = (b.user_id, b.organization_id, b.booking_date)
        assert key not in seen, (
            f"Duplicate user/org/date booking for user {b.user_id} on {b.booking_date}"
        )
        seen.add(key)


# ─── Idempotency ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_command_is_idempotent_organisations():
    run_seed()
    count_after_first = Organization.objects.filter(slug=_DEMO_SLUG).count()
    run_seed()
    count_after_second = Organization.objects.filter(slug=_DEMO_SLUG).count()
    assert count_after_first == count_after_second == 1


@pytest.mark.django_db
def test_command_is_idempotent_users():
    run_seed()
    first = User.objects.filter(
        email__in=[_ADMIN_EMAIL, _MEMBER_EMAIL, _MEMBER2_EMAIL]
    ).count()
    run_seed()
    second = User.objects.filter(
        email__in=[_ADMIN_EMAIL, _MEMBER_EMAIL, _MEMBER2_EMAIL]
    ).count()
    assert first == second == 3


@pytest.mark.django_db
def test_command_is_idempotent_layout_objects():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    floor = Floor.objects.get(office=office)
    first_count = FloorLayoutObject.objects.filter(floor=floor).count()
    run_seed()
    second_count = FloorLayoutObject.objects.filter(floor=floor).count()
    assert first_count == second_count


@pytest.mark.django_db
def test_command_is_idempotent_desks():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    office = Office.objects.get(organization=org)
    first_count = Desk.objects.filter(office=office, is_active=True).count()
    run_seed()
    second_count = Desk.objects.filter(office=office, is_active=True).count()
    assert first_count == second_count


@pytest.mark.django_db
def test_command_is_idempotent_bookings():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    first_count = DeskBooking.objects.filter(
        organization=org, status=DeskBooking.Status.ACTIVE
    ).count()
    run_seed()
    second_count = DeskBooking.objects.filter(
        organization=org, status=DeskBooking.Status.ACTIVE
    ).count()
    assert first_count == second_count


@pytest.mark.django_db
def test_command_is_idempotent_invitations():
    run_seed()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    first_count = Invitation.objects.filter(
        organization=org, email=_GUEST_EMAIL, status=Invitation.Status.PENDING
    ).count()
    run_seed()
    second_count = Invitation.objects.filter(
        organization=org, email=_GUEST_EMAIL, status=Invitation.Status.PENDING
    ).count()
    assert first_count == second_count == 1


# ─── Isolation — unrelated data ───────────────────────────────────────────────


@pytest.mark.django_db
def test_does_not_delete_unrelated_organization():
    other_org = Organization.objects.create(
        name="Unrelated Corp",
        slug="unrelated-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )
    run_seed()
    assert Organization.objects.filter(pk=other_org.pk).exists()


@pytest.mark.django_db
def test_does_not_delete_unrelated_user():
    other_user = User.objects.create_user(
        username="unrelated@example.com",
        email="unrelated@example.com",
        password="pass123",
    )
    run_seed()
    assert User.objects.filter(pk=other_user.pk).exists()


# ─── --reset-demo ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_reset_demo_deletes_demo_org():
    run_seed()
    assert Organization.objects.filter(slug=_DEMO_SLUG).exists()
    run_seed(reset_demo=True)
    # Re-seeded, so org should exist again — just verify the reset+reseed cycle works.
    assert Organization.objects.filter(slug=_DEMO_SLUG).exists()


@pytest.mark.django_db
def test_reset_demo_preserves_unrelated_org():
    other_org = Organization.objects.create(
        name="Safe Corp",
        slug="safe-corp",
        organization_type=Organization.OrgType.COMPANY,
        status=Organization.Status.ACTIVE,
    )
    run_seed()
    run_seed(reset_demo=True)
    assert Organization.objects.filter(pk=other_org.pk).exists()


@pytest.mark.django_db
def test_reset_demo_preserves_unrelated_user():
    other_user = User.objects.create_user(
        username="safe@example.com",
        email="safe@example.com",
        password="pass123",
    )
    run_seed()
    run_seed(reset_demo=True)
    assert User.objects.filter(pk=other_user.pk).exists()


@pytest.mark.django_db
def test_reset_demo_does_not_double_data():
    run_seed()
    org_count_before = Organization.objects.filter(slug=_DEMO_SLUG).count()
    run_seed(reset_demo=True)
    org_count_after = Organization.objects.filter(slug=_DEMO_SLUG).count()
    assert org_count_before == org_count_after == 1


# ─── Output ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_output_contains_org_name():
    output = run_seed_capture()
    assert "WorkspaceCanvas Demo" in output


@pytest.mark.django_db
def test_output_contains_admin_email():
    output = run_seed_capture()
    assert _ADMIN_EMAIL in output


@pytest.mark.django_db
def test_output_contains_member_email():
    output = run_seed_capture()
    assert _MEMBER_EMAIL in output


@pytest.mark.django_db
def test_output_contains_demo_password():
    output = run_seed_capture()
    assert "DemoPass123!" in output


@pytest.mark.django_db
def test_output_contains_invite_token():
    output = run_seed_capture()
    org = Organization.objects.get(slug=_DEMO_SLUG)
    invite = Invitation.objects.get(organization=org, email=_GUEST_EMAIL)
    assert str(invite.token) in output


@pytest.mark.django_db
def test_output_contains_warning():
    output = run_seed_capture()
    assert "WARNING" in output or "local development" in output.lower()


# ─── Custom options ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_custom_admin_email():
    run_seed(admin_email="custom-admin@workspacecanvas.demo")
    assert User.objects.filter(email="custom-admin@workspacecanvas.demo").exists()


@pytest.mark.django_db
def test_custom_org_name():
    run_seed(org_name="My Custom Demo")
    org = Organization.objects.get(slug=_DEMO_SLUG)
    assert org.name == "My Custom Demo"
