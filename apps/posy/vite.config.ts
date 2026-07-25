import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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
        theme_color: "#fbeef3",
        background_color: "#fff8fa",
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
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        // Offline is read-only shell for now: never route server paths to the SPA.
        navigateFallbackDenylist: [/^\/api\//u, /^\/health$/u, /^\/session$/u],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
  },
});
