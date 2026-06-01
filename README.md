# WorkspaceCanvas

WorkspaceCanvas is a workplace management platform for designing office layouts, managing desk bookings, organizing workplace events, running internal awards, and improving employee engagement.

The long-term goal is to provide companies with a clean internal tool where admins can visually design an office map, publish it for employees, and allow employees to interact with the workspace through bookings, events, voting, and announcements.

## Current Status

This project is in active development. The authentication stack, organization setup, office/floor management, canvas builder, desk management, and desk booking API are all complete.

### Completed

**Infrastructure and architecture**

- React + TypeScript frontend (Vite, MUI 9, Tailwind, React Router, Konva)
- Django backend with PostgreSQL, Docker, CI/CD (lint, format, migration check, test, build)
- `accounts` app: Organization, Membership, Invitation models
- `users` app: Custom User model, approval flow
- `offices` app: Office, Floor, LayoutObject, Desk, DeskBooking models

**Full authentication stack (backend + frontend)**

- Custom User model with email verification, MFA, and social auth fields
- Email/password signup with email verification flow
- JWT login with HttpOnly cookie token storage, refresh (token rotation + blacklist), logout, current user endpoint
- Google and Microsoft OAuth 2.0 social login with full OIDC/JWKS verification
- TOTP MFA: setup, confirm, disable, recovery codes, re-auth for sensitive operations
- MFA login enforcement: challenge-based gate on email and social login flows
- Frontend auth UI: Signup, Login, Email Verification, MFA Challenge, MFA Setup pages
- Google and Microsoft social login buttons with popup flows
- AuthProvider, useAuth, ProtectedRoute, session-expiry handling
- Silent token refresh on 401 with global session expiry propagation
- Rate limiting on all public auth endpoints (DRF ScopedRateThrottle)

**Profile and organization setup**

- Profile completion flow: avatar upload, timezone, display name
- Organization creation from profile onboarding
- Office creation and management
- Floor creation and management per office

**Office canvas and desk management**

- 2D floor map canvas builder (Konva / React Konva)
- Layout objects: drag, move, resize, rotate with persistence
- Canvas boundary clamping, grid snapping, keyboard UX (arrow keys, delete, escape)
- Bundle splitting and route lazy-loading
- Desk resource model: code, name, status (available / unavailable / maintenance), active flag
- Desk inline edit UI with detail endpoint
- Desk booking API: create, list, detail, cancel with privacy-aware serialization
- DB-level partial unique constraints preventing double-booking
- Desk Booking UI: date picker, office/floor selector, availability list, book and cancel actions
- Canvas availability colouring — desk shapes on the floor map reflect booking status
- My Bookings page — user's upcoming and past bookings at `/app/bookings/my` with cancel action

### Upcoming Work

- Events module
- Awards and voting module
- Email and push notifications
- Admin booking management UI

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Material UI (MUI 9)
- React Router
- Konva / React Konva (office map canvas)

### Backend

- Python
- Django
- Django REST Framework
- PostgreSQL
- psycopg (v3)
- SimpleJWT (HttpOnly cookie token rotation)
- Celery + Redis (planned — for background jobs and notifications)

## Project Structure

```txt
WorkspaceCanvas/
  backend/
    accounts/          # Organization, Membership, Invitation models
    users/             # Custom User model, approval flow
    offices/           # Office, Floor, LayoutObject, Desk, DeskBooking models and API
    config/            # Django settings, URL conf, WSGI/ASGI
    entrypoint.sh
    Dockerfile
    docker-compose.yml
    manage.py
    requirements.txt
    .env.example

  docs/
    001-project-setup.md
    002-postgres-config.md
    ... (041 docs total; see Documentation table below)
    TECHNICAL_DEBT.md

  frontend/
    public/
    src/
      features/
        auth/          # Login, signup, MFA, social login
        profile/       # Profile completion, avatar
        organizations/ # Org setup
        offices/       # Office management
        floors/        # Floor management
        layout/        # Canvas builder
        desks/         # Desk management and inline edit
        bookings/      # Booking API layer and hook
      components/      # Shared UI components
      lib/             # API client, auth utils
    Dockerfile
    docker-compose.yml
    package.json
    vite.config.ts

  Makefile
  README.md
  .gitignore
```

