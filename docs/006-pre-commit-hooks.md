# 006 — Pre-commit Hooks

## Purpose

Pre-commit hooks run automatically every time you run `git commit`. They catch lint errors and formatting issues locally before code reaches GitHub, so CI failures from simple style problems are avoided entirely.

Pre-commit is intentionally fast — it only runs static checks. Tests, builds, and migrations are left to CI.

## What Was Added

- `.pre-commit-config.yaml` — hook configuration at the repository root
- `frontend/.prettierrc` — Prettier formatting rules
- `frontend/.prettierignore` — updated to include `build` and `coverage`
- `pre-commit` added to `backend/requirements.txt`

## Files Involved

| File | Purpose |
|---|---|
| `.pre-commit-config.yaml` | Defines all hooks that run before each commit |
| `frontend/.prettierrc` | Prettier formatting configuration |
| `frontend/.prettierignore` | Files Prettier skips |
| `backend/requirements.txt` | Includes `pre-commit` for installation via pip |

## What Runs Before Every Commit

### General file checks

| Hook | What it checks |
|---|---|
| `trailing-whitespace` | Removes trailing spaces from all files |
| `end-of-file-fixer` | Ensures files end with a single newline |
| `check-yaml` | Validates YAML syntax |
| `check-json` | Validates JSON syntax |
| `check-added-large-files` | Blocks files over 500KB from being committed |
| `check-merge-conflict` | Catches unresolved merge conflict markers |
| `debug-statements` | Catches `pdb`, `breakpoint()`, etc. left in Python code |

### Backend Python checks (Ruff)

| Hook | What it checks |
|---|---|
| `ruff` | Linting — pyflakes, pycodestyle, isort, Django rules |
| `ruff-format` | Formatting — equivalent to `black --check` |

Targets only files under `backend/`.

### Frontend checks

| Hook | What it checks |
|---|---|
| `frontend-eslint` | ESLint across all `.ts` and `.tsx` files |
| `frontend-prettier-check` | Prettier formatting check |

Triggered only when files under `frontend/` are staged.

## What Does NOT Run in Pre-commit

Pre-commit intentionally skips these:

| Check | Where it runs instead |
|---|---|
| Backend tests (`pytest`) | CI — `backend` job |
| Frontend tests (`vitest`) | CI — `frontend` job |
| Django migrations (`manage.py migrate`) | CI — `backend` job |
| Frontend production build (`npm run build`) | CI — `frontend` job |

Running tests and builds before every commit would make the commit flow too slow. Pre-commit is for instant feedback on style and static errors only.

## How to Install

**Step 1 — install Python dependencies:**

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

**Step 2 — install the Git hook:**

```bash
pre-commit install
```

This writes the hook into `.git/hooks/pre-commit`. It only needs to be done once per clone of the repo.

## How to Run All Hooks Manually

```bash
pre-commit run --all-files
```

This runs every hook against every file in the repository. Useful for checking the full codebase after pulling changes or to verify the setup works.

## Normal Commit Flow

```bash
git add .
git commit -m "Your message"
```

Hooks run automatically on the staged files. If any hook fails, the commit is aborted. Fix the reported issues, re-stage, and commit again.

## Emergency Bypass

```bash
git commit --no-verify -m "Your message"
```

`--no-verify` skips all pre-commit hooks entirely.

**Only use this in genuine emergencies** — for example, if you need to commit a hotfix and a hook is broken due to a tool version mismatch. Do not use it to avoid fixing real lint or formatting errors. CI will still catch those and block the PR.

## Future Notes

- As new languages or tools are added to the project, their hooks should be added to `.pre-commit-config.yaml`
- Hook revisions (`rev:`) should be updated periodically to stay on current tool versions
- A `pre-commit autoupdate` command can bump all hook revisions automatically
