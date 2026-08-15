import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // ── Design-token discipline (PR 079; see docs/design/STYLEGUIDE.md) ──────────
  // Colour hex, font-family, and string font-size literals belong ONLY in
  // src/theme/tokens.ts. Everywhere else must reference the tokens / theme so the
  // design system has one source of truth. Pre-PR-079 files (canvas rendering needs
  // raw paint values; legacy rem-based typography) are grandfathered below and tracked
  // as migration debt in the STYLEGUIDE — the rule still enforces on all new code.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/theme/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      // Grandfathered: Konva/canvas rendering (raw paint) + decorative backgrounds.
      "src/features/layoutObjects/**",
      "src/features/bookings/utils/bookingCanvasUtils.ts",
      "src/components/feedback/FullScreenTransition.tsx",
      // Grandfathered: legacy rem-based typography / monospace (migrate incrementally).
      "src/features/auth/**",
      "src/features/teams/**",
      "src/features/profile/**",
      "src/features/offices/**",
      "src/features/floors/**",
      "src/features/desks/**",
      "src/features/dashboard/**",
      "src/app/pages/FloorLayoutPage.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "No colour hex outside src/theme/tokens.ts — add a named token and reference it (STYLEGUIDE Layer 0).",
        },
        {
          selector: 'Property[key.name="fontFamily"] > Literal',
          message:
            "No font-family literal outside the theme — use fontTokens / a theme typography variant (STYLEGUIDE).",
        },
        {
          selector: 'Property[key.name="fontSize"] > Literal[value=/[a-zA-Z%]/]',
          message:
            "No string font-size literal outside the theme — use fontSizeTokens / a theme variant (STYLEGUIDE).",
        },
      ],
    },
  },
]);