## Documentation

Detailed notes for each feature and setup step are in the `docs/` folder:

| Doc | Description |
|---|---|
| [001-project-setup.md](docs/001-project-setup.md) | Initial repo structure, frontend and backend setup |
| [002-postgres-config.md](docs/002-postgres-config.md) | PostgreSQL configuration via environment variables |
| [003-accounts-foundation.md](docs/003-accounts-foundation.md) | Organization, Membership, and Invitation models |
| [004-docker-dev-setup.md](docs/004-docker-dev-setup.md) | Docker setup for local development |
| [005-ci-quality-gates.md](docs/005-ci-quality-gates.md) | GitHub Actions CI — lint, format, test, build |
| [006-pre-commit-hooks.md](docs/006-pre-commit-hooks.md) | Pre-commit hooks — local lint and format checks before every commit |
| [007-api-foundation.md](docs/007-api-foundation.md) | API foundation — DRF, CORS, OpenAPI schema, Swagger UI |
| [008-developer-commands.md](docs/008-developer-commands.md) | Makefile — developer commands reference |
| [009-users-and-approval-foundation.md](docs/009-users-and-approval-foundation.md) | Custom User model, organization approval flow, Django admin actions |
| [010-auth-identity-foundation.md](docs/010-auth-identity-foundation.md) | Auth identity fields — email verification, MFA flags, auth provider |
| [011-jwt-login-foundation.md](docs/011-jwt-login-foundation.md) | JWT email/password login, refresh, verify, logout, current user endpoint |
| [012-signup-email-verification.md](docs/012-signup-email-verification.md) | Signup endpoint, EmailVerificationToken model, email verification and resend flows |
| [013-social-auth-foundation.md](docs/013-social-auth-foundation.md) | Google and Microsoft social login — provider token verification, user find-or-create, WorkspaceCanvas JWT response |
| [014-mfa-foundation.md](docs/014-mfa-foundation.md) | MFA foundation — TOTP device setup, confirm, disable, and recovery code management |
| [015-mfa-login-enforcement.md](docs/015-mfa-login-enforcement.md) | MFA login enforcement — challenge-based MFA gate on email and social login |
| [016-frontend-auth-api-foundation.md](docs/016-frontend-auth-api-foundation.md) | Frontend auth API foundation — TypeScript types, token storage, fetch wrapper, and auth API functions |
| [017-frontend-architecture-foundation.md](docs/017-frontend-architecture-foundation.md) | Frontend architecture foundation — DRY API layer, centralized endpoints and env, scalable folder structure |
| [018-signup-ui.md](docs/018-signup-ui.md) | Signup UI — first auth screen with form, client-side validation, API integration, success/error states |
| [019-frontend-ui-system-foundation.md](docs/019-frontend-ui-system-foundation.md) | Frontend UI system — MUI 9, shared theme, AppThemeProvider, auth component refactor |
| [020-login-ui.md](docs/020-login-ui.md) | Login UI — email/password login, AuthPageShell, token storage, MFA-required routing to placeholder |
| [021-mfa-challenge-ui.md](docs/021-mfa-challenge-ui.md) | MFA Challenge UI — TOTP and recovery code verification, missing challenge state, token storage after MFA |
| [022-email-verification-ui.md](docs/022-email-verification-ui.md) | Email Verification UI — token verification page, success/error states, resend verification form |
| [023-social-login-ui.md](docs/023-social-login-ui.md) | Social Login UI — Google and Microsoft OAuth buttons on Login and Signup pages, MFA-required routing |
| [024-auth-state-protected-routes.md](docs/024-auth-state-protected-routes.md) | Auth State and Protected Routes — AuthProvider, useAuth, ProtectedRoute, /app protection, logout support |
| [025-auth-hardening-cleanup.md](docs/025-auth-hardening-cleanup.md) | Auth Hardening and Cleanup — allauth removal, SECRET_KEY enforcement, CORS env var, rate limiting, MFA secret removal |
| [026-auth-security-cleanup.md](docs/026-auth-security-cleanup.md) | Auth Security Cleanup and QR Code — django-ipware IP extraction, django-csp, QR code for MFA setup, MfaSetupPage, theme-driven link colours |
| [027-profile-completion-dashboard-flow.md](docs/027-profile-completion-dashboard-flow.md) | Profile completion flow — display name, timezone, avatar upload, onboarding redirect |
| [028-premium-profile-onboarding-carousel-avatar.md](docs/028-premium-profile-onboarding-carousel-avatar.md) | Premium onboarding carousel, avatar upload with crop, profile completion polish |
| [029-httponly-cookie-auth.md](docs/029-httponly-cookie-auth.md) | HttpOnly cookie token storage — migrate from localStorage to secure HttpOnly cookies |
| [029-organization-setup-from-offices.md](docs/029-organization-setup-from-offices.md) | Organization setup from offices — create org, invite members, office-first org flow |
| [030-create-first-office.md](docs/030-create-first-office.md) | Create first office — office creation form, validation, API integration |
| [031-floor-creation-foundation.md](docs/031-floor-creation-foundation.md) | Floor creation foundation — floor model, API, creation UI per office |
| [032-floor-layout-object-model-and-object-library.md](docs/032-floor-layout-object-model-and-object-library.md) | Floor layout object model and object library — LayoutObject model, object palette, API |
| [033-basic-floor-map-builder-shell.md](docs/033-basic-floor-map-builder-shell.md) | Basic floor map builder shell — Konva canvas, stage setup, object rendering |
| [034-drag-move-persistence-for-layout-objects.md](docs/034-drag-move-persistence-for-layout-objects.md) | Drag and move persistence — PATCH endpoint, optimistic updates, rollback on failure |
| [035-resize-rotate-and-canvas-quality-improvements.md](docs/035-resize-rotate-and-canvas-quality-improvements.md) | Resize, rotate, and canvas quality — transformer handles, rotation, stale state fixes |
| [036-bundle-splitting-and-route-lazy-loading.md](docs/036-bundle-splitting-and-route-lazy-loading.md) | Bundle splitting and route lazy-loading — vendor chunks, code splitting, Vite config |
| [037-canvas-boundary-grid-snapping-keyboard-ux.md](docs/037-canvas-boundary-grid-snapping-keyboard-ux.md) | Canvas boundary clamping, grid snapping, keyboard UX — arrow keys, delete, escape |
| [038-desk-resource-model-foundation.md](docs/038-desk-resource-model-foundation.md) | Desk resource model — Desk model, status choices, is_active flag, CRUD API |
| [039-desk-inline-edit-ui-and-detail-endpoint.md](docs/039-desk-inline-edit-ui-and-detail-endpoint.md) | Desk inline edit UI and detail endpoint — edit panel, GET detail, stale form fixes |
| [040-desk-booking-model-and-api-foundation.md](docs/040-desk-booking-model-and-api-foundation.md) | Desk booking model and API — DeskBooking model, list/create/detail/cancel endpoints, privacy-aware serialization |
| [041-codebase-hardening-and-tech-debt-cleanup.md](docs/041-codebase-hardening-and-tech-debt-cleanup.md) | CI/DevEx updates, security guardrails, booking hardening, frontend cleanup, README and docs refresh |
| [042-booking-ui-foundation.md](docs/042-booking-ui-foundation.md) | Booking UI — /app/bookings route, office/floor/date selector, desk list, book/cancel flow |
| [043-canvas-availability-map-booking.md](docs/043-canvas-availability-map-booking.md) | Canvas availability colours and map-based desk selection — mode="booking", colour-coded shapes, map/list sync |
| [044-booking-data-integrity-hardening.md](docs/044-booking-data-integrity-hardening.md) | Booking data integrity — DeskBooking.clean(), select_for_update service, Desk deactivation signals |
| [045-my-bookings-and-request-hygiene.md](docs/045-my-bookings-and-request-hygiene.md) | My Bookings view, request hygiene, TD-009/015/020 |
| [TECHNICAL_DEBT.md](docs/TECHNICAL_DEBT.md) | Long-lived engineering debt register — open items, severity, recommended fixes |

