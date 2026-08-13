import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../internal/database";
import { dialectFromUrl } from "../internal/uri/uri.node.ts";
import { run } from "./acme-db";

// One engine is enough: this proves the CLI wires the migrator to a database,
// not that the migrator works, which every engine project already covers.
const config = path.join(
  import.meta.dirname,
  "fixtures",
  "app",
  "acme.config.ts",
);

const cli = (...argv: string[]) => run([...argv, "-c", config]);

async function tables(url: string): Promise<string[]> {
  const db = createDb<never>(await dialectFromUrl(url));
  const found = await db.introspection.getTables();
  await db.destroy();
  return found
    .map((table) => table.name)
    .filter((name) => !name.includes("migration"))
    .toSorted();
}

interface CliContext {
  dir: string;
  main: string;
  analytics: string;
}

// A hook reaches only its own describe, so every block installs the sandbox.
const sandbox = () => {
  // Files, not :memory:, which is private to the connection that opened it.
  beforeEach<CliContext>(async (ctx) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const dir = await mkdtemp(path.join(tmpdir(), "acme-db-cli-"));
    const main = `file:${path.join(dir, "main.db")}`;
    const analytics = `file:${path.join(dir, "analytics.db")}`;
    vi.stubEnv("MAIN_URL", main);
    vi.stubEnv("ANALYTICS_URL", analytics);

    ctx.dir = dir;
    ctx.main = main;
    ctx.analytics = analytics;
  });

  afterEach<CliContext>(async ({ dir }) => {
    await rm(dir, { recursive: true, force: true });
  });
};

describe("run migrate", () => {
  sandbox();

  it<CliContext>("applies every declared migration of every database", async ({
    main,
    analytics,
  }) => {
    expect(await cli("migrate")).toBe(0);
    expect(await tables(main)).toEqual(["posts", "users"]);
    expect(await tables(analytics)).toEqual(["events"]);
  });

  it<CliContext>("is a no-op when rerun", async ({ main }) => {
    await cli("migrate");
    expect(await cli("migrate")).toBe(0);
    expect(await tables(main)).toEqual(["posts", "users"]);
  });

  it<CliContext>("stops at the migration it is given", async ({ main }) => {
    expect(await cli("migrate", "0001_users", "--db", "MAIN")).toBe(0);
    expect(await tables(main)).toEqual(["users"]);
  });

  it<CliContext>("rolls back when the migration is behind", async ({
    main,
  }) => {
    await cli("migrate", "--db", "MAIN");
    expect(await cli("migrate", "0001_users", "--db", "MAIN")).toBe(0);
    expect(await tables(main)).toEqual(["users"]);
  });

  it<CliContext>("leaves no table behind with --revert-all", async ({
    main,
  }) => {
    await cli("migrate", "--db", "MAIN");
    expect(await cli("migrate", "--revert-all", "--db", "MAIN")).toBe(0);
    expect(await tables(main)).toEqual([]);
  });

  it<CliContext>("takes -d as --db", async ({ main, analytics }) => {
    expect(await cli("migrate", "-d", "ANALYTICS")).toBe(0);
    expect(await tables(main)).toEqual([]);
    expect(await tables(analytics)).toEqual(["events"]);
  });

  it<CliContext>("takes -e as --wrangler-env", async ({ main }) => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    expect(await cli("migrate", "-d", "MAIN", "-e", "production")).toBe(1);
    expect(await tables(main)).toEqual([]);
  });

  it<CliContext>("touches only the database --db names", async ({
    main,
    analytics,
  }) => {
    expect(await cli("migrate", "--db", "ANALYTICS")).toBe(0);
    expect(await tables(main)).toEqual([]);
    expect(await tables(analytics)).toEqual(["events"]);
  });

  it<CliContext>("refuses a migration name across several databases", async ({
    main,
  }) => {
    expect(await cli("migrate", "0001_users")).toBe(1);
    expect(await tables(main)).toEqual([]);
  });

  it<CliContext>("reverts every database at once, needing no --db", async ({
    main,
    analytics,
  }) => {
    await cli("migrate");
    expect(await tables(main)).toEqual(["posts", "users"]);
    expect(await tables(analytics)).toEqual(["events"]);

    expect(await cli("migrate", "--revert-all")).toBe(0);
    expect(await tables(main)).toEqual([]);
    expect(await tables(analytics)).toEqual([]);
  });

  it<CliContext>("rejects an unknown migration before opening anything", async ({
    main,
  }) => {
    expect(await cli("migrate", "0009_nope", "--db", "MAIN")).toBe(1);
    expect(await tables(main)).toEqual([]);
  });

  it<CliContext>("rejects an unknown binding", async ({ main }) => {
    expect(await cli("migrate", "--db", "NOPE")).toBe(1);
    expect(await tables(main)).toEqual([]);
  });

  // No credentials, so the reason it fails is proof it went remote rather
  // than to the url env var that is set.
  it<CliContext>("goes to Cloudflare when an environment is named", async ({
    main,
  }) => {
    vi.stubEnv("MAIN_ID", "an-id");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    expect(
      await cli("migrate", "--db", "MAIN", "--wrangler-env", "production"),
    ).toBe(1);
    expect(await tables(main)).toEqual([]);
  });
});

