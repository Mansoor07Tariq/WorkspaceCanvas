import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentUser, logout } from "../api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { sessionEvents } from "@/lib/sessionEvents";
import { refreshStoredTokens } from "@/features/auth/utils/sessionRefresh";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";
import type { CurrentUser } from "../types/auth.types";
import type { AuthContextValue, AuthState } from "../types/authState.types";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always start as loading: even with no in-memory token the browser may have
  // a valid httpOnly refresh cookie that can restore the session on mount.
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  // Guard against React StrictMode double-invoke
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    async function bootstrap() {
      const refreshed = await refreshStoredTokens();
      if (!refreshed) {
        setState({ status: "unauthenticated", user: null });
        return;
      }
      try {
        const user = await getCurrentUser();
        setState({ status: "authenticated", user });
      } catch (err: unknown) {
        tokenStorage.clearTokens();
        setState({ status: "unauthenticated", user: null, error: getApiErrorMessage(err) });
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    const unsubscribe = sessionEvents.onSessionExpired(() => {
      tokenStorage.clearTokens();
      setState({ status: "unauthenticated", user: null, error: en.auth.session.sessionExpired });
    });
    return unsubscribe;
  }, []);

  async function refreshUser() {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const user = await getCurrentUser();
      setState({ status: "authenticated", user });
    } catch (err: unknown) {
      tokenStorage.clearTokens();
      setState({ status: "unauthenticated", user: null, error: getApiErrorMessage(err) });
    }
  }

  function setAuthenticatedUser(user: CurrentUser) {
    setState({ status: "authenticated", user });
  }

  function markUnauthenticated(error?: string) {
    tokenStorage.clearTokens();
    setState({ status: "unauthenticated", user: null, error });
  }

  async function logoutUser() {
    try {
      await logout();
    } catch {
      // Backend logout errors are non-fatal; always clear local state
    }
    tokenStorage.clearTokens();
    setState({ status: "unauthenticated", user: null });
  }

  return (
    <AuthContext.Provider
      value={{ ...state, refreshUser, setAuthenticatedUser, markUnauthenticated, logoutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
