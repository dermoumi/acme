import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig, type ViteUserConfig } from "vitest/config";

// Two vocabularies that never overlap, so a suffix names its own axis. A plain
// *.test.ts is the engine contract and runs in every engine project below.
const include = ["src/**/*.test.ts"];
// Several suites open and migrate real files, which takes seconds rather than
// milliseconds once the whole repo's suites run at once. Per project: a root
// testTimeout does not reach them.
const testTimeout = 30_000;
// One project, not a suffix on every file, and deliberately no engine matrix:
// the CLI is wiring, and everything it reaches for is proven per engine by the
// projects below. Keep it that way by keeping engine code out of src/cli.
const CLI = "src/cli/**";
const NODE = "src/**/*.node.test.ts";
const WORKERD = "src/**/*.workerd.test.ts";
const SQLITE = "src/**/*.sqlite.test.ts";
const POSTGRES = "src/**/*.postgres.test.ts";
const D1 = "src/**/*.d1.test.ts";

const postgresUrl = process.env.ACME_DB_TEST_POSTGRES_URL;

// Defined only when a server is configured, so `pnpm test` needs no postgres.
// CI runs it by name, which fails loudly if the variable ever goes missing.
const postgres: ViteUserConfig[] = postgresUrl
  ? [
      {
        test: {
          name: "node:postgres",
          include,
          testTimeout,
          exclude: [WORKERD, SQLITE, D1, CLI],
          // Serial: parallel files need a schema each, and kysely then finds
          // another worker's tables and skips its own (migrator.js:385).
          fileParallelism: false,
          env: { ACME_DB_TEST_URL: postgresUrl },
        },
      },
    ]
  : [];

export default defineConfig({
  test: {
    // Tests throw on purpose; keep their output for the runs that fail.
    silent: "passed-only",
    // The workers pool rejects the v8 provider: it needs node:inspector.
    coverage: {
      provider: "istanbul",
      exclude: ["src/internal/testing/**", "*.config.ts"],
    },
    projects: [
      {
        test: {
          name: "node:sqlite",
          include,
          testTimeout,
          exclude: [WORKERD, POSTGRES, D1, CLI],
          env: { ACME_DB_TEST_URL: ":memory:" },
        },
      },
      {
        plugins: [
          cloudflareTest({
            miniflare: {
              compatibilityDate: "2026-07-01",
              d1Databases: ["DATABASE"],
            },
          }),
        ],
        test: {
          name: "workerd:d1",
          include,
          testTimeout,
          exclude: [NODE, SQLITE, POSTGRES, CLI],
        },
      },
      {
        test: {
          name: "cli",
          include: [`${CLI}/*.test.ts`],
          // These tests stub env vars; without this they leak into whatever
          // vitest runs next in the same worker.
          unstubEnvs: true,
          testTimeout,
        },
      },
      ...postgres,
    ],
  },
});
