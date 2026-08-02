import SQLite from "better-sqlite3";
import { type Kysely, SqliteDialect, sql } from "kysely";
import { type Migration, NO_MIGRATIONS } from "kysely/migration";
import { expect, test } from "vitest";
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

function emptyDb(): Kysely<TestSchema> {
  return createDb(new SqliteDialect({ database: new SQLite(":memory:") }));
}

async function tableNames(db: Kysely<TestSchema>): Promise<string[]> {
  const rows = await sql<{ name: string }>`
    select name from sqlite_master
    where type = 'table' and name not like 'sqlite_%'
      and name not like '%migration%'
  `.execute(db);
  return rows.rows.map((row) => row.name).toSorted();
}

test("migrates up from zero, in key order", async () => {
  const db = emptyDb();
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

test("down() reverts to an empty schema", async () => {
  const db = emptyDb();
  await createMigrator(db, migrations).migrateToLatest();
  const { error } = await createMigrator(db, migrations).migrateTo(
    NO_MIGRATIONS,
  );
  expect(error).toBeUndefined();
  expect(await tableNames(db)).toEqual([]);
  await db.destroy();
});

test("migrateTo stops at the named migration", async () => {
  const db = emptyDb();
  const { error } = await createMigrator(db, migrations).migrateTo(
    "0001_widgets",
  );
  expect(error).toBeUndefined();
  expect(await tableNames(db)).toEqual(["widgets"]);
  await db.destroy();
});

test("an empty record is a valid, no-op migration set", async () => {
  const db = emptyDb();
  const { error, results } = await createMigrator(db, {}).migrateToLatest();
  expect(error).toBeUndefined();
  expect(results).toEqual([]);
  await db.destroy();
});

test("a failing migration reports the error and leaves later ones unrun", async () => {
  const db = emptyDb();
  const broken: Migrations = {
    "0001_widgets": createWidgets,
    "0002_broken": {
      up: () => Promise.reject(new Error("boom")),
      down: () => Promise.resolve(),
    },
  };
  const { error, results } = await createMigrator(db, broken).migrateToLatest();
  expect(error).toBeDefined();
  expect(results?.map((result) => result.status)).toEqual(["Success", "Error"]);
  expect(await tableNames(db)).toEqual(["widgets"]);
  await db.destroy();
});
