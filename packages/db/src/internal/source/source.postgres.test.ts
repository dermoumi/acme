import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { createDbSource } from "./source";

const url = process.env.ACME_DB_TEST_URL ?? "";

describe("createDbSource over postgres", () => {
  it("reuses one pool across resolve calls", async () => {
    const source = createDbSource({ url });
    const first = await source.resolve();
    expect(await source.resolve()).toBe(first);

    const pid = sql<{ pid: number }>`select pg_backend_pid() as pid`;
    expect((await pid.execute(first)).rows[0]?.pid).toBeTypeOf("number");
    await first.destroy();
  });

  // pg returns bigint as a string to avoid precision loss, unlike sqlite.
  // hono/middleware.test.ts already wraps its count for exactly this reason.
  it("returns count(*) as a string, not a number", async () => {
    const db = await createDbSource({ url }).resolve();
    await sql`create table counted (id text)`.execute(db);
    await sql`insert into counted values ('a'), ('b')`.execute(db);

    const rows = await sql<{ total: unknown }>`
      select count(*) as total from counted
    `.execute(db);
    expect(rows.rows[0]?.total).toBe("2");
    expect(Number(rows.rows[0]?.total)).toBe(2);

    await sql`drop table counted`.execute(db);
    await db.destroy();
  });
});
