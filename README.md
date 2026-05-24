# WorkspaceCanvas

WorkspaceCanvas is a workplace management platform for designing office layouts, managing desk bookings, organizing workplace events, running internal awards, and improving employee engagement.

The long-term goal is to provide companies with a clean internal tool where admins can visually design an office map, publish it for employees, and allow employees to interact with the workspace through bookings, events, voting, and announcements.

## Current Status

This project is in early development.

Currently completed:

**Infrastructure and architecture**

- React + TypeScript frontend (Vite, MUI 9, Tailwind, React Router)
- Django backend with PostgreSQL, Docker, CI/CD (lint, format, test, build)
- `accounts` app: Organization, Membership, Invitation models

**Full authentication stack (backend + frontend)**

- Custom User model with email verification, MFA, and social auth fields
- Email/password signup with email verification flow
- JWT login, refresh (token rotation + blacklist), logout, current user endpoint
- Google and Microsoft OAuth 2.0 social login with full OIDC/JWKS verification
- TOTP MFA: setup, confirm, disable, recovery codes, re-auth for sensitive operations
- MFA login enforcement: challenge-based gate on email and social login flows
- Frontend auth UI: Signup, Login, Email Verification, MFA Challenge pages
- Google and Microsoft social login buttons with popup flows
- AuthProvider, useAuth, ProtectedRoute, session-expiry handling
- Silent token refresh on 401 with global session expiry propagation
- Authenticated app shell placeholder at `/app`
- Rate limiting on all public auth endpoints (DRF ScopedRateThrottle)
- 263 frontend tests, ~188 backend tests (require PostgreSQL)

Upcoming work:

- Profile Completion (user profile fields, avatar, timezone)
- Organization Setup (create org, invite members)
- Office map editor (2.5D canvas)
- Desk booking flow
- Events module
- Awards and voting module

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Material UI (MUI 9)
- React Router

Planned frontend additions:

- TanStack Query
- Zustand
- React Hook Form
- Zod
- Konva / React Konva for the office map builder

### Backend

- Python
- Django
- Django REST Framework
- PostgreSQL
- psycopg (v3)

Planned backend additions:

- Django REST Framework APIs
- JWT authentication
- Celery + Redis for background jobs
- Microsoft Graph API integration for Outlook email and calendar features

## Project Structure

```txt
WorkspaceCanvas/
  backend/
    accounts/
    config/
    entrypoint.sh
    Dockerfile
    docker-compose.yml
    manage.py
    requirements.txt
    .env.example

  docs/
    001-project-setup.md
    002-postgres-config.md
    003-accounts-foundation.md
    004-docker-dev-setup.md

  frontend/
    public/
    src/
    Dockerfile
    docker-compose.yml
    package.json
    vite.config.ts

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

make ci                     # run all lint, format, test, and build checks locally
```

## Local Development

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for running frontend outside Docker)
- Python 3.11+ (for running backend outside Docker)

### Running with Docker

**Backend + PostgreSQL:**

```bash
# From WorkspaceCanvas/
cp backend/.env.example backend/.env
chmod +x backend/entrypoint.sh

docker compose up --build
```

On first run the backend will:
1. Wait for PostgreSQL to be healthy
2. Run all Django migrations
3. Create a superuser if none exists (using credentials from `.env`)
4. Start the Django development server

**Frontend:**

```bash
# From frontend/
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
# Backend + DB
docker compose down

# Frontend (from frontend/)
docker compose down
```

To also remove the PostgreSQL volume (wipes all data):

```bash
docker compose down -v
```
