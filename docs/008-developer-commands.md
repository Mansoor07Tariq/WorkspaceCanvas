# 008 — Developer Commands

## Purpose

The root `Makefile` provides a simple command layer for common development tasks. Instead of memorising long chains of `cd backend && source .venv/bin/activate && ...` commands, developers run short `make` commands from the repository root.

## What Was Added

- `Makefile` at the repository root with grouped commands for:
  - Local frontend and backend development servers
  - Docker-based development
  - Database migrations and superuser creation
  - Backend lint, format, and test
  - Frontend lint, format, and test
  - Combined lint / format / test / CI-style checks
  - Pre-commit hook installation and manual runs

## Files Involved

| File | Purpose |
|---|---|
| `Makefile` | All developer commands |
| `docs/008-developer-commands.md` | This document |
| `README.md` | Common Commands section added |

## How It Works

All commands are run from the **repository root**:

```bash
make help
make backend
make frontend
make ci
```

**Backend commands** assume:
- A virtual environment exists at `backend/.venv`
- Dependencies are installed: `pip install -r backend/requirements.txt`

**Frontend commands** assume:
- Dependencies are installed: `npm install` inside `frontend/`

## Common Commands

| Command | What it does |
|---|---|
| `make help` | Print all available commands |
| `make frontend` | Start the Vite dev server |
| `make backend` | Start the Django dev server |
| `make migrate` | Run Django migrations |
| `make makemigrations` | Generate new Django migrations |
| `make superuser` | Create a Django superuser |
| `make lint` | Run Ruff + ESLint |
| `make format` | Auto-format backend (Ruff) + frontend (Prettier) |
| `make format-check` | Check formatting without modifying files |
| `make test` | Run pytest + Vitest |
| `make ci` | Run all CI checks locally in sequence |
| `make precommit-install` | Install pre-commit Git hooks |
| `make precommit-run` | Run all pre-commit hooks against all files |

### Docker commands

Each service (backend, frontend) has five Docker commands that follow the same pattern:

| Command | What it does |
|---|---|
| `make backend-docker-build` | Build the backend Docker image |
| `make backend-docker-up` | Start backend + PostgreSQL in the background (detached) |
| `make backend-docker-serve` | Start backend + PostgreSQL in the foreground (with logs in terminal) |
| `make backend-docker-down` | Stop and remove backend Docker containers |
| `make backend-docker-logs` | Follow backend Docker logs (attach to running containers) |
| `make frontend-docker-build` | Build the frontend Docker image |
| `make frontend-docker-up` | Start frontend in the background (detached) |
| `make frontend-docker-serve` | Start frontend in the foreground (with logs in terminal) |
| `make frontend-docker-down` | Stop and remove frontend Docker containers |
| `make frontend-docker-logs` | Follow frontend Docker logs (attach to running containers) |

**When to use each:**

- `build` — Run once after cloning, or whenever `Dockerfile` or `requirements.txt` / `package.json` changes. Rebuilds the image layers.
- `up` — Everyday start. Starts containers in the background so the terminal is free. Use `logs` to watch output separately.
- `serve` — Alternative to `up` when you want logs streaming directly in the current terminal. Ctrl-C stops the containers.
- `down` — Clean shutdown. Stops containers and removes them. The PostgreSQL volume is preserved so data survives.
- `logs` — Attach to already-running containers to tail their output. Does not start or stop anything.

### CI command in detail

`make ci` runs these checks in order, stopping on the first failure:

1. `backend-lint` — Ruff lint
2. `backend-format-check` — Ruff format check
3. `backend-check` — Django system check
4. `backend-test` — pytest
5. `frontend-lint` — ESLint
6. `frontend-format-check` — Prettier check
7. `frontend-test` — Vitest
8. `frontend-build` — Vite production build

## Important Decisions

**Makefile as a lightweight task runner** — Make is available on every developer machine without installation. It keeps common commands in one place, versioned in the repository.

**Commands do not replace CI** — `make ci` mirrors what GitHub Actions runs, but CI remains the authoritative gate before merging. A passing `make ci` locally means the PR is very likely to pass in CI.

**Backend commands use direct venv binary paths** — Rather than activating the virtual environment with `source`, the Makefile calls binaries directly: `backend/.venv/bin/python`, `backend/.venv/bin/ruff`, etc. This avoids shell sourcing issues and works reliably in Make's non-interactive shell.

**SHELL is set to bash** — `SHELL := /bin/bash` ensures consistent behaviour across environments, since some Make defaults to `/bin/sh`.

## Future Notes

- Commands for Celery workers and Redis can be added when background jobs are introduced
- A `make mailpit` command can be added when local email testing is set up
- If the project moves from `venv` to `uv` or `poetry`, only the Makefile needs updating — all other docs and CI remain the same
- Production Docker commands (build image, push to registry) will be added in a separate deployment PR
