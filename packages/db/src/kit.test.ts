import { createEmptyDialect } from "#testing/runtime";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { createDbKit } from "./kit";

describe("createDbKit", () => {
  it("resolves a working database from an explicit dialect", async () => {
    const kit = createDbKit({ dialect: await createEmptyDialect() });
    const db = await kit.resolve();
    const rows = await sql<{ one: number }>`select 1 as one`.execute(db);
    expect(rows.rows[0]?.one).toBe(1);
  });

  it("hands back the same database for the same dialect", async () => {
    const kit = createDbKit({ dialect: await createEmptyDialect() });
    expect(await kit.resolve()).toBe(await kit.resolve());
  });

  // The cache lives in the factory's closure, not at module scope, so two kits
  // in one process cannot collide.
  it("keeps two kits independent", async () => {
    const dialect = await createEmptyDialect();
    const first = createDbKit({ dialect });
    const second = createDbKit({ dialect });
    expect(await first.resolve()).not.toBe(await second.resolve());
  });
});
