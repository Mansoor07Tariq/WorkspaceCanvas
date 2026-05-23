# 018 — Signup UI

## Purpose

This PR adds the first frontend auth screen: the signup page. It introduces a reusable auth layout, a suite of accessible form components, client-side validation, API integration with the existing signup endpoint, and a success state that tells the user to check their email. It does not add login, email verification, MFA, or any auth state management — those come in later PRs.

## What Was Added

- `/signup` route served by `SignupPage`
- Catch-all `*` route that redirects to `/signup` (placeholder until more routes exist)
- Reusable auth UI components: `AuthLayout`, `AuthCard`, `AuthTextField`, `AuthPasswordField`, `AuthSubmitButton`
- `getApiErrorMessage` helper for extracting human-readable messages from `ApiError`
- Client-side form validation (email format, password length, confirm-password match)
- API integration via `authApi.signup()` — no tokens stored, no navigation on success
- Success state showing the submitted email and a "Back to sign in" link
- Field-level and general error display from backend responses
- 8 Vitest + React Testing Library tests covering the full signup flow
- Explicit `afterEach(cleanup)` in the global test setup to ensure DOM resets between tests
- `src/app/App.tsx` and `src/app/router/AppRouter.tsx` replacing the old placeholder `App.tsx`
- Old placeholder files deleted: `src/App.tsx`, `src/App.test.tsx`, `src/App.css`
- `react-router-dom` confirmed installed (was already present from earlier setup)

## Files Involved

**New files:**

- `src/app/App.tsx` — root component, renders `AppRouter`
- `src/app/router/AppRouter.tsx` — `BrowserRouter` + `Routes` with `/signup` and catch-all
- `src/features/auth/pages/SignupPage.tsx` — signup page with form, validation, API call, and success/error states
- `src/features/auth/components/AuthLayout.tsx` — full-page centered wrapper
- `src/features/auth/components/AuthCard.tsx` — white card with shadow
- `src/features/auth/components/AuthTextField.tsx` — text/email input with label and inline error
- `src/features/auth/components/AuthPasswordField.tsx` — password input with show/hide toggle
- `src/features/auth/components/AuthSubmitButton.tsx` — submit button with loading spinner
- `src/lib/api/getApiErrorMessage.ts` — extracts `detail` or `non_field_errors` from `ApiError`
- `src/features/auth/__tests__/SignupPage.test.tsx` — 8 tests for the signup page

**Modified files:**

- `src/main.tsx` — updated import from `./App` to `./app/App`
- `src/test/setup.ts` — added `afterEach(cleanup)` from `@testing-library/react`

**Deleted files:**

- `src/App.tsx` — old placeholder
- `src/App.test.tsx` — old placeholder test
- `src/App.css` — orphaned stylesheet

## How It Works

1. User navigates to `/signup`.
2. `AppRouter` renders `SignupPage` inside `BrowserRouter`.
3. `SignupPage` manages form state for `fullName`, `email`, `password`, and `confirmPassword`.
4. On submit, client-side validation runs first. If any field is invalid, errors are displayed inline and the API is not called.
5. If validation passes, `authApi.signup()` is called with `{ email, password, full_name? }`. The `full_name` field is omitted if the user leaves it blank.
6. On success, the form is replaced with a success panel showing the submitted email address. No tokens are stored and the user is not redirected to a dashboard.
7. On failure, `ApiError` field errors (`email`, `password`, `full_name`) are shown inline. General errors (`detail`, `non_field_errors`) are shown in an alert above the form.
8. The email verification page is a separate PR. The "Back to sign in" link points to `/login`, which is also a future PR.

## Validation Rules

| Field            | Rule                                                             |
| ---------------- | ---------------------------------------------------------------- |
| Full name        | Optional. Maximum 255 characters.                               |
| Email            | Required. Must match a basic email format (`x@x.x`).           |
| Password         | Required. Minimum 8 characters.                                 |
| Confirm password | Required. Must match the password field exactly.                |

## What Is Not Included Yet

- Login UI — next PR
- Email verification UI
- MFA challenge UI
- Google / Microsoft social login buttons
- Protected routes / route guards
- `AuthContext` or Zustand auth state
- Dashboard or any post-login page
- Backend changes of any kind

## How To Run / Test

```bash
cd frontend
npm run lint
npm run format:check
npm run test
npm run build
```

To start the dev server and open `/signup` in a browser:

```bash
cd frontend
npm run dev
# open http://localhost:5173/signup
```
