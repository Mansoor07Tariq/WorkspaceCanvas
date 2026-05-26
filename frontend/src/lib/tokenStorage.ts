// Access token is held in memory only — never persisted to localStorage/sessionStorage.
// The refresh token lives exclusively in an httpOnly cookie managed by the backend.
// On page reload the access token is recovered by calling the refresh endpoint
// (see AuthContext bootstrap), which reads the httpOnly cookie.

let _accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken(): string | null {
    return _accessToken;
  },

  setAccessToken(access: string): void {
    _accessToken = access;
  },

  // Kept for call-site compatibility; any extra arguments are ignored
  // because the refresh token is stored as an httpOnly cookie by the backend.
  setTokens(access: string): void {
    _accessToken = access;
  },

  clearTokens(): void {
    _accessToken = null;
  },
};
