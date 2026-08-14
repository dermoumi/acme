import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// One include for both projects, so the same test file runs on both runtimes.
const include = ["src/**/*.test.ts"];
// A CLI is a process with argv and a filesystem, which workerd is not.
const CLI = "src/cli/**";

export default defineConfig({
  test: {
    // Tests throw on purpose; keep their output for the runs that fail.
    silent: "passed-only",
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcovonly"],
      exclude: ["*.config.ts"],
    },
    projects: [
      { test: { name: "node", include } },
      {
        plugins: [
          cloudflareTest({ miniflare: { compatibilityDate: "2026-07-01" } }),
        ],
        test: { name: "workerd", include, exclude: [CLI] },
      },
    ],
  },
});
