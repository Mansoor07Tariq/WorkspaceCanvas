# PR 050 — Demo Data, Seed Command, and MVP QA Checklist

## Purpose

This PR makes WorkspaceCanvas demo-ready and manually testable end-to-end. It adds:

1. A Django management command (`seed_demo_workspace`) that populates a complete demo workspace in one command.
2. A comprehensive MVP manual QA checklist covering every user flow.
3. README instructions for running the seed and navigating the demo.

---

## Why This PR Exists

The application is feature-complete for MVP (PRs 028–049). Before showing it to stakeholders or handing it to QA, we need:

- A repeatable, one-command setup for a realistic demo environment.
- Documented credentials so anyone can walk through every role and flow.
- A structured QA checklist to catch regressions quickly.

---

## Seed Command

### Location

```
backend/offices/management/commands/seed_demo_workspace.py
```

### Usage

```bash
# From the WorkspaceCanvas/ root:
python backend/manage.py seed_demo_workspace

# Or using the Makefile shortcut:
make seed-demo
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--admin-email` | `admin@workspacecanvas.demo` | Demo admin user email |
| `--member-email` | `member@workspacecanvas.demo` | Demo member user email |
| `--password` | `DemoPass123!` | Password for all demo users. **LOCAL ONLY.** |
| `--org-name` | `WorkspaceCanvas Demo` | Demo organisation name |
| `--email-domain` | `workspacecanvas.demo` | Allowed email domain for the org |
| `--reset-demo` | (flag) | Delete demo data before re-seeding. Only deletes demo org and demo-domain users. |

### Idempotency

The command is safe to run multiple times. It uses `get_or_create` throughout so:

- A second run reuses all existing objects and prints `[reused]` for each.
- No data is duplicated.
- Bookings are looked up by `desk + booking_date + status=ACTIVE` so they are never double-created.

---

## Demo Credentials

> **WARNING:** These credentials are for local development only. Never use demo passwords in production or staging environments.

| Role | Email | Password |
|------|-------|----------|
| Admin (Owner) | `admin@workspacecanvas.demo` | `DemoPass123!` |
| Member | `member@workspacecanvas.demo` | `DemoPass123!` |
| Member 2 | `member2@workspacecanvas.demo` | `DemoPass123!` |

A pending invitation for `guest@workspacecanvas.demo` is also created. The invite token is printed by the seed command and can be used to test the `/invite/<token>` flow.

---

## Seeded Data

### Organisation

| Field | Value |
|-------|-------|
| Name | WorkspaceCanvas Demo |
| Slug | `workspacecanvas-demo` |
| Type | Company |
| Status | Active |
| Allowed domain | `workspacecanvas.demo` |

> **Note (PR 055):** the seed creates a **single** organization, so the
> multi-org workspace switcher (TD-037) does not appear in the demo — the
> dashboard/offices/booking/people pages behave exactly as in single-org mode.
> To exercise the switcher manually, add a second active membership for the
> demo user in a second active organization.

### Memberships

| User | Role | Status |
|------|------|--------|
| admin@workspacecanvas.demo | Owner | Active |
| member@workspacecanvas.demo | Member | Active |
| member2@workspacecanvas.demo | Member | Active |

### Office

| Field | Value |
|-------|-------|
| Name | Demo HQ |
| City | Dublin |
| Country | Ireland |
| Timezone | Europe/Dublin |

### Floor

| Field | Value |
|-------|-------|
| Name | Ground Floor |
| Level | 0 |

### Layout Objects (13 total)

| Type | Label |
|------|-------|
| `desk` × 5 | Desk A1, Desk A2, Desk B1, Desk B2, Desk C1 |
| `boardroom_table` | Boardroom Table |
| `lunch_table` | Lunch Table |
| `meeting_pod` | Meeting Pod |
| `sofa` | Lounge Sofa |
| `door` | Main Door |
| `window` | North Window |
| `whiteboard` | Whiteboard |
| `plant` | Office Plant |

### Desks

| Code | Name | Status |
|------|------|--------|
| A1 | Desk A1 | Available (monitor) |
| A2 | Desk A2 | Available (monitor) |
| B1 | Desk B1 | Available |
| B2 | Desk B2 | Available (monitor, window view) |
| C1 | Desk C1 | **Maintenance** — not bookable |

