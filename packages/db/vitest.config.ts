import { acmeVite } from "@acme/app/vite";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig, type ViteUserConfig } from "vitest/config";

// Two vocabularies that never overlap, so a suffix names its own axis. A plain
// *.test.ts is the engine contract and runs in every engine project below.
const include = ["src/**/*.test.ts"];
// A root testTimeout does not reach a project, and migrating real files takes
// seconds once the whole repo's suites run at once.
const testTimeout = 30_000;
// No engine matrix: the CLI is wiring, proven per engine by the projects
// below. Keep engine code out of internal/commands so it stays that way.
const CLI = "src/internal/commands/**";
const NODE = "src/**/*.node.test.ts";
const WORKERD = "src/**/*.workerd.test.ts";
const SQLITE = "src/**/*.sqlite.test.ts";
const POSTGRES = "src/**/*.postgres.test.ts";
const D1 = "src/**/*.d1.test.ts";

// The testing helpers import virtual:acme-config, so every project serves it.
// This package has no config of its own: the kit fixture stands in.
const acme = () => {
  return acmeVite({ config: "src/internal/kit/fixtures/app/acme.config.ts" });
};

const postgresUrl = process.env.ACME_DB_TEST_POSTGRES_URL;

// Defined only when a server is configured, so `pnpm test` needs no postgres.
// CI runs it by name, which fails loudly if the variable ever goes missing.
const postgres: ViteUserConfig[] = postgresUrl
  ? [
      {
        plugins: [acme()],
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
      reporter: ["text", "lcovonly"],
      exclude: ["src/internal/testing/**", "*.config.ts"],
    },
    projects: [
      {
        plugins: [acme()],
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
          acme(),
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
        plugins: [acme()],
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
