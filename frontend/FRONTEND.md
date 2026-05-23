# WorkspaceCanvas — Frontend Architecture

## Stack

| Tool                  | Version | Purpose                                                 |
| --------------------- | ------- | ------------------------------------------------------- |
| React                 | 19      | UI rendering                                            |
| TypeScript            | 5       | Type safety — strict mode                               |
| Vite                  | 8       | Dev server and bundler                                  |
| MUI (Material UI)     | 9       | Component system and design tokens                      |
| Emotion               | latest  | CSS-in-JS engine used by MUI                            |
| React Router          | 7       | Client-side routing                                     |
| Tailwind CSS          | 4       | Available but unused — MUI `sx` is used for all styling |
| Vitest                | 4       | Unit and integration tests                              |
| React Testing Library | latest  | DOM-based component testing                             |

---

## Directory Structure

```
frontend/
  src/
    app/                        # Bootstrap layer — wires everything together
      App.tsx                   # Root component: AppThemeProvider > AppRouter
      providers/
        AppThemeProvider.tsx    # Wraps the app in MUI ThemeProvider + CssBaseline
      router/
        AppRouter.tsx           # BrowserRouter + all top-level Routes

    components/                 # Shared UI — not tied to any feature
      feedback/
        ErrorAlert.tsx          # Error Alert wrapper — renders null when message is falsy
        SuccessAlert.tsx        # Success Alert wrapper — renders null when message is falsy
      layout/
        CenteredPageLayout.tsx  # Full-viewport centered layout (auth pages, 404, etc.)
      ui/
        FormTextField.tsx       # Labelled text/email input with inline error display
        PasswordField.tsx       # Password input with show/hide toggle — owns its own visibility state
        LoadingButton.tsx       # Contained MUI button with spinner, uses children

    config/
      brand.ts                  # BRAND_NAME constant — single source of truth for the product name
      env.ts                    # VITE_API_BASE_URL with localhost fallback

    routes/
      paths.ts                  # ROUTES constant — all app paths in one place

    features/                   # One folder per product domain
      auth/                     # Everything related to authentication
        __tests__/
          SignupPage.test.tsx   # Full signup flow tests (8 tests)
          authApi.test.ts       # authApi unit tests
          authErrorUtils.test.ts
          authUtils.test.ts
          signupValidation.test.ts
        api/
          authApi.ts            # All auth API calls (signup, login, MFA, social, etc.)
          authEndpoints.ts      # Auth URL constants — single source of truth
        components/
          AuthCard.tsx          # Auth-specific card: max-width 448, 16px radius, p-4
        hooks/
          useSignupForm.ts      # Signup form state + submit logic (uses useForm)
        pages/
          SignupPage.tsx        # Routed page — composes layout, card, fields, hook
        styles/
          auth.styles.ts        # All sx objects for auth components and signup page
        types/
          auth.types.ts         # All API request/response types for the auth domain
          signup.types.ts       # SignupFieldErrors type
        utils/
          authErrorUtils.ts     # extractSignupFieldErrors — maps ApiError to field errors
          authUtils.ts          # isMfaRequiredResponse, isLoginSuccessResponse type guards
          signupValidation.ts   # validateSignupForm, validatePasswordConfirmation
        index.ts                # Public barrel: SignupPage, authApi functions, auth types, authUtils

    hooks/                      # Generic hooks — reusable across all features
      useAsync.ts               # Async state machine: idle → loading → success | error
      useForm.ts                # Generic all-string form field state: fields, setField, reset

    i18n/
      en.ts                     # All user-facing strings — single source of truth

    lib/                        # Infrastructure — framework-agnostic utilities
      api/
        apiClient.ts            # Low-level fetch wrapper (api.get/post/patch/delete)
        apiError.ts             # ApiError class: wraps HTTP errors with status + data
        getApiErrorMessage.ts   # Extracts human-readable string from any error
        types.ts                # RequestOptions interface
      validation/
        email.ts                # isValidEmail — shared email format check
        index.ts                # Barrel — import from @/lib/validation, not from sub-files directly
      tokenStorage.ts           # localStorage wrapper for access/refresh JWT tokens

    styles/
      globals.css               # Base resets: full-height html/body/#root, box-sizing

    test/
      setup.ts                  # Vitest setup: jest-dom matchers + RTL afterEach cleanup
                                # (types provided via tsconfig.test.json, not tsconfig.app.json)

    theme/
      theme.ts                  # MUI createTheme: palette, typography, shape, component overrides

    main.tsx                    # Entry point: mounts App into #root, imports global CSS
    index.css                   # Tailwind v4 import (kept but not actively used)
    vite-env.d.ts               # Vite client type declarations
```

