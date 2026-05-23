# WorkspaceCanvas

WorkspaceCanvas is a workplace management platform for designing office layouts, managing desk bookings, organizing workplace events, running internal awards, and improving employee engagement.

The long-term goal is to provide companies with a clean internal tool where admins can visually design an office map, publish it for employees, and allow employees to interact with the workspace through bookings, events, voting, and announcements.

## Current Status

This project is in early development.

Currently completed:

- React + TypeScript frontend setup
- Tailwind CSS setup
- Django backend project setup with `config` app (settings, URLs, WSGI/ASGI)
- PostgreSQL database configured via environment variables
- `accounts` app with Organization, Membership, and Invitation models
- Docker setup for local development
- JWT email/password login, refresh, verify, logout, current user endpoint
- Signup endpoint with email verification flow (console email backend in dev)
- Google and Microsoft social login — verifies provider tokens, finds or creates users, returns WorkspaceCanvas JWT tokens

Upcoming work:

- Add backend apps one by one
- Create office/floor/map models
- Build the 2.5D office map editor
- Add desk booking flow
- Add employee-facing office preview
- Add events module
- Add awards and voting module
- Add Outlook email and calendar integration later

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

Planned frontend additions:

- React Router
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
| Password | `admin123` |

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust as needed:

```bash
cp backend/.env.example backend/.env
```

Key variables:

| Variable | Description |
|---|---|
| `POSTGRES_HOST` | Set to `db` when running in Docker, `localhost` when running locally |
| `DJANGO_SECRET_KEY` | Django secret key — change this in production |
| `DJANGO_DEBUG` | `True` for development, `False` for production |
| `DJANGO_SUPERUSER_USERNAME` | Auto-created superuser username |
| `DJANGO_SUPERUSER_EMAIL` | Auto-created superuser email |
| `DJANGO_SUPERUSER_PASSWORD` | Auto-created superuser password |

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
