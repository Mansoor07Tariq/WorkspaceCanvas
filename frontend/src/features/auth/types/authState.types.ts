import type { CurrentUser } from "./auth.types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthState = {
  status: AuthStatus;
  user: CurrentUser | null;
  error?: string;
};

export type AuthContextValue = AuthState & {
  refreshUser: () => Promise<void>;
  setAuthenticatedUser: (user: CurrentUser) => void;
  markUnauthenticated: (error?: string) => void;
  logoutUser: () => Promise<void>;
};
