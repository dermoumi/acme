import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:test";
import { D1Dialect } from "kysely-d1";
import { describe, expect, it } from "vitest";
import { createDb } from "../database";
import { d1MigrationDialect } from "./migration-dialect";

// Only what is true of D1 alone lives here; the migrator and query contracts
// run on every runtime from src/migrator.test.ts and src/database.test.ts.

function database(): D1Database {
  return env.DB as D1Database;
}

describe("d1MigrationDialect", () => {
  it("reports tables, names only", async () => {
    const db = createDb(d1MigrationDialect(database()));
    await db.schema
      .createTable("introspected")
      .addColumn("id", "text", (col) => col.primaryKey())
      .execute();

    const tables = await db.introspection.getTables();
    const found = tables.find((table) => table.name === "introspected");
    expect(found).toBeDefined();
    expect(found?.columns).toEqual([]);
    expect(await db.introspection.getSchemas()).toEqual([]);

    await db.schema.dropTable("introspected").execute();
    await db.destroy();
  });

  // The reason this dialect exists: guards the fix against a kysely-d1 release
  // that looks like it made the wrapper redundant.
  it("wraps a stock D1Dialect that still cannot introspect D1", async () => {
    const db = createDb(new D1Dialect({ database: database() }));
    await expect(db.introspection.getTables()).rejects.toThrow(
      /not authorized|SQLITE_AUTH/iu,
    );
    await db.destroy();
  });
});