---

## Files in Detail

### `src/main.tsx`

Entry point. Imports `globals.css` and `index.css`, then mounts `<App />` inside `StrictMode`.

### `src/app/App.tsx`

Root component. Wraps the router in the theme provider. Nothing else lives here.

```tsx
<AppThemeProvider>
  <AppRouter />
</AppThemeProvider>
```

### `src/app/providers/AppThemeProvider.tsx`

Provides the MUI theme and `CssBaseline` to the entire app. `CssBaseline` applies MUI's HTML reset (margin: 0, box-sizing, etc.).

### `src/app/router/AppRouter.tsx`

Defines all top-level routes. Imports pages from their feature barrels (`features/auth`), not from deep internal paths.

```tsx
<Route path={ROUTES.signup} element={<SignupPage />} />
<Route path="*" element={<Navigate to={ROUTES.signup} replace />} />
```

---

### `src/theme/theme.ts`

The single MUI theme for the entire app. Defines:

| Section                      | Values                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| `palette.primary`            | `#2563EB` (blue)                                                  |
| `palette.error`              | `#DC2626` (red)                                                   |
| `palette.success`            | `#16A34A` (green)                                                 |
| `palette.background.default` | `#F1F5F9` (slate-100)                                             |
| `palette.background.paper`   | `#FFFFFF`                                                         |
| `palette.text.primary`       | `#0F172A` (slate-900)                                             |
| `palette.text.secondary`     | `#64748B` (slate-500)                                             |
| `typography.fontFamily`      | Inter, system-ui, -apple-system                                   |
| `shape.borderRadius`         | 8px                                                               |
| `MuiButton`                  | disableElevation, no textTransform, large = 10px vertical padding |
| `MuiTextField`               | outlined, size small, fullWidth by default                        |
| `MuiCard`                    | 16px borderRadius, subtle shadow                                  |
| `MuiAlert`                   | 8px borderRadius                                                  |

---

### `src/styles/globals.css`

Two rules only:

- `html, body, #root { height: 100% }` — ensures full-height layouts work
- `box-sizing: border-box` on everything

### `src/config/env.ts`

```ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
```

All environment variables read from one place.

### `src/routes/paths.ts`

```ts
export const ROUTES = {
  signup: "/signup",
  login: "/login",
  mfaChallenge: "/mfa-challenge",
} as const;
```

Single source of truth for all app paths. Used in `AppRouter.tsx` for route definitions, in pages for `<Link to={ROUTES.login}>`, and in hooks for `navigate(ROUTES.app)`. Never hardcode a path string anywhere else. `ROUTES.app` (`/app`) is a placeholder for the post-login destination — the login flow will need it.

### `src/config/brand.ts`

```ts
export const BRAND_NAME = "WorkspaceCanvas";
```

Single source of truth for the product name. Use this instead of hardcoding the string anywhere.

---

### `src/lib/api/apiClient.ts`

Low-level HTTP client. Wraps `fetch`, attaches `Authorization: Bearer <token>` by default (skipped when `auth: false`), throws `ApiError` on non-2xx responses, handles 204 No Content.

