import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// One include for both projects, so the same test file runs on both runtimes.
const include = ["src/**/*.test.ts"];

// Must agree with the harness budgets, or a test asserts the wrong count.
const ratelimits = {
  RATE_LIMIT_TEST: { namespace_id: "9001", simple: { limit: 3, period: 60 } },
  RATE_LIMIT_OTHER: { namespace_id: "9002", simple: { limit: 1, period: 10 } },
} as const;

export default defineConfig({
  test: {
    // Tests throw on purpose; keep their output for the runs that fail.
    silent: "passed-only",
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      exclude: ["src/testing/**", "*.config.ts"],
    },
    projects: [
      { test: { name: "node", include } },
      {
        plugins: [
          cloudflareTest({
            miniflare: {
              compatibilityDate: "2026-07-01",
              ratelimits,
            },
          }),
        ],
        test: { name: "workerd", include },
      },
    ],
  },
});
