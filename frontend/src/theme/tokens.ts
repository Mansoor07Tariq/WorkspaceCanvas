/**
 * WorkspaceCanvas design tokens — the SINGLE source of truth for the pine/porcelain
 * design language (PR 079, from docs/design/prototype-v3.jsx). The MUI theme
 * (`theme.ts`) maps these onto MUI's palette/typography/shape slots so every existing
 * page inherits them; components that need a raw token (canvas, the map avatars) import
 * from here. No hardcoded hex should live outside this file and the theme.
 */

export const colorTokens = {
  /** page background */
  page: "#F4F6F5",
  /** card / paper surface */
  card: "#FFFFFF",
  /** primary ink text */
  ink: "#182420",
  /** secondary / muted text */
  slate: "#5E6B66",
  /** neutral inner surface (map rooms, chips) */
  mist: "#EAEFED",
  /** brand green (primary) */
  pine: "#147054",
  /** deep green (primary dark, strokes on "you") */
  pineDark: "#0C4A38",
  /** soft green surface (selected pills, free desks, DEFAULT badge) */
  mint: "#E2F2EA",
  /** mint outline */
  mintLine: "#BFE3D2",
  /** accent — "usual desk" dot, highlights (secondary.main) */
  amber: "#B97A24",
  /** accent light (secondary.light) */
  amberLight: "#D8A863",
  /** accent dark (secondary.dark) */
  amberDark: "#8C5B18",
  /** error (error.main) */
  errorRed: "#B3403A",
  /** hairline borders / dividers */
  line: "#E4E9E7",
  /** on-pine / on-avatar white */
  onPine: "#FFFFFF",
  /** muted mint text used on pine surfaces (week-strip secondary) */
  mintText: "#CBE8DB",
} as const;

export const fontTokens = {
  /** display face — greetings, page titles, big numbers */
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  /** UI face — everything else */
  body: "'Manrope', 'Segoe UI', system-ui, -apple-system, sans-serif",
} as const;

/**
 * Semantic font-size scale (px). Raw font-size numbers live ONLY here (Layer 0); theme
 * variants and `.styles.ts` reference these names, never bare numbers.
 */
export const fontSizeTokens = {
  greeting: 32,
  greetingSm: 26,
  title: 24,
  dayNumber: 19,
  brand: 16.5,
  brandCompact: 15,
  strong: 13.5,
  button: 13,
  label: 12.5,
  link: 12,
  caption: 11.5,
  captionCompact: 11,
  micro: 10.5,
  microCompact: 10,
  rail: 9.5,
} as const;

/** Semantic font weights (the design uses four). */
export const fontWeightTokens = {
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const radiusTokens = {
  /** outer cards */
  card: 20,
  /** inner cards / week-strip tiles */
  innerCard: 14,
  /** controls (buttons, inputs) */
  control: 10,
  /** pills / badges */
  pill: 999,
} as const;

export const shadowTokens = {
  /** the one elevation used across cards */
  card: "0 1px 2px rgba(24,36,32,.04), 0 4px 14px rgba(24,36,32,.05)",
} as const;

/**
 * Deterministic avatar palette. A person's tile colour is picked by
 * `avatarColor(userId)` so the same colleague is always the same colour across the map,
 * near-you list, and week strip (matches the prototype's per-person colours).
 */
export const avatarPalette = [
  "#147054", // pine
  "#7A5AA6", // violet
  "#B97A24", // amber
  "#3A6EA5", // blue
  "#A5544F", // clay
  "#4E7D3A", // moss
  "#8A6FB8", // lilac
  "#2E7D74", // teal
] as const;

/** Stable colour for a user id (or any numeric/string key). */
export function avatarColor(key: number | string): string {
  const n = typeof key === "number" ? key : hashString(key);
  return avatarPalette[Math.abs(n) % avatarPalette.length];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

/** Initials from a display name (max 2 letters), e.g. "Sarah Kelly" → "SK". */
export function initialsFromName(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const tokens = {
  color: colorTokens,
  font: fontTokens,
  fontSize: fontSizeTokens,
  fontWeight: fontWeightTokens,
  radius: radiusTokens,
  shadow: shadowTokens,
  avatarPalette,
} as const;