```ts
api.get<ResponseType>(path, options?)
api.post<ResponseType, BodyType>(path, body?, options?)
api.patch<ResponseType, BodyType>(path, body?, options?)
api.delete<ResponseType>(path, options?)
```

### `src/lib/api/apiError.ts`

```ts
class ApiError extends Error {
  status: number; // HTTP status code
  data: unknown; // parsed JSON body
}
```

Thrown by `apiClient`. Caught by feature-level error handlers.

### `src/lib/api/getApiErrorMessage.ts`

Converts any error to a display string. Checks `error.data.detail` and `error.data.non_field_errors[0]` before falling back to `en.common.somethingWentWrong`. Used by `useAsync` and feature hooks.

### `src/lib/tokenStorage.ts`

`localStorage` wrapper for JWT tokens. Keys are namespaced: `workspacecanvas.accessToken` / `workspacecanvas.refreshToken`. Four methods: `getAccessToken`, `getRefreshToken`, `setTokens`, `clearTokens`.

### `src/lib/validation/email.ts`

```ts
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
```

Shared email format check. Used by `signupValidation.ts` and will be used by login validation. Lives here so it is not tied to any single feature.

Always import via the barrel (`@/lib/validation`), not from `@/lib/validation/email` directly. When new validators are added (password strength, URL format, etc.), they are added to `email.ts` siblings and re-exported from `index.ts`.

---

### `src/hooks/useForm.ts`

Generic hook for managing all-string form field state.

```ts
const { fields, setField, reset } = useForm({ email: "", password: "" });
setField("email", "jane@example.com");
```

- `fields` — current values object, same shape as initial
- `setField(name, value)` — updates a single field
- `reset()` — restores to initial values

### `src/hooks/useAsync.ts`

Generic hook for any async operation with loading/success/error states.

```ts
const { status, data, error, execute, reset } = useAsync<MyResponseType>();
execute(() => api.get("/some/endpoint"));
```

State transitions: `idle → loading → success | error`. The `error` string is already processed through `getApiErrorMessage`. Use this for data fetching and simple mutations that don't need per-field error handling.

---

### `src/components/feedback/ErrorAlert.tsx`

Renders a MUI `Alert` with `severity="error"` when `message` is truthy, `null` otherwise. The `mb: 2` bottom margin is built in — it always sits above a form or content block.

```tsx
<ErrorAlert message={submission.generalError} />
```

Props: `message: string | undefined`

Use this wherever a single general error string needs to be surfaced (form submissions, page-level API errors). Per-field errors stay in individual `FormTextField` / `PasswordField` components.

### `src/components/feedback/SuccessAlert.tsx`

Same pattern as `ErrorAlert` — renders a MUI `Alert` with `severity="success"` when `message` is truthy, `null` otherwise.

```tsx
<SuccessAlert message={updateResult} />
```

Props: `message: string | undefined`

Use for inline success confirmation within a page (profile saved, password changed, MFA enabled). Not for full-page success states that replace the form — those are page-specific and stay in the feature.

### `src/components/ui/FormTextField.tsx`

Stateless labelled text input. Wraps MUI `TextField`. Shows `role="alert"` on error helper text for accessibility. Use for `type="text"` or `type="email"` inputs.

Props: `id`, `label`, `type?`, `value`, `onChange`, `error?`, `disabled?`, `autoComplete?`, `placeholder?`

### `src/components/ui/PasswordField.tsx`

Password input that owns its own visibility toggle state. Not stateless — it manages `visible: boolean` internally. Shows a show/hide icon button in the end adornment. Use for any password input.

Props: `id`, `label`, `value`, `onChange`, `error?`, `disabled?`, `autoComplete?`

The separation from `FormTextField` is intentional: `PasswordField` has its own internal state (visibility) that is self-contained and belongs to the component, not the parent.

### `src/components/ui/LoadingButton.tsx`

Contained MUI button with a `CircularProgress` spinner shown during loading. Uses `children` (not a `label` prop) — standard React composition pattern.

