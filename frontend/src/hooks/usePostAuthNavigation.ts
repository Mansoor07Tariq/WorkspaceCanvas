import { useNavigate } from "react-router-dom";
import { tokenStorage } from "@/lib/tokenStorage";
import { getCurrentUser } from "@/features/auth/api/authApi";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ROUTES } from "@/routes/paths";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";

interface NavigateOptions {
  replace?: boolean;
}

export function usePostAuthNavigation() {
  const navigate = useNavigate();
  const { setAuthenticatedUser } = useAuth();

  async function navigateAfterAuth(
    tokens: { access: string },
    options?: NavigateOptions
  ): Promise<string | undefined> {
    tokenStorage.setAccessToken(tokens.access);
    try {
      const user = await getCurrentUser();
      setAuthenticatedUser(user);
      if (options) navigate(ROUTES.app, options);
      else navigate(ROUTES.app);
      return undefined;
    } catch (err: unknown) {
      tokenStorage.clearTokens();
      return getApiErrorMessage(err);
    }
  }

  return { navigateAfterAuth };
}
