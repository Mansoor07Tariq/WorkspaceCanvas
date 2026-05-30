import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";

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
  plugins: [
    react(),
    tailwindcss(),
    // Only generate bundle analysis report when explicitly requested.
    // Usage: ANALYZE=true npm run build  →  dist/stats.html
    process.env.ANALYZE === "true" &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
  ].filter(Boolean),
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // React core — tiny but touched by every component; isolate for long-term caching.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router")
          ) {
            return "vendor-react";
          }

          // MUI + Emotion — the heaviest vendor group in this app.
          if (id.includes("/@mui/") || id.includes("/@emotion/")) {
            return "vendor-mui";
          }

          // Lucide icons (if ever added) and MUI icon pack in one cacheable chunk.
          if (id.includes("/lucide-react/") || id.includes("/@mui/icons-material/")) {
            return "vendor-icons";
          }

          // Konva is only imported by FloorMapCanvas, which is already lazy-loaded.
          // Returning undefined lets Rolldown keep it in FloorMapCanvas's own chunk
          // rather than pulling it into the eager vendor bundle.
          if (id.includes("/konva/") || id.includes("/react-konva/")) {
            return undefined;
          }

          // Everything else from node_modules (MSAL, Google OAuth, etc.).
          return "vendor";
        },
      },
    },
  },
});