```tsx
<LoadingButton loading={submission.loading}>Create account</LoadingButton>
<LoadingButton loading={isDeleting} type="button">Delete</LoadingButton>
```

Props: `children`, `loading`, `disabled?`, `type?` (default: `"submit"`)

### `src/components/layout/CenteredPageLayout.tsx`

Full-viewport centered wrapper. Background is `background.default` from the theme. Used for any page that needs a single centered card (auth pages, 404, maintenance).

```tsx
<CenteredPageLayout>
  <YourCard />
</CenteredPageLayout>
```

---

### `src/i18n/en.ts`

All user-visible strings. No hardcoded strings in components or hooks. Structure mirrors the domain: `en.auth.fields.*`, `en.auth.signup.*`, `en.auth.validation.*`, `en.common.*`.

`en.auth.fields.*` holds reusable field labels and placeholders (`email`, `password`, `fullName`, `confirmPassword`, `emailPlaceholder`, `fullNamePlaceholder`). Login and other auth forms import from here — never duplicate label strings.

When adding new strings: add to the appropriate namespace. When adding a new domain: add a new top-level key.

---

### `src/features/auth/`

#### `api/authEndpoints.ts`

All auth API paths as a `const` object. No magic strings anywhere else. When the backend URL changes, one file changes.

#### `api/authApi.ts`

One function per API endpoint. Each function calls `api.post/get` with the correct types and endpoint from `authEndpoints`. Annotated with `auth: false` for unauthenticated endpoints (signup, login, etc.).

#### `types/auth.types.ts`

All request and response types for the auth domain. Includes `CurrentUser`, `LoginResponse`, `MfaRequiredResponse`, `SignupRequest`, `SocialAuthResponse`, and all MFA management types.

#### `types/signup.types.ts`

```ts
type SignupFieldErrors = {
  full_name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};
```

#### `utils/authUtils.ts`

Type guard functions for discriminating union types in API responses:

- `isMfaRequiredResponse(response)` — checks if login returned an MFA challenge
- `isLoginSuccessResponse(response)` — inverse of above

#### `utils/signupValidation.ts`

Pure validation functions. No side effects. Returns `SignupFieldErrors`.

- `validateSignupForm(fullName, email, password)` — checks format, required, length; uses `isValidEmail` from `@/lib/validation`
- `validatePasswordConfirmation(password, confirmPassword)` — returns error string or `""`

#### `utils/authErrorUtils.ts`

Maps `ApiError.data` to `SignupFieldErrors`. Extracts `full_name`, `email`, `password` field errors from the Django REST Framework array format (`["error message"]`).

#### `components/AuthCard.tsx`

Auth-specific card: `maxWidth: 448`, `padding: 32px`, `borderRadius: 16px` (set in theme). Not a generic card — the `maxWidth` is intentionally auth-specific. All other pages use this same card for consistency across auth flows (signup, login, MFA, etc.).

#### `hooks/useSignupForm.ts`

The signup form's brain. Uses `useForm` for field state, manages submission state (`loading`, `success`, `submittedEmail`, `generalError`) in a single `SubmissionState` object. Runs validation, calls the API, routes errors to fields or to the general error slot.

Returns: `{ fields, setField, fieldErrors, submission, handleSubmit }`

#### `pages/SignupPage.tsx`

Pure composition. No logic. Calls `useSignupForm`, renders two states (success view, form view) using shared layout/UI components, feature components, and named sx objects from `auth.styles.ts`.

#### `styles/auth.styles.ts`

All `SxProps<Theme>` objects for the auth feature. Named after their role: `signupHeaderSx`, `signupFormSx`, `signupSuccessBoxSx`, etc. No inline sx objects in the page or components — they all live here.

#### `index.ts`

Public API for the auth feature. Other modules import from `features/auth`, never from deep paths inside it.

