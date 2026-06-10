import { useNavigate, useLocation } from "react-router-dom";
import { tokenStorage } from "@/lib/tokenStorage";
import { getCurrentUser } from "@/features/auth/api/authApi";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getSafeReturnTo } from "@/features/auth/utils/authUtils";
import { readPendingInvitePath } from "@/features/invitations/lib/pendingInviteToken";
import { ROUTES } from "@/routes/paths";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";

interface NavigateOptions {
  replace?: boolean;
}

export function usePostAuthNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthenticatedUser } = useAuth();

  async function navigateAfterAuth(
    tokens: { access: string },
    options?: NavigateOptions
  ): Promise<string | undefined> {
    tokenStorage.setAccessToken(tokens.access);
    try {
      const user = await getCurrentUser();
      setAuthenticatedUser(user);
      const state = location.state as { returnTo?: unknown } | null;
      // Prefer explicit router state; fall back to a sessionStorage-persisted
      // invite token (survives the signup → verify → login round-trip that drops
      // router state); finally default to the app dashboard.
      const dest = getSafeReturnTo(state?.returnTo) ?? readPendingInvitePath() ?? ROUTES.app;
      if (options) navigate(dest, options);
      else navigate(dest);
      return undefined;
    } catch (err: unknown) {
      tokenStorage.clearTokens();
      return getApiErrorMessage(err);
    }
  }

  return { navigateAfterAuth };
}
