# 004 — Docker Development Setup

## Purpose

Add Docker support for local development so that the backend, database, and frontend can each be run in containers without manually installing PostgreSQL or managing Python/Node environments.

## What Was Added

**Backend:**
- `backend/Dockerfile` — builds the Django application image
- `backend/docker-compose.yml` — runs Django + PostgreSQL together
- `backend/entrypoint.sh` — startup script that waits for the DB, runs migrations, creates a superuser, and starts the server

**Frontend:**
- `frontend/Dockerfile` — builds the React + Vite application image
- `frontend/docker-compose.yml` — runs the frontend separately

## Files Involved

| File | Purpose |
|---|---|
| `backend/Dockerfile` | Django container image |
| `backend/docker-compose.yml` | Orchestrates Django + PostgreSQL |
| `backend/entrypoint.sh` | Backend startup logic |
| `backend/.env.example` | Environment variable template |
| `frontend/Dockerfile` | Frontend container image |
| `frontend/docker-compose.yml` | Runs frontend container |

## How It Works

### Backend Startup Flow

When `docker compose up` is run from `backend/`, the following happens in order:

1. **PostgreSQL starts** and the healthcheck (`pg_isready`) polls until the database is accepting connections
2. **Django container starts** only after PostgreSQL is healthy (`depends_on: condition: service_healthy`)
3. **`entrypoint.sh` runs** and executes:
   1. Waits for PostgreSQL using `pg_isready` (belt-and-suspenders on top of the healthcheck)
   2. Runs `python manage.py migrate`
   3. Checks if a superuser already exists
   4. Creates a superuser if none exists and the three `DJANGO_SUPERUSER_*` env vars are set
   5. Starts `python manage.py runserver 0.0.0.0:8000`

### `POSTGRES_HOST` inside Docker

Inside the Docker network, the database is reachable at the service name `db`, not `localhost`. The compose file overrides this:

```yaml
environment:
  POSTGRES_HOST: db
```

This takes precedence over whatever `POSTGRES_HOST` is set to in `.env`.

### Frontend

The frontend runs completely independently. It has its own `docker-compose.yml` and is not connected to the backend Docker network. The two are kept separate intentionally — the frontend calls the backend API over HTTP, not through a Docker network.

## How To Run / Test

**Backend + PostgreSQL:**

```bash
cd backend
cp .env.example .env
docker compose up --build
```

| URL | Purpose |
|---|---|
| http://localhost:8000 | Django API root |
| http://localhost:8000/admin/ | Django admin panel |

Default admin credentials (from `.env.example`):

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

**Frontend:**

```bash
cd frontend
docker compose up --build
```

| URL | Purpose |
|---|---|
| http://localhost:5173 | React frontend |

**Stopping:**

```bash
# From backend/
docker compose down

# From frontend/
docker compose down
```

**Wipe PostgreSQL data (caution — deletes all data):**

```bash
# From backend/
docker compose down -v
```

## Important Decisions

**Backend and frontend are separate compose files:** The frontend is a static React app that talks to the backend over HTTP. There is no reason to put it in the same Docker network as the backend. Keeping them separate makes each side independently deployable and avoids coupling frontend Docker configuration to backend infrastructure.

**Healthcheck before backend starts:** The `depends_on: condition: service_healthy` ensures Django does not attempt to connect to PostgreSQL before it is ready. Without this, `migrate` would fail on a cold start.

**Superuser is only created if none exists:** The `entrypoint.sh` checks before creating, so repeated `docker compose up` calls do not error or create duplicate superusers.

**`entrypoint.sh` uses `exec` for the final command:** `exec python manage.py runserver` replaces the shell process so that signals (e.g. Ctrl+C, `docker compose down`) are passed directly to Django and the container shuts down cleanly.

## Important

- Never commit `backend/.env` — it contains real secrets
- Never commit `frontend/.env` — same reason
- Both `.env` files are listed in `.gitignore`
- This Docker setup is for **local development only**
- Redis, Celery, Mailpit, Nginx, and production Docker configuration are not included yet

## Future Notes

- A production `Dockerfile` will be added later using `gunicorn` instead of Django's dev server
- Nginx will be added in front of Django and the frontend for production
- Celery and Redis will be added to `docker-compose.yml` when background jobs are needed
- Mailpit may be added as a local email catcher for testing invitation emails
- Environment-specific compose overrides (`docker-compose.override.yml`) may be used to separate dev and prod config