```ts
export { SignupPage } from "./pages/SignupPage";
export * from "./api/authApi";
export type * from "./types/auth.types";
export * from "./utils/authUtils";
```

Internal files (`authEndpoints`, `auth.styles`, validation helpers) are not exported — they are implementation details.

---

### `src/test/setup.ts`

Vitest global setup:

- Extends `expect` with `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeDisabled`, etc.)
- Registers `afterEach(cleanup)` — required because `globals: true` is not set in vitest config

---

## Conventions

### Path Aliases

All cross-folder imports use the `@/` alias, which resolves to `src/`:

```ts
import { en } from "@/i18n/en";
import { api } from "@/lib/api/apiClient";
import { FormTextField } from "@/components/ui/FormTextField";
import { SignupPage } from "@/features/auth";
```

- Within-feature imports stay relative (e.g. `../utils/signupValidation`)
- Any import that crosses a top-level folder boundary uses `@/`
- The alias is configured in both `vite.config.ts` (`resolve.alias`) and `tsconfig.app.json` (`paths`)
- Vitest picks up the alias via `vitest.config.ts` using `mergeConfig(viteConfig, ...)`
- Test files are type-checked by `tsconfig.test.json` (extends `tsconfig.app.json`, adds `@testing-library/jest-dom` to `types`); `tsconfig.app.json` excludes test files and does not include jest-dom types

### Styling

- All component styles use MUI `sx` prop
- `sx` objects are never inline in JSX — they are extracted to a `[feature].styles.ts` file and imported by name
- `CenteredPageLayout` is the only exception (its sx is internal to a layout component with no feature context)
- Theme tokens (`primary.main`, `background.default`, etc.) are preferred over hardcoded hex values in `sx`

### Imports

- Features are imported from their barrel (`features/auth`), not from internal paths
- Shared components are imported directly from `components/ui/` or `components/layout/`
- Type-only imports always use `import type`

### Strings

- No hardcoded user-visible strings in components or hooks — use `en.*`
- Error messages in validation utils also come from `en.auth.validation.*`
- The product name is always `BRAND_NAME` from `@/config/brand`, never a hardcoded string

### TypeScript

- `verbatimModuleSyntax: true` — type-only imports require `import type`
- `erasableSyntaxOnly: true` — no enums, no parameter properties
- `noUnusedLocals/Parameters: true` — no dead code

### Testing

- Tests live in `features/<feature>/__tests__/`
- Tests interact through the DOM (accessible queries: `getByLabelText`, `getByRole`, `getByText`)
- API calls are mocked at the module level with `vi.mock`
- `vi.mock` paths must match the `@/` alias used in the source file (e.g. `vi.mock("@/config/env", ...)`)
- No snapshot tests

---

## How to Add a New Feature

1. **Create the feature folder:**

   ```
   src/features/<feature>/
     __tests__/
     api/
       <feature>Api.ts
       <feature>Endpoints.ts
     components/
     hooks/
     pages/
     styles/
       <feature>.styles.ts
     types/
       <feature>.types.ts
     utils/
     index.ts
   ```

2. **Add API types** to `types/<feature>.types.ts`

3. **Add endpoint constants** to `api/<feature>Endpoints.ts`

4. **Add API functions** to `api/<feature>Api.ts` using `api.get/post/patch/delete`

5. **Add strings** to `src/i18n/en.ts` under a new namespace

6. **Build the hook** using `useForm` for field state, `useAsync` for simple fetches

7. **Build the page** — thin composition only, all logic in the hook

8. **Export from the barrel** in `index.ts`

9. **Add the route** in `AppRouter.tsx`, importing from `features/<feature>`

10. **Write tests** in `__tests__/` — test pages via the DOM, test utils as pure functions

---

## Environment Variables

| Variable            | Default                 | Description         |
| ------------------- | ----------------------- | ------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Django API base URL |

Set in `frontend/.env` (not committed). Copy from `.env.example` if it exists, otherwise create manually.
