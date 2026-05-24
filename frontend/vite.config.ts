import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Dev-only CSP. In production set equivalent headers in your reverse proxy (nginx).
// 'unsafe-eval' + 'unsafe-inline' in script-src: required by Vite HMR and the
// @vitejs/plugin-react preamble inline script; remove both in production builds.
// 'unsafe-inline' in style-src is required by MUI's CSS-in-JS emotion runtime.
// Social auth domains (Google/Microsoft) are included for OAuth popup flows.
const DEV_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  [
    "connect-src 'self'",
    "ws://localhost:5173 ws://127.0.0.1:5173",
    "http://localhost:8000",
    "https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
    "https://login.microsoftonline.com https://login.microsoft.com https://graph.microsoft.com",
  ].join(" "),
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    headers: {
      "Content-Security-Policy": DEV_CSP,
    },
  },
});
