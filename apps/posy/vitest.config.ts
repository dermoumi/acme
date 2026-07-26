import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Standalone config: the app's vite.config.ts loads the Cloudflare plugin,
// which cannot run inside vitest. Both projects run this same suite.
const include = ["src/**/*.test.ts"];

export default defineConfig({
  test: {
    passWithNoTests: true,
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      exclude: ["src/server/testing/**", "*.config.ts"],
    },
    projects: [
      { test: { name: "node", include } },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              assets: {
                binding: "ASSETS",
                directory: "./test/fixtures/assets",
              },
            },
          }),
        ],
        test: {
          name: "workers",
          include,
          // better-sqlite3 is native and cannot load in workerd; these join the
          // shared suite once a D1 dialect exists (posy-d1-deploy).
          exclude: ["src/server/db/**"],
        },
      },
    ],
  },
});
