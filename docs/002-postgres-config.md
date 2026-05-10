# 002 — PostgreSQL Configuration

## Purpose

Configure Django to use PostgreSQL instead of the default SQLite database. Settings are loaded from a local `.env` file so that credentials are never committed to version control.

## What Was Added

- `python-dotenv` added to load environment variables from `backend/.env`
- Django `DATABASES` setting replaced with a PostgreSQL configuration
- `SECRET_KEY`, `DEBUG`, and `ALLOWED_HOSTS` also moved to environment variables
- `backend/.env.example` added as a committed template
- `backend/.env` added to `.gitignore`

## Files Involved

| File | Purpose |
|---|---|
| `backend/config/settings.py` | Loads env vars and configures PostgreSQL |
| `backend/.env.example` | Committed template for environment variables |
| `backend/.env` | Local secrets — never committed |
| `backend/requirements.txt` | Includes `psycopg`, `psycopg-binary`, `python-dotenv` |
| `.gitignore` | Ensures `.env` files are not committed |

## How It Works

On startup, Django settings calls `load_dotenv(BASE_DIR / ".env")` which reads `backend/.env` into the process environment. All sensitive values are then read via `os.environ.get()`.

```python
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "fallback-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ["true", "1", "yes"]
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "workspacecanvas"),
        "USER": os.environ.get("POSTGRES_USER", "workspacecanvas"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "workspacecanvas"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}
```

## How To Run / Test

Copy the example file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Example `backend/.env`:

```env
POSTGRES_DB=workspacecanvas
POSTGRES_USER=workspacecanvas
POSTGRES_PASSWORD=workspacecanvas
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

DJANGO_SECRET_KEY=dev-workspacecanvas-secret-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

Verify the connection:

```bash
cd backend
source .venv/bin/activate
python manage.py dbshell
```

## Important Decisions

**PostgreSQL over SQLite:** SQLite is unsuitable for this project's future needs. PostgreSQL supports JSON fields for flexible office map data, advanced constraints and indexes, and production-like behavior from day one.

**`POSTGRES_HOST` changes by context:**

| Context | Value |
|---|---|
| Running Django locally | `localhost` |
| Running Django inside Docker | `db` (the Docker Compose service name) |

**`DEBUG` parsing:** The value is lowercased and checked against `["true", "1", "yes"]` so that variations in `.env` files (`True`, `true`, `1`) all work correctly.

**`ALLOWED_HOSTS` parsing:** Each host is stripped of whitespace and empty entries (from trailing commas) are filtered out.

## Future Notes

- In production, `DJANGO_SECRET_KEY` must be a strong random value
- In production, `DJANGO_DEBUG` must be `False`
- `ALLOWED_HOSTS` will need to include the production domain
- Connection pooling (e.g. `pgBouncer` or `django-db-geventpool`) may be added later for performance
