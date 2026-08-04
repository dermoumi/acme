import { env } from "cloudflare:test";
import { type Kysely, sql } from "kysely";
import { describe, expect, it } from "vitest";
import { createDbSource } from "./source";

async function reachesD1(db: Kysely<unknown>) {
  const rows = await sql<{ one: number }>`select 1 as one`.execute(db);
  return rows.rows[0]?.one;
}

describe("createDbSource on workerd", () => {
  it("reads the DB binding by default", async () => {
    const db = await createDbSource().resolve(env);
    expect(await reachesD1(db)).toBe(1);
  });

  it("honours a custom binding name", async () => {
    const source = createDbSource({ binding: "OTHER" });
    const db = await source.resolve({ OTHER: env.DB });
    expect(await reachesD1(db)).toBe(1);
  });

  it("refuses a missing binding by name", async () => {
    const source = createDbSource({ binding: "NOPE" });
    await expect(source.resolve(env)).rejects.toThrow(
      /no D1 binding named "NOPE"/u,
    );
  });

  it("ignores url, which belongs to the node arm", async () => {
    const source = createDbSource({ url: "postgres://nowhere/db" });
    expect(await reachesD1(await source.resolve(env))).toBe(1);
  });

  // The binding belongs to the request that carried it, so a source must never
  // hand a later request the database it built for an earlier one.
  it("builds a fresh database per request", async () => {
    const source = createDbSource();
    expect(await source.resolve(env)).not.toBe(await source.resolve(env));
  });
});
