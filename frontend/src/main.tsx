import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts (PR 079) — no runtime Google Fonts dependency (SaaS: keeps the CSP
// font-src 'self', avoids a third-party request on every page load). Only the weights the
// design uses: Fraunces (display) 400/500/600, Manrope (UI) 500/600/700/800.
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./index.css";
import "./styles/globals.css";
import App from "./app/App.tsx";
import { msalStartup } from "./app/msalStartup";

msalStartup(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
);
