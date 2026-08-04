import { createEmptyDialect } from "#testing/runtime";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { createDbSource } from "./source";

describe("createDbSource", () => {
  it("resolves a working database from an explicit dialect", async () => {
    const source = createDbSource({ dialect: await createEmptyDialect() });
    const db = await source.resolve();
    const rows = await sql<{ one: number }>`select 1 as one`.execute(db);
    expect(rows.rows[0]?.one).toBe(1);
  });

  it("hands back the same database for the same dialect", async () => {
    const source = createDbSource({ dialect: await createEmptyDialect() });
    expect(await source.resolve()).toBe(await source.resolve());
  });

  // The cache lives in the factory's closure, not at module scope, so two sources
  // in one process cannot collide.
  it("keeps two sources independent", async () => {
    const dialect = await createEmptyDialect();
    const first = createDbSource({ dialect });
    const second = createDbSource({ dialect });
    expect(await first.resolve()).not.toBe(await second.resolve());
  });
});
