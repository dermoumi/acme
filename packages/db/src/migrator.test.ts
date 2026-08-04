import { createEmptyDialect } from "#testing/runtime";
import { type Kysely, sql } from "kysely";
import { type Migration, NO_MIGRATIONS } from "kysely/migration";
import { describe, expect, it } from "vitest";
import { createDb } from "./database";
import { createMigrator, type Migrations } from "./migrator";

interface TestSchema {
  widgets: { id: string };
}

const createWidgets: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("widgets")
      .addColumn("id", "text", (col) => col.primaryKey())
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable("widgets").execute();
  },
};

const migrations: Migrations = {
  "0001_widgets": createWidgets,
  "0002_gadgets": {
    up: async (db) => {
      await db.schema
        .createTable("gadgets")
        .addColumn("id", "text", (col) => col.primaryKey())
        .execute();
    },
    down: async (db) => {
      await db.schema.dropTable("gadgets").execute();
    },
  },
};

describe("createMigrator", () => {
  async function emptyDb(): Promise<Kysely<TestSchema>> {
    return createDb<TestSchema>(await createEmptyDialect());
  }

  // Excludes D1's internal tables, which node simply never has.
  async function tableNames(db: Kysely<TestSchema>): Promise<string[]> {
    const rows = await sql<{ name: string }>`
      select name from sqlite_master
      where type = 'table' and name not like 'sqlite_%'
        and name not like '%migration%' and name not glob '_cf_*'
    `.execute(db);
    return rows.rows.map((row) => row.name).toSorted();
  }

  it("migrates up from zero, in key order", async () => {
    const db = await emptyDb();
    const { error, results } = await createMigrator(
      db,
      migrations,
    ).migrateToLatest();
    expect(error).toBeUndefined();
    expect(results?.map((result) => result.migrationName)).toEqual([
      "0001_widgets",
      "0002_gadgets",
    ]);
    expect(await tableNames(db)).toEqual(["gadgets", "widgets"]);
    await db.destroy();
  });

  it("reverts to an empty schema with down()", async () => {
    const db = await emptyDb();
    await createMigrator(db, migrations).migrateToLatest();
    const { error } = await createMigrator(db, migrations).migrateTo(
      NO_MIGRATIONS,
    );
    expect(error).toBeUndefined();
    expect(await tableNames(db)).toEqual([]);
    await db.destroy();
  });

  it("stops at the migration migrateTo names", async () => {
    const db = await emptyDb();
    const { error } = await createMigrator(db, migrations).migrateTo(
      "0001_widgets",
    );
    expect(error).toBeUndefined();
    expect(await tableNames(db)).toEqual(["widgets"]);
    await db.destroy();
  });

  it("treats an empty record as a valid, no-op migration set", async () => {
    const db = await emptyDb();
    const { error, results } = await createMigrator(db, {}).migrateToLatest();
    expect(error).toBeUndefined();
    expect(results).toEqual([]);
    await db.destroy();
  });

  it("reports a failure and leaves later migrations unrun", async () => {
    const db = await emptyDb();
    const broken: Migrations = {
      "0001_widgets": createWidgets,
      "0002_broken": {
        up: () => Promise.reject(new Error("boom")),
        down: () => Promise.resolve(),
      },
    };
    const { error, results } = await createMigrator(
      db,
      broken,
    ).migrateToLatest();
    expect(error).toBeDefined();
    expect(results?.map((result) => result.status)).toEqual([
      "Success",
      "Error",
    ]);
    expect(await tableNames(db)).toEqual(["widgets"]);
    await db.destroy();
  });

  it("is a no-op when rerun after reaching latest", async () => {
    const db = await emptyDb();
    await createMigrator(db, migrations).migrateToLatest();
    const { error, results } = await createMigrator(
      db,
      migrations,
    ).migrateToLatest();
    expect(error).toBeUndefined();
    expect(results).toEqual([]);
    expect(await tableNames(db)).toEqual(["gadgets", "widgets"]);
    await db.destroy();
  });
});
