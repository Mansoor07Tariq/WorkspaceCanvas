# 019 — Frontend UI System Foundation

## Purpose

Establishes the complete frontend UI system: installs MUI as the component library, defines the shared design theme, builds a reusable shared component layer, introduces generic hooks and infrastructure utilities, and implements the signup page end-to-end. All future features build on top of this foundation without needing to re-solve layout, form state, error handling, or component patterns.

## What Was Added

### MUI and theme

- MUI 9 installed: `@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`
- `src/theme/theme.ts` — single app-wide MUI theme: blue primary (`#2563EB`), slate background (`#F1F5F9`), Inter typography, 8px base border radius, component overrides for Button, TextField, Card, and Alert
- `AppThemeProvider` — wraps the entire app in `ThemeProvider` + `CssBaseline`
- `src/styles/globals.css` — full-height `html/body/#root` and `box-sizing: border-box`

### Shared component layer

- `src/components/ui/FormTextField.tsx` — stateless labelled text/email input; `role="alert"` on error helper text
- `src/components/ui/PasswordField.tsx` — password input that owns its own show/hide visibility state internally
- `src/components/ui/LoadingButton.tsx` — contained MUI button with `CircularProgress` spinner; uses `children`, not a `label` prop
- `src/components/layout/CenteredPageLayout.tsx` — full-viewport centered wrapper for auth pages and single-card layouts
- `src/components/feedback/ErrorAlert.tsx` — renders `Alert severity="error"` when `message` is truthy, `null` otherwise
- `src/components/feedback/SuccessAlert.tsx` — same pattern, `severity="success"`

### Generic hooks

- `src/hooks/useForm.ts` — generic all-string form field state (`fields`, `setField`, `reset`); used by every feature form hook
- `src/hooks/useAsync.ts` — idle/loading/success/error state machine for async operations; errors are pre-processed through `getApiErrorMessage`

### Infrastructure

- `src/lib/validation/email.ts` + `index.ts` — `isValidEmail` shared across all features; always import from `@/lib/validation`
- `src/config/brand.ts` — `BRAND_NAME = "WorkspaceCanvas"` constant; never hardcode the product name
- `src/routes/paths.ts` — `ROUTES` constant for all app paths (`signup`, `login`, `mfaChallenge`, `app`); used in router definitions, links, and `navigate()` calls; `/app` is a placeholder for the post-login destination
- `vite.config.ts` — `@/` path alias resolving to `src/`
- `tsconfig.app.json` — `paths: { "@/*": ["./src/*"] }` for TypeScript; excludes test files
- `tsconfig.test.json` — extends `tsconfig.app.json`; covers test files; adds `@testing-library/jest-dom` to `types` so IDE type-checks `toBeInTheDocument` and all jest-dom matchers correctly
- `vitest.config.ts` — `mergeConfig(viteConfig, ...)` so Vitest 4 inherits the alias; replaces the previous standalone config

### Auth feature

- `src/features/auth/components/AuthCard.tsx` — auth-specific card: `maxWidth: 448`, `borderRadius: 16px`, `padding: 32px`
- `src/features/auth/hooks/useSignupForm.ts` — all signup form logic: field state via `useForm`, submission state, validation, API call, error routing
- `src/features/auth/styles/auth.styles.ts` — all `SxProps<Theme>` objects for auth components and pages; no inline `sx` in JSX
- `src/features/auth/index.ts` — public barrel: exports `SignupPage`, API functions, API types, and auth utils; internal files are not exported
- `src/features/auth/pages/SignupPage.tsx` — thin composition: calls `useSignupForm`, renders success state or form state using shared components and named sx objects
- `src/i18n/en.ts` — all user-visible strings including field labels and placeholders (`en.auth.fields.*`); login and all future auth forms reuse `auth.fields.email` and `auth.fields.password` without duplication
- `FRONTEND.md` — full architecture guide: directory structure, file-by-file documentation, conventions, and "How to Add a New Feature" checklist

### Tests

- `src/features/auth/__tests__/SignupPage.test.tsx` — 8 tests covering render, validation, submission, success state, API errors, and loading state
- `src/features/auth/__tests__/authApi.test.ts` — 14 tests, one per API function
- `src/features/auth/__tests__/authErrorUtils.test.ts` — 7 tests for field error extraction
- `src/features/auth/__tests__/authUtils.test.ts` — type guard tests
- `src/features/auth/__tests__/signupValidation.test.ts` — validation unit tests
- `src/lib/__tests__/apiClient.test.ts` — 12 tests covering URL construction, auth headers, JSON body, 204 handling, and `ApiError`
- `src/lib/__tests__/tokenStorage.test.ts` — 9 tests covering all four token storage methods

