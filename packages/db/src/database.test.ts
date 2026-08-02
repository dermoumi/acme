import SQLite from "better-sqlite3";
import { SqliteDialect, sql } from "kysely";
import { expect, test } from "vitest";
import { createDb } from "./database";

interface TestSchema {
  widgets: { id: string; label: string };
}

function widgetDb() {
  const db = createDb<TestSchema>(
    new SqliteDialect({ database: new SQLite(":memory:") }),
  );
  return db;
}

test("queries the schema it was typed with", async () => {
  const db = widgetDb();
  await db.schema
    .createTable("widgets")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("label", "text", (col) => col.notNull())
    .execute();
  await db.insertInto("widgets").values({ id: "w1", label: "Cog" }).execute();

  const row = await db
    .selectFrom("widgets")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row).toEqual({ id: "w1", label: "Cog" });
  await db.destroy();
});

test("destroy closes the connection", async () => {
  const db = widgetDb();
  await sql`select 1`.execute(db);
  await db.destroy();
  await expect(sql`select 1`.execute(db)).rejects.toThrow();
});
