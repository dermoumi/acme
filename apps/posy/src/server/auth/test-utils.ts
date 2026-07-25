import SQLite from "better-sqlite3";
import { type Dialect, type Kysely, SqliteDialect } from "kysely";
import type { AppBindings } from "../bindings";
import { createDb, createMigrator, type Database } from "../db";

export async function migratedDialect(): Promise<Dialect> {
  const dialect = new SqliteDialect({ database: new SQLite(":memory:") });
  const db = createDb(dialect);
  const { error } = await createMigrator(db).migrateToLatest();
  if (error) throw new Error("migration failed", { cause: error });
  return dialect;
}

export async function seedUser(
  db: Kysely<Database>,
  id: string,
  name = "Tester",
): Promise<void> {
  await db.insertInto("users").values({ id, name, created_at: 1000 }).execute();
}

export const testEnv: AppBindings = {
  ASSETS: { fetch: () => Promise.resolve(new Response("asset")) },
};
