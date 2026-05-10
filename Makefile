SHELL := /bin/bash

VENV    := backend/.venv
PYTHON  := $(VENV)/bin/python
RUFF    := $(VENV)/bin/ruff
PYTEST  := $(VENV)/bin/python -m pytest
PRE_COMMIT := $(VENV)/bin/python -m pre_commit

.PHONY: help \
        frontend backend \
        backend-docker-build backend-docker-up backend-docker-serve backend-docker-down backend-docker-logs \
        frontend-docker-build frontend-docker-up frontend-docker-serve frontend-docker-down frontend-docker-logs \
        migrate makemigrations superuser \
        backend-check backend-lint backend-format backend-format-check backend-test \
        frontend-lint frontend-format frontend-format-check frontend-test frontend-build \
        lint format format-check test ci \
        precommit-install precommit-run

# ─── Help ───────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "WorkspaceCanvas developer commands"
	@echo ""
	@echo "  Development"
	@echo "    make frontend               Run Vite dev server"
	@echo "    make backend                Run Django dev server"
	@echo ""
	@echo "  Backend Docker"
	@echo "    make backend-docker-build   Build backend Docker images"
	@echo "    make backend-docker-up      Start backend + PostgreSQL in background"
	@echo "    make backend-docker-serve   Start backend + PostgreSQL with logs"
	@echo "    make backend-docker-down    Stop backend Docker services"
	@echo "    make backend-docker-logs    Follow backend Docker logs"
	@echo ""
	@echo "  Frontend Docker"
	@echo "    make frontend-docker-build  Build frontend Docker image"
	@echo "    make frontend-docker-up     Start frontend in background"
	@echo "    make frontend-docker-serve  Start frontend with logs"
	@echo "    make frontend-docker-down   Stop frontend Docker services"
	@echo "    make frontend-docker-logs   Follow frontend Docker logs"
	@echo ""
	@echo "  Database"
	@echo "    make migrate                Run Django migrations"
	@echo "    make makemigrations         Generate new Django migrations"
	@echo "    make superuser              Create a Django superuser"
	@echo ""
	@echo "  Backend quality"
	@echo "    make backend-check          Run Django system check"
	@echo "    make backend-lint           Ruff lint"
	@echo "    make backend-format         Ruff auto-format"
	@echo "    make backend-format-check   Ruff format check (read-only)"
	@echo "    make backend-test           Run pytest"
	@echo ""
	@echo "  Frontend quality"
	@echo "    make frontend-lint          ESLint"
	@echo "    make frontend-format        Prettier auto-format"
	@echo "    make frontend-format-check  Prettier check (read-only)"
	@echo "    make frontend-test          Run Vitest"
	@echo "    make frontend-build         Production build"
	@echo ""
	@echo "  Combined"
	@echo "    make lint                   Backend + frontend lint"
	@echo "    make format                 Backend + frontend auto-format"
	@echo "    make format-check           Backend + frontend format check"
	@echo "    make test                   Backend + frontend tests"
	@echo "    make ci                     Run all CI checks locally"
	@echo ""
	@echo "  Pre-commit"
	@echo "    make precommit-install      Install pre-commit hooks"
	@echo "    make precommit-run          Run all pre-commit hooks manually"
	@echo ""

# ─── Development ────────────────────────────────────────────────────────────────

frontend:
	cd frontend && npm run dev

backend:
	cd backend && $(CURDIR)/$(PYTHON) manage.py runserver

# ─── Docker ─────────────────────────────────────────────────────────────────────

backend-docker-build:
	cd backend && docker compose build

backend-docker-up:
	cd backend && docker compose up -d

backend-docker-serve:
	cd backend && docker compose up

backend-docker-down:
	cd backend && docker compose down

backend-docker-logs:
	cd backend && docker compose logs -f

frontend-docker-build:
	cd frontend && docker compose build

frontend-docker-up:
	cd frontend && docker compose up -d

frontend-docker-serve:
	cd frontend && docker compose up

frontend-docker-down:
	cd frontend && docker compose down

frontend-docker-logs:
	cd frontend && docker compose logs -f

# ─── Database ───────────────────────────────────────────────────────────────────

migrate:
	cd backend && $(CURDIR)/$(PYTHON) manage.py migrate

makemigrations:
	cd backend && $(CURDIR)/$(PYTHON) manage.py makemigrations

superuser:
	cd backend && $(CURDIR)/$(PYTHON) manage.py createsuperuser

# ─── Backend quality ────────────────────────────────────────────────────────────

backend-check:
	cd backend && $(CURDIR)/$(PYTHON) manage.py check

backend-lint:
	cd backend && $(CURDIR)/$(RUFF) check .

backend-format:
	cd backend && $(CURDIR)/$(RUFF) format .

backend-format-check:
	cd backend && $(CURDIR)/$(RUFF) format --check .

backend-test:
	cd backend && POSTGRES_HOST=localhost $(CURDIR)/$(PYTEST)

# ─── Frontend quality ───────────────────────────────────────────────────────────

frontend-lint:
	cd frontend && npm run lint

frontend-format:
	cd frontend && npm run format

frontend-format-check:
	cd frontend && npm run format:check

frontend-test:
	cd frontend && npm run test

frontend-build:
	cd frontend && npm run build

# ─── Combined quality ───────────────────────────────────────────────────────────

lint: backend-lint frontend-lint

format: backend-format frontend-format

format-check: backend-format-check frontend-format-check

test: backend-test frontend-test

# ─── CI ─────────────────────────────────────────────────────────────────────────

ci: backend-lint backend-format-check backend-check backend-test \
    frontend-lint frontend-format-check frontend-test frontend-build

# ─── Pre-commit ─────────────────────────────────────────────────────────────────

precommit-install:
	$(CURDIR)/$(PRE_COMMIT) install

precommit-run:
	$(CURDIR)/$(PRE_COMMIT) run --all-files
