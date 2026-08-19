import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { defineDb } from "./define";

interface TestSchema {
  widgets: { id: string };
}

describe("defineDb over sqlite", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "acme-db-define-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function fileEnv(name: string) {
    return { DATABASE_URL: pathToFileURL(path.join(dir, name)).href };
  }

  // Guards anyone giving the accessor a shared connection: two :memory:
  // databases are private, and losing that would silently share state.
  it("keeps two accessors on :memory: from seeing each other", async () => {
    const env = { DATABASE_URL: ":memory:" };
    const first = defineDb<TestSchema>("DATABASE");
    const second = defineDb<TestSchema>("DATABASE");

    const owned = await first({ env });
    await sql`create table only_in_first (id text)`.execute(owned);
    await expect(
      sql`select 1 from only_in_first`.execute(await second({ env })),
    ).rejects.toThrow();

    await first.clear();
    await second.clear();
  });

  it("lets two accessors over one file url see each other's writes", async () => {
    const env = fileEnv("shared.db");
    const writer = defineDb<TestSchema>("DATABASE");
    const reader = defineDb<TestSchema>("DATABASE");

    const write = await writer({ env });
    await sql`create table shared (id text)`.execute(write);
    await sql`insert into shared values ('w1')`.execute(write);

    const rows = await sql<{ id: string }>`select id from shared`.execute(
      await reader({ env }),
    );
    expect(rows.rows).toEqual([{ id: "w1" }]);

    await writer.clear();
    await reader.clear();
  });

  it("creates the database file when it does not exist", async () => {
    const file = path.join(dir, "created.db");
    expect(existsSync(file)).toBe(false);

    const getDb = defineDb<TestSchema>("DATABASE");
    const db = await getDb({ env: fileEnv("created.db") });
    await sql`create table t (id text)`.execute(db);

    expect(existsSync(file)).toBe(true);
    await getDb.clear();
  });
});
