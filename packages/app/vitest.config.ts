import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
// Relative: a package cannot resolve its own name.
import { acmeVite } from "./src/vite/index.ts";
import { defineConfig } from "vitest/config";

// One include for both projects, so the same test file runs on both runtimes.
const include = ["src/**/*.test.ts"];
// serve imports virtual:acme-config, so both projects need the plugin. This
// package has no config of its own: the fixture one stands in.
const acme = () => acmeVite({ config: "src/cli/fixtures/app/acme.config.ts" });
// A CLI and a vite plugin both want a filesystem, which workerd is not.
const NODE_ONLY = ["src/cli/**", "**/*.node.test.ts"];

export default defineConfig({
  test: {
    // Tests throw on purpose; keep their output for the runs that fail.
    silent: "passed-only",
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcovonly"],
      // Fixtures are scaffolding a test drives, not code the package ships.
      exclude: ["*.config.ts", "src/**/fixtures/**"],
    },
    projects: [
      { plugins: [acme()], test: { name: "node", include } },
      {
        plugins: [
          acme(),
          cloudflareTest({ miniflare: { compatibilityDate: "2026-07-01" } }),
        ],
        test: { name: "workerd", include, exclude: NODE_ONLY },
      },
    ],
  },
});
