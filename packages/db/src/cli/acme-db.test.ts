import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../internal/database";
import { dialectFromUrl } from "../internal/uri/uri.node";
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

describe("run", () => {
  let dir = "";
  let main = "";
  let analytics = "";

  // Files, not :memory:, which is private to the connection that opened it.
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    dir = await mkdtemp(path.join(tmpdir(), "acme-db-cli-"));
    main = `file:${path.join(dir, "main.db")}`;
    analytics = `file:${path.join(dir, "analytics.db")}`;
    vi.stubEnv("MAIN_URL", main);
    vi.stubEnv("ANALYTICS_URL", analytics);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  describe("migrate", () => {
    it("applies every declared migration of every database", async () => {
      expect(await cli("migrate")).toBe(0);
      expect(await tables(main)).toEqual(["posts", "users"]);
      expect(await tables(analytics)).toEqual(["events"]);
    });

    it("is a no-op when rerun", async () => {
      await cli("migrate");
      expect(await cli("migrate")).toBe(0);
      expect(await tables(main)).toEqual(["posts", "users"]);
    });

    it("stops at the migration it is given", async () => {
      expect(await cli("migrate", "0001_users", "--db", "MAIN")).toBe(0);
      expect(await tables(main)).toEqual(["users"]);
    });

    it("rolls back when the migration is behind", async () => {
      await cli("migrate", "--db", "MAIN");
      expect(await cli("migrate", "0001_users", "--db", "MAIN")).toBe(0);
      expect(await tables(main)).toEqual(["users"]);
    });

    it("leaves no table behind with --revert-all", async () => {
      await cli("migrate", "--db", "MAIN");
      expect(await cli("migrate", "--revert-all", "--db", "MAIN")).toBe(0);
      expect(await tables(main)).toEqual([]);
    });

    it("takes -d as --db", async () => {
      expect(await cli("migrate", "-d", "ANALYTICS")).toBe(0);
      expect(await tables(main)).toEqual([]);
      expect(await tables(analytics)).toEqual(["events"]);
    });

    it("takes -e as --wrangler-env", async () => {
      vi.stubEnv("MAIN_ID", "an-id");
      vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
      expect(await cli("migrate", "-d", "MAIN", "-e", "production")).toBe(1);
      expect(await tables(main)).toEqual([]);
    });

    it("touches only the database --db names", async () => {
      expect(await cli("migrate", "--db", "ANALYTICS")).toBe(0);
      expect(await tables(main)).toEqual([]);
      expect(await tables(analytics)).toEqual(["events"]);
    });

    it("refuses a migration name across several databases", async () => {
      expect(await cli("migrate", "0001_users")).toBe(1);
      expect(await tables(main)).toEqual([]);
    });

    it("reverts every database at once, needing no --db", async () => {
      await cli("migrate");
      expect(await tables(main)).toEqual(["posts", "users"]);
      expect(await tables(analytics)).toEqual(["events"]);

      expect(await cli("migrate", "--revert-all")).toBe(0);
      expect(await tables(main)).toEqual([]);
      expect(await tables(analytics)).toEqual([]);
    });

    it("rejects an unknown migration before opening anything", async () => {
      expect(await cli("migrate", "0009_nope", "--db", "MAIN")).toBe(1);
      expect(await tables(main)).toEqual([]);
    });

    it("rejects an unknown binding", async () => {
      expect(await cli("migrate", "--db", "NOPE")).toBe(1);
      expect(await tables(main)).toEqual([]);
    });

    // No credentials, so the reason it fails is proof it went remote rather
    // than to the url env var that is set.
    it("goes to Cloudflare when an environment is named", async () => {
      vi.stubEnv("MAIN_ID", "an-id");
      vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
      expect(
        await cli("migrate", "--db", "MAIN", "--wrangler-env", "production"),
      ).toBe(1);
      expect(await tables(main)).toEqual([]);
    });
  });

  describe("seed", () => {
    it("runs the seed a database declares", async () => {
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

  describe("--config", () => {
    it("takes the long form as well as -c", async () => {
      expect(await run(["migrate", "--config", config])).toBe(0);
      expect(await tables(main)).toEqual(["posts", "users"]);
    });

    it("says what actually went wrong inside the config", async () => {
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

    it("names a config it cannot read", async () => {
      expect(await run(["migrate", "-c", path.join(dir, "nope.ts")])).toBe(1);
      expect(await tables(main)).toEqual([]);
    });
  });

  it("answers 1 and prints usage for an unknown command", async () => {
    expect(await cli("frobnicate")).toBe(1);
  });

  describe("help and version", () => {
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
});
