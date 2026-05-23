import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentUser, logout } from "../api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { sessionEvents } from "@/lib/sessionEvents";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { en } from "@/i18n/en";
import type { CurrentUser } from "../types/auth.types";
import type { AuthContextValue, AuthState } from "../types/authState.types";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    status: tokenStorage.getAccessToken() ? "loading" : "unauthenticated",
    user: null,
  }));

  // Guard against React StrictMode double-invoke
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    if (!tokenStorage.getAccessToken()) return;

    getCurrentUser()
      .then((user) => {
        setState({ status: "authenticated", user });
      })
      .catch((err: unknown) => {
        tokenStorage.clearTokens();
        setState({ status: "unauthenticated", user: null, error: getApiErrorMessage(err) });
      });
  }, []);

  useEffect(() => {
    const unsubscribe = sessionEvents.onSessionExpired(() => {
      tokenStorage.clearTokens();
      setState({ status: "unauthenticated", user: null, error: en.auth.session.sessionExpired });
    });
    return unsubscribe;
  }, []);

  async function refreshUser() {
    if (!tokenStorage.getAccessToken()) {
      tokenStorage.clearTokens();
      setState({ status: "unauthenticated", user: null });
      return;
    }
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
    const refresh = tokenStorage.getRefreshToken();
    if (refresh) {
      try {
        await logout({ refresh });
      } catch {
        // Backend logout errors are non-fatal; always clear local state
      }
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
