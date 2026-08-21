import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // injectManifest (not the default generateSW) — the SW needs custom
      // `push`/`notificationclick` handlers (src/sw.ts) for Web Push
      // (DEV_PLAN.md §7.4). A payload the SW doesn't call showNotification()
      // for is silently dropped, so generateSW's stock SW can't support this.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
      },
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Ψαρέματα — Fishing conditions",
        short_name: "Ψαρέματα",
        description: "Is it worth going fishing here, right now?",
        lang: "el",
        start_url: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#0E1418",
        theme_color: "#0E1418",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Best windows",
            url: "/windows",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "My location",
            // The location page picks this up to trigger the geolocation
            // gesture-flow on arrival — still counts as a user-initiated
            // action since launching an app shortcut is itself a gesture.
            url: "/?action=locate",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // MapLibre GL ships its own worker via a self-referencing `new URL(...)`;
  // Vite's dep pre-bundling rewrites that reference and 404s it in dev
  // (a known maplibre-gl + Vite interaction). Excluding it from
  // optimizeDeps serves it straight from node_modules, where the worker
  // URL resolves correctly.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    port: 5173,
    proxy: {
      // Same-origin /api in both dev and prod (nginx proxies it in prod —
      // see apps/web/nginx.conf) keeps the client fetch code environment-
      // agnostic and sidesteps CORS entirely.
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
  },
});
