import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:test";
import { D1Dialect } from "kysely-d1";
import { describe, expect, it } from "vitest";
import { createDb } from "../internal/database";
import { d1MigrationDialect } from "./migration-dialect";

// D1-only facts. The migrator and query contracts run on every engine, from
// internal/migrator and internal/database.

function database(): D1Database {
  return env.DATABASE as D1Database;
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

  // Guards the fix against a kysely-d1 release that only looks like it made
  // the wrapper redundant.
  it("is still needed, since a stock D1Dialect cannot introspect D1", async () => {
    const db = createDb(new D1Dialect({ database: database() }));
    await expect(db.introspection.getTables()).rejects.toThrow(
      /not authorized|SQLITE_AUTH/iu,
    );
    await db.destroy();
  });
});
