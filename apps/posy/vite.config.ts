import { acmeVite } from "@acme/app/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import type { PluginOption, UserConfig } from "vite";
import { defineConfig } from "vitest/config";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

// The Cloudflare plugin does not run in vitest.
// Vitest sets this env var before reading this file.
const isTest = process.env.VITEST === "true";
// Not vite's mode: the router's prerender reloads this file without it.
const isNode = process.env.BUILD_TARGET === "node";

const pwa: Partial<VitePWAOptions> = {
  outDir: "dist/client",
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
    // Generated after Sentry has swept the build, so these would ship unused.
    sourcemap: false,
    globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
    // Server-rendered pages leave no static shell; the default names one.
    navigateFallback: null,
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
    {
      plugins: [acmeVite()],
      test: { name: "node", include },
    },
    {
      plugins: [
        acmeVite(),
        cloudflareTest({
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            d1Databases: ["DATABASE"],
          },
        }),
      ],
      test: { name: "workerd", include, exclude: ["**/*.node.test.ts"] },
    },
  ],
};

function buildPlugins(): PluginOption[] {
  return [
    // Ahead of the router plugin, which acmeVite() loads from the router kit.
    ...(isNode ? [] : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    acmeVite(),
    VitePWA(pwa),
  ];
}

export default defineConfig({
  // One copy for both the bundle and `acme migrate`; better-sqlite3 is native.
  // Node only: on workers this is the worker's environment, which rejects these.
  ssr: isNode
    ? { noExternal: true, external: ["better-sqlite3", "pg"] }
    : undefined,
  plugins: isTest ? [] : buildPlugins(),
  server: { host: "0.0.0.0" },
  test,
});
