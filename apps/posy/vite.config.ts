import { acmeVite } from "@acme/app/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import react from "@vitejs/plugin-react";
import type { PluginOption, UserConfig } from "vite";
import { defineConfig } from "vitest/config";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

// The Cloudflare plugin does not run in vitest.
// Vitest sets this env var before reading this file.
const isTest = process.env.VITEST === "true";

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
