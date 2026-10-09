import { acmeVite } from "@acme/app/vite";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// One include for both projects, so the same test file runs on both runtimes.
const include = ["src/**/*.test.ts"];
const alias = {
  "virtual:react-router/server-build": "./src/fixtures/server-build.ts",
};

export default defineConfig({
  resolve: { alias },
  test: {
    silent: "passed-only",
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcovonly"],
      exclude: ["*.config.ts", "src/fixtures/**"],
    },
    projects: [
      {
        plugins: [acmeVite({ withoutConfig: true })],
        resolve: { alias },
        test: { name: "node", include },
      },
      {
        plugins: [
          acmeVite({ withoutConfig: true }),
          cloudflareTest({ miniflare: { compatibilityDate: "2026-07-01" } }),
        ],
        resolve: { alias },
        test: { name: "workerd", include },
      },
    ],
  },
});
