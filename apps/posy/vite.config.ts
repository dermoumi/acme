import { readFileSync } from "node:fs";
import { acmeVite } from "@acme/app/vite";
import { sentryVite } from "@acme/sentry/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import react from "@vitejs/plugin-react";
import type { PluginOption, UserConfig } from "vite";
import { defineConfig } from "vitest/config";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

const packageJson = JSON.parse(
  readFileSync(new URL("package.json", import.meta.url), "utf8"),
) as { name: string; version: string };

const packageName = packageJson.name.replace(/^@[^/]+\//u, "");

// The Cloudflare plugin does not run in vitest.
// Vitest sets this env var before reading this file.
const isTest = process.env.VITEST === "true";

// An empty var has to fall back too, which `??` would not do.
function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

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
    navigateFallbackDenylist: [
      /^\/api\//u,
      /^\/health$/u,
      /^\/session$/u,
      /^\/sentry$/u,
      /^\/debug\//u,
    ],
  },
};

const include = ["src/**/*.test.ts"];

const test: UserConfig["test"] = {
  passWithNoTests: true,
  silent: "passed-only", // Some successful tests throw, and pollute output.
  coverage: {
    provider: "istanbul", // Workerd pool is not compatible with v8.
    reporter: ["text", "lcovonly"],
    // Entrypoint starts a server and will never be tested.
    exclude: ["src/server/testing/**", "src/server/index.ts", "*.config.ts"],
  },
  projects: [
    { test: { name: "node", include } },
    {
      plugins: [
        acmeVite(),
        cloudflareTest({
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            assets: {
              binding: "ASSETS",
              directory: "./test/fixtures/assets",
            },
            d1Databases: ["DATABASE"],
          },
        }),
      ],
      test: { name: "workerd", include, exclude: ["**/*.node.test.ts"] },
    },
  ],
};

function nodeBuild(isSsrBuild: boolean) {
  // We use --ssr to differentiate between server and client builds.
  if (!isSsrBuild) {
    return { outDir: "dist/client" };
  }

  return {
    outDir: "dist/server",
    // Keep stack traces readable; size is not a concern here.
    minify: false,
    // public/ already ships in dist/client.
    copyPublicDir: false,
    rolldownOptions: {
      input: { index: "src/server/index.ts" },
      // /app has no package.json, so .js there would be read as CommonJS.
      output: { entryFileNames: "[name].mjs" },
    },
  };
}

function buildPlugins(mode: string, isSsrBuild: boolean): PluginOption[] {
  return [
    acmeVite(),
    react(),
    ...(mode === "node" ? [] : [cloudflare()]),
    ...(isSsrBuild ? [] : [VitePWA(pwa)]),
    sentryVite({
      app: process.env.VITE_APP_NAME,
      release: process.env.VITE_APP_VERSION,
      dist: process.env.VITE_APP_REVISION,
    }),
  ];
}

export default defineConfig(({ mode, isSsrBuild = false }) => ({
  build: mode === "node" ? nodeBuild(isSsrBuild) : undefined,
  // One copy for both the bundle and `acme migrate`; better-sqlite3 is native.
  ssr: { noExternal: true, external: ["better-sqlite3", "pg"] },
  plugins: isTest ? [] : buildPlugins(mode, isSsrBuild),
  server: { host: "0.0.0.0" },
  test,
}));
