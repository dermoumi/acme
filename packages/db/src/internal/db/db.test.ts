import { emptyDbEnv } from "../../testing/empty-env";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { resetDb } from "../../testing/reset";
import { defineDb } from "./define";

interface TestSchema {
  widgets: { id: string };
}

// Names nothing either runtime can find, so resolving always throws.
const NOWHERE = "__NO_SUCH_DATABASE__";

describe("defineDb", () => {
  it("resolves a working database from the request's env", async () => {
    const getDb = defineDb<TestSchema>("DATABASE");
    const db = await getDb({ env: await emptyDbEnv("DATABASE") });

    const rows = await sql<{ one: number }>`select 1 as one`.execute(db);
    expect(rows.rows[0]?.one).toBe(1);
    await resetDb(getDb);
  });

  it("hands back the same database on every call", async () => {
    const getDb = defineDb<TestSchema>("DATABASE");
    const ctx = { env: await emptyDbEnv("DATABASE") };

    expect(await getDb(ctx)).toBe(await getDb(ctx));
    await resetDb(getDb);
  });

  // The point of caching: a second request must not open a second connection,
  // so it has to see what the first one wrote.
  it("keeps one database across separate requests", async () => {
    const getDb = defineDb<TestSchema>("DATABASE");
    const env = await emptyDbEnv("DATABASE");

    const first = await getDb({ env });
    await sql`create table widgets (id text)`.execute(first);
    await sql`insert into widgets values ('w1')`.execute(first);

    const second = await getDb({ env });
    const rows = await sql<{ id: string }>`select id from widgets`.execute(
      second,
    );
    expect(rows.rows).toEqual([{ id: "w1" }]);
    await resetDb(getDb);
  });

  it("ignores the env it is handed after the first resolve", async () => {
    const getDb = defineDb<TestSchema>("DATABASE");
    const db = await getDb({ env: await emptyDbEnv("DATABASE") });

    expect(await getDb({ env: {} })).toBe(db);
    await resetDb(getDb);
  });

  it("keeps two accessors independent", async () => {
    const first = defineDb<TestSchema>("DATABASE");
    const second = defineDb<TestSchema>("DATABASE");
    const env = await emptyDbEnv("DATABASE");

    expect(await first({ env })).not.toBe(await second({ env }));
    await resetDb(first);
    await resetDb(second);
  });

  it("refuses an environment that names no database", async () => {
    const getDb = defineDb<TestSchema>(NOWHERE);
    await expect(getDb({ env: {} })).rejects.toThrow();
  });

  it("retries after a failure rather than caching it", async () => {
    const getDb = defineDb<TestSchema>("DATABASE");
    await expect(getDb({ env: {} })).rejects.toThrow();

    // A cached rejection would reject again whatever env arrived next.
    const db = await getDb({ env: await emptyDbEnv("DATABASE") });
    expect(db).toBeDefined();
    await resetDb(getDb);
  });
});

describe("resetDb", () => {
  it("makes the next call open a new database", async () => {
    const getDb = defineDb<TestSchema>("DATABASE");
    const first = await getDb({ env: await emptyDbEnv("DATABASE") });

    await resetDb(getDb);
    expect(await getDb({ env: await emptyDbEnv("DATABASE") })).not.toBe(first);
    await resetDb(getDb);
  });

  it("is safe on an accessor that never resolved", async () => {
    await expect(resetDb(defineDb("DATABASE"))).resolves.toBeUndefined();
  });

  it("refuses anything that is not an accessor", async () => {
    await expect(resetDb({})).rejects.toThrow(/expects an accessor/u);
  });
});
