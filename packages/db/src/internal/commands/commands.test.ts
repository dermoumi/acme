import type { Kit } from "@acme/app";
import { runWithConfig } from "@acme/app/cli";
import { describe, expect, it, vi } from "vitest";
import appConfig from "../kit/fixtures/app/acme.config";
import { type CliContext, rows, sandbox, tables } from "./test-utils";

// One engine is enough: this proves the commands wire the migrator to a
// database, not that the migrator works, which every engine project covers.
const cli = (...argv: string[]) => runWithConfig(appConfig, argv);

const asker = (name = "asker"): Kit => ({
  name,
  cli: new URL("./fixtures/asker.ts", import.meta.url).href,
});

const withAsker = (): Kit[] => [asker(), ...(appConfig.kits ?? [])];

describe("migrate", () => {
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

describe("seed", () => {
  sandbox();

  it<CliContext>("runs the seed a database declares", async ({ main }) => {
    await cli("migrate", "--db", "MAIN");
    expect(await cli("seed", "--db", "MAIN")).toBe(0);

    expect(await rows(main, "users")).toEqual([{ id: "seeded" }]);
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

describe("the commands acme mounts", () => {
  sandbox();

  it("lists both of them in acme's help", async () => {
    const said: string[] = [];
    // cac prints help through console.info, which the sandbox leaves alone.
    vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      said.push(args.join(" "));
    });

    expect(await cli("--help")).toBe(0);
    expect(said.join("\n")).toContain("migrate");
    expect(said.join("\n")).toContain("seed");
  });

  it("answers 0 for a command's own --help", async () => {
    expect(await cli("migrate", "--help")).toBe(0);
  });

  it("answers 1 for an unknown option", async () => {
    expect(await cli("migrate", "--nope")).toBe(1);
  });

  // --revert-all sits on migrate alone, which is what makes this an error.
  it("answers 1 when seed is given a migrate-only option", async () => {
    expect(await cli("seed", "--revert-all")).toBe(1);
  });
});

// Stands in for @acme/auth: a kit reaching a database it never configured.
describe("the database kit registering how to open one", () => {
  sandbox();

  it<CliContext>("opens the database a binding names", async ({ main }) => {
    expect(await runWithConfig({ kits: withAsker() }, ["ask", "MAIN"])).toBe(0);
    expect(await tables(main)).toContain("asked");
  });

  it<CliContext>("opens the one it names, not the first declared", async ({
    analytics,
  }) => {
    expect(
      await runWithConfig({ kits: withAsker() }, ["ask", "ANALYTICS"]),
    ).toBe(0);
    expect(await tables(analytics)).toContain("asked");
  });

  it<CliContext>("refuses a binding the app never declared", async ({
    main,
  }) => {
    expect(await runWithConfig({ kits: withAsker() }, ["ask", "NOPE"])).toBe(1);
    expect(await tables(main)).toEqual([]);
  });

  it<CliContext>("says so when no database kit is declared at all", async () => {
    expect(await runWithConfig({ kits: [asker()] }, ["ask", "MAIN"])).toBe(1);
  });
});
