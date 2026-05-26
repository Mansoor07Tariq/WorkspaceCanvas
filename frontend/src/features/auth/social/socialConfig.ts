import { PublicClientApplication } from "@azure/msal-browser";
import { GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID } from "@/config/env";

export const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID);
export const isMicrosoftConfigured = Boolean(MICROSOFT_CLIENT_ID);

// MSAL requires the instance to be created before initialization; the
// redirectUri reads window.location.origin which is always available in browser.
export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: MICROSOFT_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
});
