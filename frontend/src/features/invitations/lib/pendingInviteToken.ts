import { getSafeReturnTo } from "@/features/auth/utils/authUtils";

/**
 * Belt-and-suspenders for the invite link round-trip: React Router location
 * state (the primary `returnTo` mechanism) does NOT survive the signup → email
 * verify → login flow, because the email link opens a fresh document. We mirror
 * the invite token into sessionStorage so post-auth navigation can still return
 * the user to their invitation. Auto-detection of pending invitations on the
 * dashboard is the ultimate fallback; this just preserves the smoother
 * "land back on the invite page" experience when the token survives the session.
 */
const STORAGE_KEY = "wc.pendingInviteToken";

/** True for a syntactically plausible token (a path-safe, non-empty segment). */
function isPlausibleToken(token: string): boolean {
  return token.length > 0 && token.length <= 100 && !token.includes("/");
}

export function storePendingInviteToken(token: string): void {
  try {
    if (isPlausibleToken(token)) {
      window.sessionStorage.setItem(STORAGE_KEY, token);
    }
  } catch {
    // Ignore storage failures (private mode / disabled storage).
  }
}

export function clearPendingInviteToken(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * The safe `/invite/:token` path to resume after auth, or null when nothing is
 * stored / the value is not a plausible token. Routed through getSafeReturnTo so
 * it can never become an open-redirect.
 */
export function readPendingInvitePath(): string | null {
  try {
    const token = window.sessionStorage.getItem(STORAGE_KEY);
    if (!token || !isPlausibleToken(token)) return null;
    return getSafeReturnTo(`/invite/${token}`);
  } catch {
    return null;
  }
}
