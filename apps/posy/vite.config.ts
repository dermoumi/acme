import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const { version } = JSON.parse(
  readFileSync(new URL("package.json", import.meta.url), "utf8"),
) as { version: string };

// loadEnv picks VITE_-prefixed vars up from process.env, so this reaches
// import.meta.env in both dev and build (plain `define` does not).
process.env.VITE_APP_VERSION = version;
// Only mirrored when actually set, so an empty tier falls back client-side.
if (process.env.APP_ENV) {
  process.env.VITE_APP_ENV = process.env.APP_ENV;
}

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Posy",
        short_name: "Posy",
        description: "A little flower every day",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#fdf6e8",
        background_color: "#fdf6e8",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        navigateFallback: "/index.html",
        // Offline is read-only shell for now: never route server paths to the SPA.
        navigateFallbackDenylist: [
          /^\/api\//u,
          /^\/health$/u,
          /^\/session$/u,
          /^\/sentry$/u,
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
  },
});
