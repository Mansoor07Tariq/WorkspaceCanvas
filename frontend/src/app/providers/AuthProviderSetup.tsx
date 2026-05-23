import type { ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { MsalProvider } from "@azure/msal-react";
import { GOOGLE_CLIENT_ID } from "@/config/env";
import { msalInstance } from "@/features/auth/social/socialConfig";

interface AuthProviderSetupProps {
  children: ReactNode;
}

export function AuthProviderSetup({ children }: AuthProviderSetupProps) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MsalProvider instance={msalInstance}>{children}</MsalProvider>
    </GoogleOAuthProvider>
  );
}
