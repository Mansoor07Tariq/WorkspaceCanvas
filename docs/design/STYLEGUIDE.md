# WorkspaceCanvas — Styling Architecture (STYLEGUIDE)

The design system is **layered**. Each visual value has exactly one home, and lower layers
never reach past their remit. This keeps the whole app themable from one place and makes a
restyle a token edit, not a component sweep.

## The four layers

**Layer 0 — `frontend/src/theme/tokens.ts` (the only source of literals).**
Every colour hex, font-family string, and raw font-size / radius / shadow literal lives
here, under a **semantic name** (`pine`, `slate`, `amberDark`, `errorRed`, `fontSize.chip`,
`radius.card`, `shadow.card`, …). Nothing else in `frontend/src` may contain a colour hex,
a `fontFamily:` literal, or a string `fontSize:` literal. Also exported here: the
deterministic `avatarColor` / `initialsFromName` helpers and the `avatarPalette`.

**Layer 1 — `frontend/src/theme/theme.ts` (tokens → MUI).**
Maps the tokens onto MUI's `palette` / `typography` / `shape` slots, and defines
`components` `styleOverrides` / `variants` for every **repeated** visual (buttons, cards,
chips/pills, inputs, alerts) so components inherit the look with **no restyling at call
sites**. Reads only from `tokens.ts`.

**Layer 2 — co-located `X.styles.ts`.**
A component with non-trivial styling gets a sibling `X.styles.ts` that exports named
`SxProps<Theme>` objects (or `styled` pieces). Colours are expressed as **theme palette
keys** (`"text.secondary"`, `"primary.main"`, `"divider"`) where a slot exists, else as a
token import (`colorTokens.mintText`); typography as `fontSizeTokens.*` / `fontWeightTokens.*`
/ `fontTokens.*`; radii/shadows as `radiusTokens.*` / `shadowTokens.*`. The `.tsx` imports
these and stays **structural**.

**Layer 3 — inline `sx` in the `.tsx`.**
Allowed **only** for trivial local layout — flexbox, `gap`, alignment, `display`,
`minWidth`, breakpoints — expressed in `theme.spacing` units. **Never** colours,
typography, radii, or shadows inline. Anything visual moves to Layer 1 or 2.

## Machine enforcement

`eslint.config.js` adds a `no-restricted-syntax` block (wired into the existing
`npx eslint src` gate) that errors on, **everywhere under `src/` except `src/theme/`**:

- **hex colour literals** — `Literal[value=/#[0-9a-fA-F]{3,8}/]`
- **font-family literals** — `Property[key.name="fontFamily"] > Literal`
- **string font-size literals** — `Property[key.name="fontSize"] > Literal[value=/[a-zA-Z%]/]`

(The rule is a `no-restricted-syntax` block, not a plugin; its selectors + messages are the
spec.) This proves no new hex/font literal escapes the theme.

### Grandfathered (migration debt)

Pre-PR-079 files are `ignores`d in that ESLint block and must be migrated incrementally:

- **Canvas rendering** — `src/features/layoutObjects/**`,
  `src/features/bookings/utils/bookingCanvasUtils.ts`. Konva paints with **raw colour
  values**, not CSS; these are a legitimate Layer-0 exception (a future `canvasTokens` map
  could still centralise them).
- **Decorative** — `src/components/feedback/FullScreenTransition.tsx`.
- **Legacy rem-typography / monospace** — `src/features/{auth,teams,profile,offices,floors,desks,dashboard}/**`,
  `src/app/pages/FloorLayoutPage.tsx`. These predate the token scale; migrate their
  `fontSize: "0.7rem"`-style literals to `fontSizeTokens` when touched.

All **new** code (the PR 079 design system and anything added outside those dirs) is
enforced with no exceptions.

## Where PR 079's visuals live

- **Layer 1 (theme variants/overrides):** `MuiButton` (radius/weight/no-caps), `MuiCard`
  (radius + hairline border + the one card shadow), `MuiPaper` outlined border, `MuiChip`
  (weight), `MuiAlert` (radius), plus the Fraunces display typography on `h1–h4`.
- **Layer 2 (`.styles.ts`):** `PersonAvatar.styles.ts`, `AppSidebar.styles.ts`,
  `AppShell.styles.ts`, `BottomTabBar.styles.ts`, and the Today pieces
  (`TodayHeader.styles.ts`, `WeekStrip.styles.ts`, `NearYouPanel.styles.ts`,
  `FloorPills.styles.ts`, `WelcomeCard.styles.ts`, `AdminSetupBanner.styles.ts`,
  `TodayContent.styles.ts`). Each holds that component's colours/typography/radii/shadows;
  the `.tsx` keeps structure + Layer-3 layout only.

## Checklist for a new component

1. Need a colour/size/radius/shadow value? It already exists in `tokens.ts` — reference it
   (or add a named token there first).
2. Repeated across components? Put it in a `theme.ts` variant so call sites need nothing.
3. Component-specific and non-trivial? Co-locate an `X.styles.ts`.
4. Only flex/gap/alignment left in the `.tsx`? Good — that's all Layer 3 allows.
