import { createEmptyDialect } from "#testing/runtime";
import type { Generated, Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import { createDb } from "../database";
import { createMigrator } from "../migrator";
import { generatedId } from "./generated-id";

interface TestSchema {
  ledger: { id: Generated<number>; note: string };
}

const migrations = {
  "0001_ledger": {
    up: async (db: Kysely<never>): Promise<void> => {
      await db.schema
        .createTable("ledger")
        .$call(generatedId(db))
        .addColumn("note", "text", (col) => col.notNull())
        .execute();
    },
    down: async (db: Kysely<never>): Promise<void> => {
      await db.schema.dropTable("ledger").execute();
    },
  },
};

async function migratedDb(): Promise<Kysely<TestSchema>> {
  const db = createDb<TestSchema>(await createEmptyDialect());
  const { error } = await createMigrator(db, migrations).migrateToLatest();
  if (error instanceof Error) throw error;

  return db;
}

describe("generatedId", () => {
  it("creates a key this engine accepts, and fills it on insert", async () => {
    const db = await migratedDb();
    try {
      await db
        .insertInto("ledger")
        .values([{ note: "first" }, { note: "second" }])
        .execute();
      const rows = await db
        .selectFrom("ledger")
        .selectAll()
        .orderBy("id")
        .execute();

      expect(rows.map((row) => row.note)).toEqual(["first", "second"]);
      // Values are the engine's business; that they exist and differ is not.
      expect(rows[0]?.id).toEqual(expect.any(Number));
      expect(rows[1]?.id).not.toBe(rows[0]?.id);
    } finally {
      await db.destroy();
    }
  });

  it("names the column when asked", async () => {
    const db = createDb<never>(await createEmptyDialect());
    try {
      await db.schema
        .createTable("thing")
        .$call(generatedId(db, "thing_id"))
        .execute();
      await expect(
        db
          .insertInto("thing" as never)
          .defaultValues()
          .execute(),
      ).resolves.toBeDefined();
    } finally {
      await db.destroy();
    }
  });
});
