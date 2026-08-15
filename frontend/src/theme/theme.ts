import { createTheme } from "@mui/material/styles";

import { colorTokens, fontTokens, radiusTokens, shadowTokens } from "./tokens";

/**
 * The app-wide MUI theme, built from the design tokens (PR 079). Mapping the tokens onto
 * MUI's standard slots (palette/typography/shape/component defaults) means every existing
 * page inherits the pine/porcelain look without a per-page rewrite. Raw tokens live in
 * `tokens.ts`; nothing here (or elsewhere) should hardcode a hex.
 *
 * Typography: Manrope is the UI face (theme default); Fraunces is the display face,
 * applied to the heading variants (h1–h4) so greetings, page titles, and big numbers
 * render in it automatically. Fonts are self-hosted via @fontsource (imported in
 * main.tsx) — no runtime Google Fonts dependency.
 */
export const theme = createTheme({
  palette: {
    primary: {
      main: colorTokens.pine,
      dark: colorTokens.pineDark,
      light: colorTokens.mint,
      contrastText: colorTokens.onPine,
    },
    secondary: {
      main: colorTokens.amber,
      light: colorTokens.amberLight,
      dark: colorTokens.amberDark,
      contrastText: colorTokens.onPine,
    },
    error: { main: colorTokens.errorRed },
    success: { main: colorTokens.pine },
    warning: { main: colorTokens.amber },
    background: {
      default: colorTokens.page,
      paper: colorTokens.card,
    },
    text: {
      primary: colorTokens.ink,
      secondary: colorTokens.slate,
    },
    divider: colorTokens.line,
  },
  typography: {
    fontFamily: fontTokens.body,
    h1: { fontFamily: fontTokens.display, fontWeight: 600, letterSpacing: "-0.01em" },
    h2: { fontFamily: fontTokens.display, fontWeight: 600, letterSpacing: "-0.01em" },
    h3: { fontFamily: fontTokens.display, fontWeight: 500, letterSpacing: "-0.01em" },
    h4: { fontFamily: fontTokens.display, fontWeight: 500 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  shape: {
    borderRadius: radiusTokens.control,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          borderRadius: radiusTokens.control,
        },
        sizeLarge: { paddingTop: 10, paddingBottom: 10 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small", fullWidth: true },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.card,
          border: `1px solid ${colorTokens.line}`,
          boxShadow: shadowTokens.card,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        // Keep outlined paper hairline-consistent with cards.
        outlined: { borderColor: colorTokens.line },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: radiusTokens.control } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
  },
});
