import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import {
  OTHER_LIMIT,
  OTHER_PERIOD,
  TEST_LIMIT,
  TEST_PERIOD,
} from "./src/testing/budgets";

// One include for both projects, so the same test file runs on both runtimes.
const include = ["src/**/*.test.ts"];

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
              ratelimits: {
                RATE_LIMIT_TEST: {
                  namespace_id: "9001",
                  simple: { limit: TEST_LIMIT, period: TEST_PERIOD },
                },
                RATE_LIMIT_OTHER: {
                  namespace_id: "9002",
                  simple: { limit: OTHER_LIMIT, period: OTHER_PERIOD },
                },
              },
            },
          }),
        ],
        test: { name: "workerd", include },
      },
    ],
  },
});
