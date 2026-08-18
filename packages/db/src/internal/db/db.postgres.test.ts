import { emptyDbEnv } from "../../testing/empty-env";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { defineDb } from "./define";

describe("defineDb over postgres", () => {
  // pg returns bigint as a string to avoid precision loss, unlike sqlite.
  // posy's db.test.ts wraps its counts for exactly this reason.
  it("returns count(*) as a string, not a number", async () => {
    const getDb = defineDb("DATABASE");
    const db = await getDb({ env: await emptyDbEnv("DATABASE") });

    await sql`create table counted (id text)`.execute(db);
    await sql`insert into counted values ('a'), ('b')`.execute(db);
    const rows = await sql<{ total: unknown }>`
      select count(*) as total from counted
    `.execute(db);

    expect(rows.rows[0]?.total).toBe("2");
    expect(Number(rows.rows[0]?.total)).toBe(2);
    await getDb.clear();
  });

  it("holds one backend connection across calls", async () => {
    const getDb = defineDb("DATABASE");
    const env = await emptyDbEnv("DATABASE");

    const pid = sql<{ pid: number }>`select pg_backend_pid() as pid`;
    const first = (await pid.execute(await getDb({ env }))).rows[0]?.pid;
    const second = (await pid.execute(await getDb({ env }))).rows[0]?.pid;

    expect(first).toBeTypeOf("number");
    expect(second).toBe(first);
    await getDb.clear();
  });
});
