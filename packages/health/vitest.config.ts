import { acmeVite } from "@acme/app/vite";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// One include for both projects, so the same test file runs on both runtimes.
const include = ["src/**/*.test.ts"];
// composeApp imports virtual:acme-config, so both projects need the plugin.
// This package has no config of its own: the fixture one stands in.
const acme = () => {
  return acmeVite({ config: "src/fixtures/acme.config.ts" });
};

export default defineConfig({
  test: {
    // Tests throw on purpose; keep their output for the runs that fail.
    silent: "passed-only",
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcovonly"],
      exclude: ["*.config.ts", "src/fixtures/**"],
    },
    projects: [
      { plugins: [acme()], test: { name: "node", include } },
      {
        plugins: [
          acme(),
          cloudflareTest({ miniflare: { compatibilityDate: "2026-07-01" } }),
        ],
        test: { name: "workerd", include },
      },
    ],
  },
});
