# 007 — API Foundation

## Purpose

Set up the base API layer for WorkspaceCanvas. This provides the infrastructure that all future API endpoints — organizations, offices, floors, maps, bookings, events, and awards — will be built on.

## What Was Added

- `djangorestframework` configured in `INSTALLED_APPS` and `REST_FRAMEWORK` settings
- `django-cors-headers` configured to allow the local Vite frontend to call the backend
- `django-filter` configured as the default DRF filter backend
- `drf-spectacular` configured for OpenAPI schema generation and Swagger UI
- `GET /api/health/` endpoint for backend availability checks
- `GET /api/schema/` endpoint that returns the OpenAPI schema
- `GET /api/docs/` endpoint that serves Swagger UI

## Files Involved

| File | Purpose |
|---|---|
| `backend/config/settings.py` | Added DRF, CORS, filter, and Spectacular configuration |
| `backend/config/urls.py` | Added health, schema, and docs URL routes |
| `backend/requirements.txt` | All four packages were already present |
| `backend/tests/test_api_foundation.py` | Tests for health, schema, and docs endpoints |

## How It Works

**Django REST Framework** powers all API responses. Every endpoint returns proper JSON with correct HTTP status codes. DRF handles content negotiation, request parsing, and response rendering.

**CORS** (`django-cors-headers`) allows the local Vite dev server running on `http://localhost:5173` to make API requests to `http://localhost:8000`. Without CORS headers, the browser would block cross-origin requests. `CorsMiddleware` is placed near the top of `MIDDLEWARE` so it runs before any middleware that might generate responses.

**django-filter** is set as the default DRF filter backend. This allows future list endpoints to support URL query parameter filtering out of the box (e.g. `?organization=1&status=active`).

**drf-spectacular** inspects all registered DRF views and generates an OpenAPI 3.0 schema automatically. The Swagger UI endpoint (`/api/docs/`) reads that schema and renders an interactive API explorer in the browser.

**Health endpoint** is a simple `@api_view` function that returns a fixed JSON response. It does not query the database. It exists so monitoring tools, Docker healthchecks, and developers can quickly verify the backend is up.

## How To Run / Test

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

Open in browser:

| URL | What you see |
|---|---|
| http://localhost:8000/api/health/ | `{"status": "ok", "message": "..."}` |
| http://localhost:8000/api/schema/ | Raw OpenAPI YAML/JSON schema |
| http://localhost:8000/api/docs/ | Interactive Swagger UI |

Run tests:

```bash
pytest
```

## Important Decisions

**All API routes are grouped under `/api/`** — this makes it easy to proxy API requests separately from static assets in a future production setup (e.g. Nginx routing `/api/` to Django and everything else to the frontend).

**Swagger UI is included** — during development, having a browsable API explorer significantly speeds up testing new endpoints without needing a frontend or Postman.

**No authentication was added in this PR** — JWT and session-based auth will be added in a separate step. For now, all endpoints are open. The health, schema, and docs endpoints are intentionally public even in production.

**No product feature endpoints were added** — organizations, offices, bookings, and events will each get their own app and URL file, included here via `include()`.

## Future Notes

- Add JWT authentication (`djangorestframework-simplejwt`) in a future PR
- Add per-app URL files and include them here with `include("app.urls")`
- Add API versioning (`/api/v1/`) if needed before public release
- Add `ReDocView` alongside Swagger UI for a second docs option
- Restrict `/api/docs/` and `/api/schema/` to `DEBUG=True` only in production