### Bookings (seeded on first run)

| User | Desk | Date |
|------|------|------|
| member | A1 | Today |
| member2 | B1 | Today |
| admin | A2 | Tomorrow |

These bookings create the following map states when viewed as `member` today:
- **A1** → "Booked by me"
- **B1** → "Reserved" (booked by someone else)
- **B2** → "Available"
- **C1** → Desk resource is maintenance status (not available)

### Pending Invitation

| Field | Value |
|-------|-------|
| Email | `guest@workspacecanvas.demo` |
| Role | Member |
| Status | Pending |
| Expires | 7 days from seed time |

---

## End-to-End Demo Walkthrough

### 1. Start the application

```bash
# Backend + DB
make backend-docker-up
make migrate
make seed-demo

# Frontend
make frontend
```

### 2. Admin flow

1. Open http://localhost:5173
2. Log in as `admin@workspacecanvas.demo` / `DemoPass123!`
3. **Dashboard** — setup checklist shows all steps complete; workspace health cards show desk/member counts.
4. **Offices** → Demo HQ → Ground Floor → Floor Layout
   - Object library visible in left panel.
   - 13 layout objects on the canvas (desks, tables, structural objects, decor).
   - Click a desk object → inspector panel shows desk resource (Desk A1, etc.).
5. **Desk Booking** (`/app/bookings`)
   - Select Demo HQ / Ground Floor / today.
   - Map shows A1 and B1 reserved; A2, B2 available (C1 shown as unavailable/maintenance colour).
   - Book Desk B2 for today — confirm booking succeeds.
6. **My Bookings** (`/app/bookings/my`) — tomorrow's booking for A2 visible.
7. **People** (`/app/people`)
   - Three members listed.
   - One pending invitation for `guest@workspacecanvas.demo`.
   - Copy invite link → use token from seed output.

### 3. Member flow

1. Log out. Log in as `member@workspacecanvas.demo` / `DemoPass123!`
2. **Dashboard** — booking-focused view; no admin setup checklist.
3. **Offices** — can view office/floor list; no "Add office" button.
4. **Floor Layout** — object library hidden; read-only banner visible.
5. **Desk Booking** — map shows "Booked by me" on A1, "Reserved" on B1.
6. **My Bookings** — today's A1 booking visible; cancel it.
7. **People** — member list visible; no invite form.

### 4. Invitation acceptance flow

1. Copy the invite link from the seed output: `/invite/<token>`
2. Open the URL while logged out.
3. Log in (or create a new account with `guest@workspacecanvas.demo`).
4. Accept the invitation → lands on member dashboard.

---

## Manual QA Checklist

Use this checklist for every release candidate. Check every box before signing off.

### Auth / Profile

- [ ] Log in as demo admin — lands on dashboard
- [ ] Log in as demo member — lands on dashboard
- [ ] Profile is complete for both users (no profile-completion redirect)
- [ ] Log out — redirected to login page
- [ ] Unauthenticated access to `/app` → redirected to login
- [ ] Authenticated access to `/login` → redirected to `/app` (GuestOnlyRoute)

### Admin — Dashboard

- [ ] Dashboard shows admin/owner view (setup checklist, workspace health)
- [ ] Setup checklist shows all items complete (org, office, floor, desks, members)
- [ ] Workspace health cards show desk count, member count
- [ ] "Invite People" quick action links to People page

### Admin — Offices

- [ ] Offices page lists Demo HQ
- [ ] "Add office" button is visible for admin
- [ ] Click Demo HQ → office detail page
- [ ] Office detail lists Ground Floor
- [ ] "Add floor" button is visible for admin
- [ ] Click Ground Floor → floor layout page

### Admin — Floor Layout

- [ ] Object library (left panel) is visible
- [ ] Object create form is visible
- [ ] 13 layout objects visible on canvas
- [ ] Drag a layout object — position persists on reload
- [ ] Select a desk object → inspector panel shows desk resource details
- [ ] Canvas toolbar (grid, snap) fully visible

### Admin — Desk Booking

- [ ] Navigate to Desk Booking (`/app/bookings`)
- [ ] Select Demo HQ / Ground Floor / today
- [ ] Desk list shows available and reserved desks
- [ ] Map shows correct availability colours
- [ ] Book an available desk — booking succeeds
- [ ] Try to book the same desk again — duplicate prevented
- [ ] Cancel the booking from the panel — status updates

