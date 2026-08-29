import { acmeVite } from "@acme/app/vite";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// One include for both projects, so the same test file runs on both runtimes.
const include = ["src/**/*.test.ts"];

export default defineConfig({
  test: {
    // Tests throw on purpose; keep their output for the runs that fail.
    silent: "passed-only",
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcovonly"],
      exclude: ["src/testing/**", "*.config.ts"],
    },
    projects: [
      {
        plugins: [acmeVite({ withoutConfig: true })],
        test: { name: "node", include, exclude: ["**/*.workerd.test.ts"] },
      },
      {
        plugins: [
          acmeVite({ withoutConfig: true }),
          cloudflareTest({
            miniflare: {
              compatibilityDate: "2026-07-01",
              assets: {
                binding: "ASSETS",
                directory: "./test/fixtures/assets",
                // Nested snake_case: the camelCase top-level key is ignored.
                assetConfig: { not_found_handling: "single-page-application" },
              },
            },
          }),
        ],
        test: { name: "workerd", include, exclude: ["**/*.node.test.ts"] },
      },
    ],
  },
});