## Common Commands

All commands run from the repository root. See [docs/008-developer-commands.md](docs/008-developer-commands.md) for the full reference.

```bash
make help                   # list all commands

make backend                # run Django dev server
make frontend               # run Vite dev server

make backend-docker-build   # build backend Docker image
make backend-docker-up      # start backend + PostgreSQL in background
make backend-docker-serve   # start backend + PostgreSQL with logs in terminal
make backend-docker-down    # stop backend Docker services

make frontend-docker-build  # build frontend Docker image
make frontend-docker-up     # start frontend in background
make frontend-docker-serve  # start frontend with logs in terminal
make frontend-docker-down   # stop frontend Docker services

make ci                     # run all lint, format, migration check, test, and build checks locally
```

## Local Development

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for running frontend outside Docker)
- Python 3.11+ (for running backend outside Docker)

### Running with Docker

**Backend + PostgreSQL:**

```bash
# From WorkspaceCanvas/backend/
cp .env.example .env
chmod +x entrypoint.sh

cd backend && docker compose up --build
```

On first run the backend will:
1. Wait for PostgreSQL to be healthy
2. Run all Django migrations
3. Create a superuser if none exists (using credentials from `.env`)
4. Start the Django development server

**Frontend:**

```bash
# From WorkspaceCanvas/frontend/
docker compose up --build
```

