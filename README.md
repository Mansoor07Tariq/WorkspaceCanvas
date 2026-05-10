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
