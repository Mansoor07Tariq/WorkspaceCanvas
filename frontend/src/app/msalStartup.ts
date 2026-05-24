import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
import { msalInstance } from "@/features/auth/social/socialConfig";

function detectAuthCallback(): boolean {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  return (
    (hashParams.has("state") && (hashParams.has("code") || hashParams.has("error"))) ||
    (queryParams.has("state") && (queryParams.has("code") || queryParams.has("error")))
  );
}

/**
 * MSAL v5 popup/redirect startup handler.
 *
 * Must be called before React renders. Two paths:
 *
 * - Auth callback (popup or redirect): URL contains an MSAL auth response
 *   (code/error + state). broadcastResponseToMainFrame() relays the raw
 *   response to the opener via BroadcastChannel (popup), or caches it and
 *   navigates back to the app (redirect). React is never rendered here.
 *
 * - Normal load: initializes the MSAL instance, then calls renderApp().
 *   MsalProvider handles handleRedirectPromise() on mount.
 */
export function msalStartup(renderApp: () => void): void {
  if (detectAuthCallback()) {
    broadcastResponseToMainFrame().catch(() => {
      if (window.opener !== null) {
        window.close();
      }
    });
    return;
  }

  msalInstance.initialize().then(renderApp);
}