**URLs:**

| Service | URL |
|---|---|
| Django API | http://localhost:8000 |
| Django Admin | http://localhost:8000/admin/ |
| React Frontend | http://localhost:5173 |

**Default admin credentials** (from `.env.example`):

| Field | Value |
|---|---|
| Username | `admin` |
| Password | See `DJANGO_SUPERUSER_PASSWORD` in `backend/.env` |

**Important:** Never use the example password in any real environment. Set a strong password in your `.env` file.

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust as needed:

```bash
cp backend/.env.example backend/.env
```

Key variables:

| Variable | Description |
|---|---|
| `POSTGRES_HOST` | Set to `db` when running in Docker, `localhost` when running locally |
| `DJANGO_SECRET_KEY` | **Required.** Django secret key. Generate with: `python -c "import secrets; print(secrets.token_hex(50))"` |
| `DJANGO_DEBUG` | `True` for development, `False` for production |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins. Default: `http://localhost:5173,http://127.0.0.1:5173` |
| `DJANGO_SUPERUSER_USERNAME` | Auto-created superuser username |
| `DJANGO_SUPERUSER_EMAIL` | Auto-created superuser email |
| `DJANGO_SUPERUSER_PASSWORD` | Auto-created superuser password — set a strong value |
| `GOOGLE_CLIENT_ID` | Optional. Google OAuth client ID for social login |
| `MICROSOFT_CLIENT_ID` | Optional. Microsoft OAuth client ID for social login |

See `backend/.env.example` for the full variable reference including email, MFA, and throttle rate settings.

### Running Without Docker

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Set POSTGRES_HOST=localhost in .env

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

### Stopping Docker Services

```bash
# Backend + DB (from backend/)
docker compose down

# Frontend (from frontend/)
docker compose down
```

To also remove the PostgreSQL volume (wipes all data):

```bash
# From backend/
docker compose down -v
```
