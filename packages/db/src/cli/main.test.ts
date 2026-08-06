import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../internal/database";
import { dialectFromUrl } from "../internal/uri/uri.node";
import { run } from "./main";

// One engine is enough: this proves the CLI wires the migrator to a database,
// not that the migrator works, which every engine project already covers.
const app = path.join(import.meta.dirname, "fixtures", "app");

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
      expect(await run(["migrate"], app)).toBe(0);
      expect(await tables(main)).toEqual(["posts", "users"]);
      expect(await tables(analytics)).toEqual(["events"]);
    });

    it("is a no-op when rerun", async () => {
      await run(["migrate"], app);
      expect(await run(["migrate"], app)).toBe(0);
      expect(await tables(main)).toEqual(["posts", "users"]);
    });

    it("stops at the migration it is given", async () => {
      expect(await run(["migrate", "0001_users", "--db", "MAIN"], app)).toBe(0);
      expect(await tables(main)).toEqual(["users"]);
    });

    it("rolls back when the migration is behind", async () => {
      await run(["migrate", "--db", "MAIN"], app);
      expect(await run(["migrate", "0001_users", "--db", "MAIN"], app)).toBe(0);
      expect(await tables(main)).toEqual(["users"]);
    });

    it("leaves no table behind with --revert-all", async () => {
      await run(["migrate", "--db", "MAIN"], app);
      expect(await run(["migrate", "--revert-all", "--db", "MAIN"], app)).toBe(
        0,
      );
      expect(await tables(main)).toEqual([]);
    });

    it("touches only the database --db names", async () => {
      expect(await run(["migrate", "--db", "ANALYTICS"], app)).toBe(0);
      expect(await tables(main)).toEqual([]);
      expect(await tables(analytics)).toEqual(["events"]);
    });

    it("refuses a migration name across several databases", async () => {
      expect(await run(["migrate", "0001_users"], app)).toBe(1);
      expect(await tables(main)).toEqual([]);
    });

    it("refuses --revert-all across several databases", async () => {
      await run(["migrate"], app);
      expect(await run(["migrate", "--revert-all"], app)).toBe(1);
      expect(await tables(main)).toEqual(["posts", "users"]);
    });

    it("rejects an unknown migration before opening anything", async () => {
      expect(await run(["migrate", "0009_nope", "--db", "MAIN"], app)).toBe(1);
      expect(await tables(main)).toEqual([]);
    });

    it("rejects an unknown binding", async () => {
      expect(await run(["migrate", "--db", "NOPE"], app)).toBe(1);
      expect(await tables(main)).toEqual([]);
    });

    it("rejects --db together with --remote-db", async () => {
      expect(
        await run(["migrate", "--db", "MAIN", "--remote-db", "MAIN"], app),
      ).toBe(1);
    });
  });

  describe("seed", () => {
    it("runs the seed a database declares", async () => {
      await run(["migrate", "--db", "MAIN"], app);
      expect(await run(["seed", "--db", "MAIN"], app)).toBe(0);

      const db = createDb<never>(await dialectFromUrl(main));
      const rows = await db.selectFrom("users").selectAll().execute();
      await db.destroy();
      expect(rows).toEqual([{ id: "seeded" }]);
    });

    it("skips a database that declares none when it was not named", async () => {
      await run(["migrate"], app);
      expect(await run(["seed"], app)).toBe(0);
    });

    it("says so when the database it names declares none", async () => {
      await run(["migrate"], app);
      expect(await run(["seed", "--db", "ANALYTICS"], app)).toBe(1);
    });
  });

  it("answers 1 and prints usage for an unknown command", async () => {
    expect(await run(["frobnicate"], app)).toBe(1);
  });
});
