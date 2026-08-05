import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Standalone config: the app's vite.config.ts loads the Cloudflare plugin,
// which cannot run inside vitest. Both projects run this same suite.
const include = ["src/**/*.test.ts"];

export default defineConfig({
  test: {
    passWithNoTests: true,
    // Tests throw on purpose; keep their output for the runs that fail.
    silent: "passed-only",
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
              d1Databases: ["DATABASE"],
            },
          }),
        ],
        test: { name: "workerd", include },
      },
    ],
  },
});
