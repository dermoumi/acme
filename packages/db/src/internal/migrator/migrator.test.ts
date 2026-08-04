import { createEmptyDialect } from "#testing/runtime";
import { type Kysely, sql } from "kysely";
import { type Migration, NO_MIGRATIONS } from "kysely/migration";
import { describe, expect, it } from "vitest";
import { createDb } from "../database";
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

// Sorted, so tableNames returns a stable order without sorting its results.
const MIGRATED_TABLES = ["gadgets", "widgets"];

describe("createMigrator", () => {
  async function emptyDb(): Promise<Kysely<TestSchema>> {
    return createDb<TestSchema>(await createEmptyDialect());
  }

  // Probed rather than listed: sqlite_master does not exist on postgres, and
  // introspection there would also see the other workers' schemas.
  async function tableNames(db: Kysely<TestSchema>): Promise<string[]> {
    const present = await Promise.all(
      MIGRATED_TABLES.map(async (name) => {
        const probe = sql`select 1 from ${sql.table(name)} where 1 = 0`;
        return probe.execute(db).then(
          () => name,
          () => undefined,
        );
      }),
    );
    return present.filter((name) => name !== undefined);
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
    const dialect = await createEmptyDialect();
    const db = createDb<TestSchema>(dialect);
    // Asked of the dialect, not tracked by hand: kysely uses this same flag
    // to decide whether to wrap the batch in a transaction.
    const rollsBack = dialect.createAdapter().supportsTransactionalDdl;
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
    // Engines genuinely disagree here, so state it rather than pick a side:
    // postgres rolls the whole batch back, sqlite and D1 keep what ran.
    expect(await tableNames(db)).toEqual(rollsBack ? [] : ["widgets"]);
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
