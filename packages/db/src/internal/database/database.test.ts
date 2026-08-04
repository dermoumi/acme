import { createEmptyDialect } from "#testing/runtime";
import { type Kysely, sql } from "kysely";
import { describe, expect, it } from "vitest";
import { createDb } from "./database";

interface TestSchema {
  widgets: { id: string; label: string; note: string | null; count: number };
}

describe("createDb", () => {
  async function widgetDb(): Promise<Kysely<TestSchema>> {
    const db = createDb<TestSchema>(await createEmptyDialect());
    await db.schema
      .createTable("widgets")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("label", "text", (col) => col.notNull())
      .addColumn("note", "text")
      .addColumn("count", "integer")
      .execute();
    return db;
  }

  it("queries the schema it was typed with", async () => {
    const db = await widgetDb();
    await db
      .insertInto("widgets")
      .values({ id: "w1", label: "Cog", note: "spare", count: 3 })
      .execute();

    const row = await db
      .selectFrom("widgets")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ id: "w1", label: "Cog", note: "spare", count: 3 });
    await db.destroy();
  });

  // Engines disagree about empty and absent values often enough to pin down.
  it("brings a null column back as null, not empty string", async () => {
    const db = await widgetDb();
    await db
      .insertInto("widgets")
      .values({ id: "w1", label: "Cog", note: null, count: 0 })
      .execute();

    const row = await db
      .selectFrom("widgets")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.note).toBeNull();
    expect(row.count).toBe(0);
    await db.destroy();
  });

  it("runs raw sql through the same connection", async () => {
    const db = await widgetDb();
    const rows = await sql<{ one: number }>`select 1 as one`.execute(db);
    expect(rows.rows[0]?.one).toBe(1);
    await db.destroy();
  });

  describe("enforces the constraints it declared", () => {
    it("rejects a missing not-null value", async () => {
      const db = await widgetDb();
      await expect(
        db
          .insertInto("widgets")
          .values({ id: "w2" } as TestSchema["widgets"])
          .execute(),
      ).rejects.toThrow();
      await db.destroy();
    });

    it("rejects a duplicate primary key", async () => {
      const db = await widgetDb();
      const widget = { id: "w1", note: null, count: 0 };
      await db
        .insertInto("widgets")
        .values({ ...widget, label: "Cog" })
        .execute();
      await expect(
        db
          .insertInto("widgets")
          .values({ ...widget, label: "Bolt" })
          .execute(),
      ).rejects.toThrow();
      await db.destroy();
    });
  });
});
