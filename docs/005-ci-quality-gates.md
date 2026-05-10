# 005 — CI Quality Gates

## Purpose

Automatically run linting, formatting, tests, and build checks on every pull request and push to `main`. This catches broken code and style violations before they reach the main branch, without requiring manual review of every line.

## What Was Added

- `.github/workflows/ci.yml` — GitHub Actions workflow with two jobs: `frontend` and `backend`
- `frontend/src/App.test.tsx` — smoke test for the React app
- `frontend/src/test/setup.ts` — Vitest setup file (loads jest-dom matchers)
- `frontend/.prettierignore` — tells Prettier to skip `node_modules`, `dist`, `package-lock.json`
- `backend/pyproject.toml` — Ruff linting and formatting configuration
- `backend/pytest.ini` — pytest and Django test configuration
- `backend/tests/test_health.py` — backend smoke tests

New frontend devDependencies added:
- `prettier` — code formatter
- `vitest` — fast Vite-native test runner
- `jsdom` — browser-like DOM environment for tests
- `@testing-library/react` — React component testing utilities
- `@testing-library/jest-dom` — custom DOM matchers (`toBeInTheDocument`, etc.)
- `@testing-library/user-event` — simulates user interactions in tests

New backend dependency added:
- `ruff` — fast Python linter and formatter

## Files Involved

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `frontend/package.json` | Added `test`, `test:watch`, `format`, `format:check` scripts |
| `frontend/vite.config.ts` | Added Vitest config (jsdom environment, setup file) |
| `frontend/src/test/setup.ts` | Imports jest-dom matchers for Vitest |
| `frontend/src/App.test.tsx` | Smoke test — renders App and checks heading |
| `frontend/.prettierignore` | Excludes generated files from Prettier |
| `backend/pyproject.toml` | Ruff lint and format rules |
| `backend/pytest.ini` | Django settings module for pytest |
| `backend/tests/test_health.py` | Smoke tests — settings check and admin page |
| `backend/requirements.txt` | Added `ruff` |

## How It Works

### Frontend CI checks

| Step | Command | What it checks |
|---|---|---|
| Lint | `npm run lint` | ESLint rules across all `.ts` and `.tsx` files |
| Format check | `npm run format:check` | Prettier formatting (fails if any file is unformatted) |
| Test | `npm run test` | Runs all Vitest tests once in CI mode |
| Build | `npm run build` | TypeScript compilation + Vite production build |

### Backend CI checks

| Step | Command | What it checks |
|---|---|---|
| Lint | `ruff check .` | Pyflakes, pycodestyle, isort, Django-specific rules |
| Format check | `ruff format --check .` | Code formatting (like `black --check`) |
| Migrate | `python manage.py migrate` | All migrations apply cleanly against a real PostgreSQL |
| System check | `python manage.py check` | Django configuration and model validity |
| Test | `pytest` | All tests in `backend/tests/` and any app `test_*.py` files |

### Why PostgreSQL in backend CI

The backend CI job spins up a real PostgreSQL 16 container as a service. This is intentional:

- Migrations are tested against the real database engine, not SQLite
- Database-specific constraints (e.g. `UniqueConstraint`) are properly enforced
- Future JSON field queries, indexes, and raw SQL will only work correctly on PostgreSQL
- Testing against SQLite would give false confidence — bugs would only surface in production

## How To Run Locally

**Frontend:**

```bash
cd frontend
npm install

npm run lint          # ESLint
npm run format:check  # Prettier check (read-only)
npm run format        # Prettier fix (auto-formats)
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
npm run build         # Production build
```

**Backend:**

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt

ruff check .              # Lint
ruff format --check .     # Format check (read-only)
ruff format .             # Auto-format

python manage.py migrate
python manage.py check
pytest
```

## Important Decisions

**Ruff over flake8 + black + isort:** Ruff replaces three separate tools with one extremely fast Rust-based tool. It enforces the same rules but runs in milliseconds instead of seconds.

**Vitest over Jest:** Vitest is Vite-native — it shares the same configuration and transformation pipeline as the dev server. No separate Babel or ts-jest setup required.

**`DJANGO_DEBUG=False` in CI:** CI runs with DEBUG off to catch any issues that only appear in production mode (e.g. ALLOWED_HOSTS enforcement, static file handling). Tests that need to override this use pytest-django's `settings` fixture.

**Two separate CI jobs:** Frontend and backend checks run in parallel, so a frontend failure does not block the backend job and vice versa. Total CI time is determined by whichever job takes longer, not the sum of both.

## Future Notes

- CD (deployment) will be added in a separate workflow file — this file stays CI-only
- Docker image building and publishing to a registry will be a separate job
- End-to-end tests (Playwright or Cypress) may be added once the API and frontend are more connected
- Coverage reports (`pytest --cov`, `vitest --coverage`) may be added and published as PR comments
- Redis and Celery CI services will be added when background jobs are introduced