### Admin — My Bookings

- [ ] Navigate to My Bookings (`/app/bookings/my`)
- [ ] Tomorrow's A2 booking is listed as upcoming
- [ ] Cancel button is visible and functional

### Admin — People

- [ ] People page lists three members (admin, member, member2)
- [ ] Pending invitation for `guest@workspacecanvas.demo` is shown
- [ ] Copy invite link button works
- [ ] Cancel invitation button works
- [ ] Invite a new member via the invite form

### Member — Dashboard

- [ ] Dashboard shows member/booking-focused view
- [ ] No admin setup checklist
- [ ] No "Create office" or "Manage workspace" CTAs

### Member — Offices

- [ ] Offices page lists Demo HQ
- [ ] **No** "Add office" button visible
- [ ] Office detail lists Ground Floor
- [ ] **No** "Add floor" button visible

### Member — Floor Layout

- [ ] Object library (left panel) is hidden
- [ ] Object create form is hidden
- [ ] Read-only info banner is visible
- [ ] Canvas objects are visible but not draggable

### Member — Desk Booking

- [ ] Navigate to Desk Booking
- [ ] A1 shows as "Booked by me" (member's own booking)
- [ ] B1 shows as "Reserved" (member2's booking, identity hidden)
- [ ] B2 shows as available and bookable
- [ ] Book B2 — succeeds
- [ ] C1 shown as maintenance/unavailable — cannot be booked

### Member — My Bookings

- [ ] My Bookings shows today's A1 booking
- [ ] Cancel booking — status updates to cancelled
- [ ] Cancelled booking remains visible in list

### Member — People

- [ ] Members list is visible
- [ ] **No** invite form
- [ ] **No** pending invitation tokens visible

### Role UX — Navigation

- [ ] Sidebar for admin and member: Dashboard, Offices, Desk Booking, My Bookings, People
- [ ] **No** Events in sidebar for either role
- [ ] Nav items match for both roles (differences are page-level)

### Invitation Acceptance Flow

- [ ] Open `/invite/<token>` from seed output while logged out
- [ ] Page shows org name and invited role
- [ ] Prompts to log in or create account
- [ ] After accepting — lands on member dashboard
- [ ] Invitation status changes to `accepted`

### First-Run (fresh DB — separate manual scenario)

- [ ] Fresh DB with no data → admin lands on dashboard
- [ ] Setup checklist shows incomplete steps
- [ ] "Create an office" link works → office creation flow
- [ ] "Invite team" link goes to People page

### Accessibility Smoke

- [ ] Dashboard, Bookings, My Bookings, People each have an `<h1>`
- [ ] Error alerts have `role="alert"` (test by triggering a form error)
- [ ] Tab navigation works on Login, Signup, Dashboard, and Booking pages
- [ ] No keyboard trap on any modal or panel

---

## Tests

### New test file

```
backend/offices/tests/test_seed_demo_workspace.py
```

Coverage:
- Organisation, users, memberships created with correct state
- Admin is owner, member is member
- Office, floor, layout objects, desks created
- Desk codes A1–B2 exist; C1 is maintenance
- Bookings created without violating unique constraints
- Command fully idempotent (double-run does not double counts)
- Unrelated org and user are not touched
- `--reset-demo` deletes demo org and domain users, leaves unrelated data
- Output contains org name, credentials, invite token, and warning

---

## Known Limitations

- Demo password is printed to stdout — expected for a local dev tool; never use in production.
- Bookings use `datetime.date.today()` — if the test suite or demo runs across midnight, dates shift by one day. This is intentional (demo always shows current-day bookings).
- `--reset-demo` identifies users by email domain (`@workspacecanvas.demo`). If you changed `--email-domain`, pass the same value to `--reset-demo`.
- The seed command does not send emails. Invitation links must be manually copied from command output.
- The command should not be added to production startup scripts or CI.

---

## What Is Not Included

- Production deployment or staging seed.
- Destructive full-database reset (use `--reset-demo` for demo data only).
- Real email delivery.
- Automated end-to-end browser tests (Playwright/Cypress).
- Performance or load testing.
- Multi-office or multi-org demo scenarios.
