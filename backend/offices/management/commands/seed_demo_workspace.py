"""
Management command: seed_demo_workspace

Seeds a complete demo workspace for local development and MVP demonstration.
Safe to run multiple times — fully idempotent.

Usage:
    python manage.py seed_demo_workspace
    python manage.py seed_demo_workspace --reset-demo

WARNING: This command is intended for LOCAL / DEMO environments only.
         The default demo password must never be used in production.
"""

from __future__ import annotations

import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Invitation, MemberRole, Membership, Organization
from offices.models import Desk, DeskBooking, Floor, FloorLayoutObject, Office

User = get_user_model()

_DEMO_ORG_SLUG = "workspacecanvas-demo"
_DEFAULT_PASSWORD = "DemoPass123!"


class Command(BaseCommand):
    help = (
        "Seed a complete demo workspace for local development and MVP demonstration. "
        "Safe to run multiple times — idempotent. "
        "Use --reset-demo to delete and re-create demo data only."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--admin-email",
            default="admin@workspacecanvas.demo",
            help="Email for the demo admin user.",
        )
        parser.add_argument(
            "--member-email",
            default="member@workspacecanvas.demo",
            help="Email for the demo member user.",
        )
        parser.add_argument(
            "--password",
            default=_DEFAULT_PASSWORD,
            help="Password for demo users. LOCAL/DEMO ONLY — never use in production.",
        )
        parser.add_argument(
            "--org-name",
            default="WorkspaceCanvas Demo",
            help="Name for the demo organisation.",
        )
        parser.add_argument(
            "--email-domain",
            default="workspacecanvas.demo",
            help="Allowed email domain for the demo organisation.",
        )
        parser.add_argument(
            "--reset-demo",
            action="store_true",
            help=(
                "Delete existing demo data before re-seeding. "
                "Only deletes data belonging to the demo organisation and users whose "
                "email ends with the demo domain. Never deletes unrelated data."
            ),
        )

    def handle(self, *args, **options):
        admin_email: str = options["admin_email"]
        member_email: str = options["member_email"]
        password: str = options["password"]
        org_name: str = options["org_name"]
        email_domain: str = options["email_domain"]
        reset_demo: bool = options["reset_demo"]
        verbosity: int = options["verbosity"]

        def log(msg: str) -> None:
            if verbosity >= 1:
                self.stdout.write(msg)

        def ok(label: str, created: bool) -> None:
            if verbosity >= 1:
                tag = self.style.SUCCESS("created") if created else "reused  "
                self.stdout.write(f"  [{tag}] {label}")

        if reset_demo:
            self._reset_demo(email_domain, log)

        log(self.style.MIGRATE_HEADING("\n=== Seeding demo workspace ===\n"))

        # ── Users ────────────────────────────────────────────────────────────
        log("Users:")

        admin_user = self._get_or_create_user(
            email=admin_email,
            username=admin_email,
            full_name="Alex Admin",
            password=password,
        )
        ok(f"admin  — {admin_email}", admin_user[1])
        admin_user = admin_user[0]

        member_user = self._get_or_create_user(
            email=member_email,
            username=member_email,
            full_name="Morgan Member",
            password=password,
        )
        ok(f"member — {member_email}", member_user[1])
        member_user = member_user[0]

        member2_email = f"member2@{email_domain}"
        member2_user = self._get_or_create_user(
            email=member2_email,
            username=member2_email,
            full_name="Sam Second",
            password=password,
        )
        ok(f"member — {member2_email}", member2_user[1])
        member2_user = member2_user[0]

        # ── Organisation ─────────────────────────────────────────────────────
        log("\nOrganisation:")

        org, created = Organization.objects.get_or_create(
            slug=_DEMO_ORG_SLUG,
            defaults={
                "name": org_name,
                "organization_type": Organization.OrgType.COMPANY,
                "allowed_email_domain": email_domain,
                "status": Organization.Status.ACTIVE,
                "is_active": True,
            },
        )
        ok(org_name, created)

        # ── Memberships ───────────────────────────────────────────────────────
        log("\nMemberships:")

        _, created = Membership.objects.get_or_create(
            user=admin_user,
            organization=org,
            defaults={
                "role": MemberRole.OWNER,
                "status": Membership.Status.ACTIVE,
            },
        )
        ok(f"{admin_email} (owner)", created)

        _, created = Membership.objects.get_or_create(
            user=member_user,
            organization=org,
            defaults={
                "role": MemberRole.MEMBER,
                "status": Membership.Status.ACTIVE,
            },
        )
        ok(f"{member_email} (member)", created)

        _, created = Membership.objects.get_or_create(
            user=member2_user,
            organization=org,
            defaults={
                "role": MemberRole.MEMBER,
                "status": Membership.Status.ACTIVE,
            },
        )
        ok(f"{member2_email} (member)", created)

        # ── Pending invitation ────────────────────────────────────────────────
        log("\nPending invitation:")

        guest_email = f"guest@{email_domain}"
        invite, created = Invitation.objects.get_or_create(
            organization=org,
            email=guest_email,
            status=Invitation.Status.PENDING,
            defaults={
                "role": MemberRole.MEMBER,
                "invited_by": admin_user,
                "expires_at": timezone.now() + datetime.timedelta(days=7),
            },
        )
        ok(f"pending invite for {guest_email} (token: {invite.token})", created)

        # ── Office ────────────────────────────────────────────────────────────
        log("\nOffice:")

        office, created = Office.objects.get_or_create(
            organization=org,
            slug="demo-hq",
            defaults={
                "name": "Demo HQ",
                "address_line_1": "1 Canvas Street",
                "city": "Dublin",
                "county_or_state": "County Dublin",
                "country": "Ireland",
                "timezone": "Europe/Dublin",
                "is_active": True,
            },
        )
        ok("Demo HQ", created)

        # ── Floor ─────────────────────────────────────────────────────────────
        log("\nFloor:")

        floor, created = Floor.objects.get_or_create(
            office=office,
            slug="ground-floor",
            defaults={
                "name": "Ground Floor",
                "level_number": 0,
                "is_active": True,
            },
        )
        ok("Ground Floor (level 0)", created)

        # ── Layout objects ────────────────────────────────────────────────────
        log("\nLayout objects:")

        layout_specs = [
            # Workstations — desk-capable, will become Desk resources
            {
                "object_type": FloorLayoutObject.ObjectType.DESK,
                "label": "Desk A1",
                "x": 80,
                "y": 80,
                "width": 80,
                "height": 60,
                "is_bookable": True,
            },
            {
                "object_type": FloorLayoutObject.ObjectType.DESK,
                "label": "Desk A2",
                "x": 200,
                "y": 80,
                "width": 80,
                "height": 60,
                "is_bookable": True,
            },
            {
                "object_type": FloorLayoutObject.ObjectType.DESK,
                "label": "Desk B1",
                "x": 80,
                "y": 200,
                "width": 80,
                "height": 60,
                "is_bookable": True,
            },
            {
                "object_type": FloorLayoutObject.ObjectType.DESK,
                "label": "Desk B2",
                "x": 200,
                "y": 200,
                "width": 80,
                "height": 60,
                "is_bookable": True,
            },
            {
                "object_type": FloorLayoutObject.ObjectType.DESK,
                "label": "Desk C1",
                "x": 320,
                "y": 80,
                "width": 80,
                "height": 60,
                "is_bookable": True,
            },
            # Tables
            {
                "object_type": FloorLayoutObject.ObjectType.BOARDROOM_TABLE,
                "label": "Boardroom Table",
                "x": 480,
                "y": 80,
                "width": 220,
                "height": 100,
                "is_bookable": False,
            },
            {
                "object_type": FloorLayoutObject.ObjectType.LUNCH_TABLE,
                "label": "Lunch Table",
                "x": 720,
                "y": 200,
                "width": 160,
                "height": 80,
                "is_bookable": False,
            },
            # Rooms / pods
            {
                "object_type": FloorLayoutObject.ObjectType.MEETING_POD,
                "label": "Meeting Pod",
                "x": 400,
                "y": 280,
                "width": 120,
                "height": 120,
                "is_bookable": False,
            },
            # Seating
            {
                "object_type": FloorLayoutObject.ObjectType.SOFA,
                "label": "Lounge Sofa",
                "x": 600,
                "y": 320,
                "width": 160,
                "height": 70,
                "is_bookable": False,
            },
            # Structure
            {
                "object_type": FloorLayoutObject.ObjectType.DOOR,
                "label": "Main Door",
                "x": 40,
                "y": 380,
                "width": 50,
                "height": 12,
                "is_bookable": False,
            },
            {
                "object_type": FloorLayoutObject.ObjectType.WINDOW,
                "label": "North Window",
                "x": 120,
                "y": 380,
                "width": 200,
                "height": 12,
                "is_bookable": False,
            },
            # Facilities
            {
                "object_type": FloorLayoutObject.ObjectType.WHITEBOARD,
                "label": "Whiteboard",
                "x": 480,
                "y": 40,
                "width": 120,
                "height": 70,
                "is_bookable": False,
            },
            # Decor
            {
                "object_type": FloorLayoutObject.ObjectType.PLANT,
                "label": "Office Plant",
                "x": 840,
                "y": 80,
                "width": 40,
                "height": 40,
                "is_bookable": False,
            },
        ]

        layout_objs: dict[str, FloorLayoutObject] = {}
        for spec in layout_specs:
            label = spec["label"]
            obj, created = FloorLayoutObject.objects.get_or_create(
                floor=floor,
                label=label,
                defaults={
                    "object_type": spec["object_type"],
                    "x": spec["x"],
                    "y": spec["y"],
                    "width": spec["width"],
                    "height": spec["height"],
                    "rotation": 0,
                    "is_bookable": spec["is_bookable"],
                    "is_active": True,
                },
            )
            layout_objs[label] = obj
            ok(f"{spec['object_type']:20s} '{label}'", created)

        # ── Desks ─────────────────────────────────────────────────────────────
        log("\nDesks:")

        desk_specs = [
            {
                "label": "Desk A1",
                "code": "A1",
                "name": "Desk A1",
                "status": Desk.Status.AVAILABLE,
                "amenities": {"monitor": True, "standing": False},
                "notes": "",
            },
            {
                "label": "Desk A2",
                "code": "A2",
                "name": "Desk A2",
                "status": Desk.Status.AVAILABLE,
                "amenities": {"monitor": True, "standing": False},
                "notes": "",
            },
            {
                "label": "Desk B1",
                "code": "B1",
                "name": "Desk B1",
                "status": Desk.Status.AVAILABLE,
                "amenities": {"monitor": False, "standing": False},
                "notes": "",
            },
            {
                "label": "Desk B2",
                "code": "B2",
                "name": "Desk B2",
                "status": Desk.Status.AVAILABLE,
                "amenities": {"monitor": True, "window_view": True},
                "notes": "Window-facing desk with great natural light.",
            },
            {
                "label": "Desk C1",
                "code": "C1",
                "name": "Desk C1",
                "status": Desk.Status.MAINTENANCE,
                "amenities": {},
                "notes": "Under maintenance — do not book.",
            },
        ]

        desks: dict[str, Desk] = {}
        for spec in desk_specs:
            layout_obj = layout_objs[spec["label"]]
            desk, created = Desk.objects.get_or_create(
                office=office,
                code=spec["code"],
                is_active=True,
                defaults={
                    "organization": org,
                    "floor": floor,
                    "layout_object": layout_obj,
                    "name": spec["name"],
                    "status": spec["status"],
                    "amenities": spec["amenities"],
                    "notes": spec["notes"],
                },
            )
            desks[spec["code"]] = desk
            ok(f"{spec['name']} [{spec['code']}] status={spec['status']}", created)

        # ── Bookings ──────────────────────────────────────────────────────────
        log("\nBookings:")

        today = datetime.date.today()
        tomorrow = today + datetime.timedelta(days=1)

        # Only book AVAILABLE desks
        booking_specs = [
            # member books Desk A1 today → shows "booked by me" when member views map
            {"desk_code": "A1", "user": member_user, "date": today},
            # member2 books Desk B1 today → shows "reserved" when member views map
            {"desk_code": "B1", "user": member2_user, "date": today},
            # admin books Desk A2 tomorrow
            {"desk_code": "A2", "user": admin_user, "date": tomorrow},
        ]

        for spec in booking_specs:
            desk = desks.get(spec["desk_code"])
            if desk is None or desk.status != Desk.Status.AVAILABLE:
                log(f"  [skip ] {spec['desk_code']} not available — skipped")
                continue

            booking, created = DeskBooking.objects.get_or_create(
                desk=desk,
                booking_date=spec["date"],
                status=DeskBooking.Status.ACTIVE,
                defaults={
                    "organization": org,
                    "office": office,
                    "floor": floor,
                    "user": spec["user"],
                },
            )
            ok(
                f"{spec['user'].email} → {spec['desk_code']} on {spec['date']}",
                created,
            )

        # ── Summary ───────────────────────────────────────────────────────────
        log(self.style.SUCCESS("\n=== Demo workspace seeding complete ===\n"))
        log(f"  Organisation  : {org.name}")
        log(f"  Office        : {office.name}, {office.city}")
        log(f"  Floor         : {floor.name} (level {floor.level_number})")
        log(f"  Layout objects: {len(layout_specs)}")
        log(f"  Desks         : {len(desk_specs)} (4 available, 1 maintenance)")
        log(f"  Bookings      : {len(booking_specs)} seeded")
        log("")
        log("  Demo credentials (LOCAL ONLY — never use in production):")
        log(f"    Admin   : {admin_email} / {password}")
        log(f"    Member  : {member_email} / {password}")
        log(f"    Member2 : {member2_email} / {password}")
        log("")
        log(f"  Pending invite token : {invite.token}")
        log(f"    Accept URL         : /invite/{invite.token}")
        log("")
        log("  App URL: http://localhost:5173")
        log(f"\n  WARNING: Demo password '{password}' is for local development only.\n")

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _get_or_create_user(
        self,
        *,
        email: str,
        username: str,
        full_name: str,
        password: str,
    ) -> tuple:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "full_name": full_name,
                "is_profile_completed": True,
                "email_verified": True,
                "is_active": True,
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user, created

    def _reset_demo(self, email_domain: str, log) -> None:
        log(
            self.style.WARNING(
                "\n⚠  --reset-demo: removing existing demo data only...\n"
            )
        )

        # DeskBooking.desk uses on_delete=PROTECT, so bookings must be deleted
        # before the cascade from org → office → floor → desk can proceed.
        orgs = Organization.objects.filter(slug=_DEMO_ORG_SLUG)
        for org in orgs:
            booking_count, _ = DeskBooking.objects.filter(organization=org).delete()
            if booking_count:
                log(f"  Deleted {booking_count} booking(s) for demo org")

        org_count = orgs.count()
        if org_count:
            orgs.delete()
            log(
                f"  Deleted {org_count} demo org(s) and all cascaded data "
                f"(offices, floors, desks, memberships, invitations)"
            )
        else:
            log("  No demo org found — nothing to cascade-delete")

        # Delete users with the demo email domain.
        demo_users = User.objects.filter(email__endswith=f"@{email_domain}")
        user_count = demo_users.count()
        if user_count:
            demo_users.delete()
            log(f"  Deleted {user_count} demo user(s) with @{email_domain} emails")
        else:
            log(f"  No demo users found with @{email_domain} emails")

        log(self.style.SUCCESS("  Reset complete — re-seeding now...\n"))
