import { readFileSync } from "node:fs";
import { sentryVite } from "@acme/sentry/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

const packageJson = JSON.parse(
  readFileSync(new URL("package.json", import.meta.url), "utf8"),
) as { name: string; version: string };

const packageName = packageJson.name.replace(/^@[^/]+\//u, "");

// An empty var has to fall back too, which `??` would not do.
function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

// loadEnv picks VITE_-prefixed vars up from process.env, so this reaches
// import.meta.env in both dev and build (plain `define` does not).
// CI sets these for the worker too, so both halves agree; package.json is the local fallback.
process.env.VITE_APP_NAME = envOr("APP_NAME", packageName);
process.env.VITE_APP_VERSION = envOr("APP_VERSION", packageJson.version);
process.env.VITE_APP_ENV = envOr("APP_ENV", "development");
process.env.VITE_APP_REVISION = envOr("APP_REVISION", "dev");

const pwa: Partial<VitePWAOptions> = {
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
    // generated after Sentry has swept the build, so these would ship unused
    sourcemap: false,
    globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
    navigateFallback: "/index.html",
    // Offline is read-only shell for now: never route server paths to the SPA.
    navigateFallbackDenylist: [
      /^\/api\//u,
      /^\/health$/u,
      /^\/session$/u,
      /^\/sentry$/u,
      /^\/debug\//u,
    ],
  },
};

// Two passes: the browser payload (dist/client, served off disk at runtime) and
// the node process that serves it (dist/server). Neither renders on the server;
// --ssr is only vite's word for "compile for node, not for the browser".
function nodeBuild(isSsrBuild: boolean) {
  if (!isSsrBuild) return { outDir: "dist/client" };

  return {
    outDir: "dist/server",
    // Unminified keeps server stack traces readable; size is not a concern here.
    minify: false,
    // public/ already ships in dist/client, so copying it again only duplicates
    // every static asset inside the image.
    copyPublicDir: false,
    rolldownOptions: {
      input: { index: "src/server/index.node.ts" },
      // /app has no package.json, so .js there would be read as CommonJS.
      output: { entryFileNames: "[name].mjs" },
    },
  };
}

export default defineConfig(({ mode, isSsrBuild }) => ({
  // The cloudflare plugin owns the build whenever it is loaded, so the target
  // decides whether it applies. A prerender pass would join node here.
  build: mode === "node" ? nodeBuild(Boolean(isSsrBuild)) : undefined,
  // Drivers external so the bundle and `acme migrate`, which runs from
  // source, load one copy; better-sqlite3 is native and cannot be bundled.
  ssr: { noExternal: true, external: ["better-sqlite3", "pg"] },
  plugins: [
    react(),
    ...(mode === "node" ? [] : [cloudflare()]),
    ...(isSsrBuild ? [] : [VitePWA(pwa)]),
    // the same values the bundle reports, so Sentry can match maps to events
    sentryVite({
      app: process.env.VITE_APP_NAME,
      release: process.env.VITE_APP_VERSION,
      dist: process.env.VITE_APP_REVISION,
    }),
  ],
  server: {
    host: "0.0.0.0",
  },
}));