describe("run seed", () => {
  sandbox();

  it<CliContext>("runs the seed a database declares", async ({ main }) => {
    await cli("migrate", "--db", "MAIN");
    expect(await cli("seed", "--db", "MAIN")).toBe(0);

    const db = createDb<never>(await dialectFromUrl(main));
    const rows = await db.selectFrom("users").selectAll().execute();
    await db.destroy();
    expect(rows).toEqual([{ id: "seeded" }]);
  });

  it("skips a database that declares none when it was not named", async () => {
    await cli("migrate");
    expect(await cli("seed")).toBe(0);
  });

  it("says so when the database it names declares none", async () => {
    await cli("migrate");
    expect(await cli("seed", "--db", "ANALYTICS")).toBe(1);
  });
});

describe("run --config", () => {
  sandbox();

  it<CliContext>("takes the long form as well as -c", async ({ main }) => {
    expect(await run(["migrate", "--config", config])).toBe(0);
    expect(await tables(main)).toEqual(["posts", "users"]);
  });

  it<CliContext>("says what actually went wrong inside the config", async ({
    dir,
  }) => {
    const broken = path.join(dir, "broken.mjs");
    await writeFile(broken, "export default { db: { binding: 'X' } \n");
    const said: string[] = [];
    vi.mocked(console.error).mockImplementation((line: unknown) => {
      said.push(String(line));
    });

    // The wording of the cause is node's or vite's, not ours; what this
    // pins is that we pass it on instead of printing only our own message.
    expect(await run(["migrate", "-c", broken])).toBe(1);
    expect(said.join("\n")).toMatch(/could not read .*broken\.mjs/u);
    expect(said.join("\n")).toMatch(/\n {2}caused by: .+/u);
  });

  it<CliContext>("names a config it cannot read", async ({ dir, main }) => {
    expect(await run(["migrate", "-c", path.join(dir, "nope.ts")])).toBe(1);
    expect(await tables(main)).toEqual([]);
  });
});

describe("run", () => {
  sandbox();

  it("answers 1 and prints usage for an unknown command", async () => {
    expect(await cli("frobnicate")).toBe(1);
  });
});

describe("run help and version", () => {
  sandbox();

  it("answers 0 for --help", async () => {
    expect(await run(["--help"])).toBe(0);
  });

  it("answers 0 for a command's own --help", async () => {
    expect(await run(["migrate", "--help"])).toBe(0);
  });

  it("answers 0 for --version", async () => {
    expect(await run(["--version"])).toBe(0);
  });

  it("answers 1 for an unknown option", async () => {
    expect(await cli("migrate", "--nope")).toBe(1);
  });

  it("answers 1 when seed is given a migrate-only option", async () => {
    expect(await cli("seed", "--revert-all")).toBe(1);
  });
});
