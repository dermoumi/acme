import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// A plain *.test.ts is a contract and runs on every runtime, taking its dialect
// from #testing/runtime. A suffix is only for what one runtime alone can show.
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
      {
        test: {
          name: "node",
          include,
          exclude: ["src/**/*.workerd.test.ts"],
        },
      },
      {
        plugins: [
          cloudflareTest({
            miniflare: {
              compatibilityDate: "2026-07-01",
              d1Databases: ["DB"],
            },
          }),
        ],
        test: {
          name: "workerd",
          include,
          exclude: ["src/**/*.node.test.ts"],
        },
      },
    ],
  },
});