**Total: 72 tests across 7 suites — all passing.**

## Key Decisions

**Shared UI layer, not auth-specific components** — `FormTextField`, `PasswordField`, `LoadingButton`, `CenteredPageLayout`, `ErrorAlert`, and `SuccessAlert` live in `components/`, not inside `features/auth/`. Every future feature uses them directly without copying.

**`PasswordField` is separate from `FormTextField`** — `PasswordField` owns its own `visible: boolean` state internally. Merging them into one component via a `type="password"` prop would push visibility state into the parent, which is the wrong owner.

**`useForm` + feature-specific hook** — `useForm` handles all-string field state generically. `useSignupForm` owns signup-specific submission state, validation logic, and API wiring. There is no shared `useAuthForm` — login, MFA, and other forms will have different rules and different hooks.

**Styles extracted to `auth.styles.ts`** — all `SxProps<Theme>` objects are named and exported from a single file. No inline `sx` in pages or components (except `CenteredPageLayout`, which has no feature context). Keeps pages readable and styles auditable.

**Path alias `@/`** — all cross-folder imports use `@/` (resolves to `src/`). Within-feature imports stay relative. Vitest 4 requires a separate `vitest.config.ts` using `mergeConfig` — it does not inherit `resolve.alias` from `vite.config.ts` automatically.

**MUI 9 constraints** — shorthand system props (`<Box display="flex">`) are removed in MUI 9; all styles go inside `sx`. Password toggle and helper text role use the `slotProps` API.

**RouterLink with inline `style`** — navigation links in `SignupPage` use `react-router-dom`'s `Link` directly with inline `style` prop, avoiding a composed MUI+Router link component that is out of scope for this PR.

## Files Involved

**New files:**

- `src/theme/theme.ts`
- `src/app/providers/AppThemeProvider.tsx`
- `src/styles/globals.css`
- `src/components/ui/FormTextField.tsx`
- `src/components/ui/PasswordField.tsx`
- `src/components/ui/LoadingButton.tsx`
- `src/components/layout/CenteredPageLayout.tsx`
- `src/components/feedback/ErrorAlert.tsx`
- `src/components/feedback/SuccessAlert.tsx`
- `src/hooks/useForm.ts`
- `src/hooks/useAsync.ts`
- `src/lib/validation/email.ts`
- `src/lib/validation/index.ts`
- `src/config/brand.ts`
- `src/routes/paths.ts`
- `src/features/auth/components/AuthCard.tsx`
- `src/features/auth/hooks/useSignupForm.ts`
- `src/features/auth/styles/auth.styles.ts`
- `src/features/auth/types/signup.types.ts`
- `src/features/auth/index.ts`
- `src/features/auth/__tests__/SignupPage.test.tsx`
- `src/features/auth/__tests__/signupValidation.test.ts`
- `src/lib/__tests__/apiClient.test.ts`
- `src/lib/__tests__/tokenStorage.test.ts`
- `vitest.config.ts`
- `tsconfig.test.json`
- `FRONTEND.md`

**Modified files:**

- `package.json` — MUI and emotion dependencies added
- `vite.config.ts` — `@/` path alias
- `tsconfig.app.json` — `paths` for TypeScript alias (`baseUrl` removed — deprecated in TS 6)
- `src/main.tsx` — imports `globals.css`
- `src/app/App.tsx` — wraps router in `AppThemeProvider`
- `src/app/router/AppRouter.tsx` — uses `ROUTES` constants
- `src/features/auth/pages/SignupPage.tsx` — full implementation using shared components and `useSignupForm`
- `src/features/auth/utils/signupValidation.ts` — imports `isValidEmail` from `@/lib/validation`
- `src/features/auth/__tests__/authApi.test.ts` — updated to `@/` imports
- `src/features/auth/__tests__/authErrorUtils.test.ts` — updated to `@/` imports
- `src/features/auth/__tests__/authUtils.test.ts` — updated to `@/` imports

## What Was Not Changed

- No login, email verification, or MFA UI added
- No auth state management (no `AuthContext` or Zustand)
- No protected routes
- No backend changes
- No office map or editor UI touched
